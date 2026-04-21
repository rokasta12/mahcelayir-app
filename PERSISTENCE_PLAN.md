# Persistence Plan — Desktop Archive Folder

**Status:** Pre-execution spec. Supersedes the localStorage-based storage (which stays for a one-time migration read).

**Decision basis (from user):**
- Apple Developer account renewal is deferred → distribution is via unsigned DMG with right-click-Open for now.
- Data must survive app updates, rebuilds, refactors, and even being handed a fresh copy of the app.
- Uncle should **see** his data, be able to back it up by copying the folder, and not have to know what a "sandbox" is.
- Rust side should be the robust author of reads/writes — not the WebKit-layer localStorage.

---

## 1. One-sentence design

All persistent data lives in **one visible folder on the Desktop** (`~/Desktop/Mahmut Celayir Arşivi/`), written by the Rust side through atomic operations, with rolling backups and a versioned schema — so any future build of the app opens it cleanly.

---

## 2. Why the Desktop?

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| `~/Library/Application Support/...` (current) | Hidden, "correct" macOS idiom | Uncle can't see it; gets wiped if user force-deletes app, or breaks when bundle identifier changes | ❌ |
| `~/Desktop/Mahmut Celayir Arşivi/` | Visible, findable, easy to back up (just drag to USB), **survives app updates**, immune to identifier changes | Clutter concern if named badly | ✅ |
| `~/Documents/Mahmut Celayir/` | Also visible, less clutter | Less discoverable than Desktop | ⚠️ |
| Let user pick on first launch | Max flexibility | Too many choices for uncle | ❌ |

**Chosen:** `~/Desktop/Mahmut Celayir Arşivi/` (Turkish name so uncle recognizes it).

**Fallback:** if Desktop doesn't exist (weird edge case), use `~/Documents/`.

**Relocatability:** in Settings, user can move the folder and "re-point" the app via a file picker. A small `meta.json` in the app's appdata remembers the chosen path.

---

## 3. Folder layout

```
~/Desktop/Mahmut Celayir Arşivi/
│
├── projects.json               ← single source of truth for ALL project data
├── projects.json.backup.1      ← rolling backup (newest)
├── projects.json.backup.2
├── projects.json.backup.3      ← oldest; older backups get deleted
│
├── archive-meta.json           ← { schemaVersion, createdAt, lastWriteAt, appVersion }
│
├── logo/
│   ├── current.txt             ← absolute path OR relative "pool/crop_NNN.jpg"
│   ├── dock-icon.png           ← composed macOS Dock icon
│   └── pool/
│       ├── crop_000.jpg        ← the 256 random fragments
│       ├── crop_001.jpg
│       └── ... crop_255.jpg
│
└── README.txt                  ← plain-text note for uncle:
                                  "Bu klasör Mahmut Celayir uygulamasının veri klasörüdür.
                                   Silmeyin, taşımayın. Yedek almak için bu klasörü kopyalamak yeterli."
```

**What's NOT stored here:**
- **Original artwork images** — they stay at whatever folder uncle points to. `projects.json` only keeps paths. If he moves images, the app shows "file not found" gracefully and offers re-linking.
- **Generated PDFs** — the user picks save location via the save dialog (current behavior). We only store a reference `{ path, filename, generatedAt, artworkCount }` in `projects.json`. If the PDF is deleted, the history entry still shows but "Open" fails gracefully.

**Rationale:** we're a catalog, not a vault. Moving originals into the archive would double disk usage for hundreds of 10MB JPEGs.

---

## 4. `projects.json` shape

```json
{
  "schemaVersion": 1,
  "writtenAt": "2026-04-21T19:30:00.000Z",
  "appVersion": "0.1.1",
  "projects": [
    {
      "id": "proj_abc123",
      "name": "Kozmik Bahçe",
      "folderPath": "/Users/…/Pictures/Celayir/Kozmik Bahçe",
      "addedAt": 1714000000000,
      "imagePaths": ["/Users/…/01.jpg", "/Users/…/02.jpg"],
      "previewPaths": ["/Users/…/01.jpg", "/Users/…/02.jpg", "…"],
      "overrides": { "/Users/…/01.jpg": { "title": "Hora-1", "year": 2024 } },
      "pdfs": [
        {
          "id": "pdf_xyz789",
          "path": "/Users/…/Desktop/Kozmik Bahçe-katalog.pdf",
          "filename": "Kozmik Bahçe-katalog.pdf",
          "generatedAt": 1714200000000,
          "artworkCount": 12
        }
      ]
    }
  ]
}
```

Top-level envelope carries `schemaVersion` so future migrations work.

---

## 5. Schema migration strategy

Every read runs through `migrate(raw) → projects` which:

1. Parses JSON
2. Checks `schemaVersion`
3. Runs migrations 1→2→3→… until current
4. If the read fails at any step: write the corrupt file to `projects.json.corrupt.<timestamp>`, rename the most recent backup to `projects.json`, retry once
5. If STILL fails: return empty, show a banner in-app pointing to the backups

**Migration registration (TypeScript):**
```ts
const migrations: Record<number, (raw: any) => any> = {
  1: (v1) => ({ ...v1, /* add v2 field */ }),
  2: (v2) => ({ ... }),
};
```

**Why this is robust:**
- Future refactors: add a migration, bump `CURRENT_VERSION`, done
- Giving uncle a new build: same migrations run, data is transformed
- Downgrade protection: if app version < file version, app refuses to write (prevents silent data loss) and shows "this file was written by a newer version"

---

## 6. Atomic writes + rolling backups

**Every write to `projects.json` goes through this sequence (Rust side):**

1. Read the current `projects.json` → hold in memory as `previous`
2. Shift backups: `.backup.2` → `.backup.3`, `.backup.1` → `.backup.2`, `projects.json` → `.backup.1`
3. Write new content to `projects.json.tmp`
4. `fsync` the tmp file
5. Atomic rename `projects.json.tmp` → `projects.json`

If step 2 (backup rotation) fails, the main file is untouched. If steps 3-5 fail, we still have the backup chain.

**Backup retention:** 3 levels deep. After every write, oldest (.backup.3) is overwritten. If a user's file gets corrupted yesterday but they haven't opened the app since, they can manually restore from `.backup.2` or `.backup.3`.

**Writes are debounced** (JS side) — if multiple mutations happen within 300ms, they collapse into one write. Prevents rapid-fire writes during bulk imports.

---

## 7. Rust-side commands (Tauri invoke handlers)

New commands in `src-tauri/src/lib.rs`:

```rust
#[tauri::command]
fn archive_get_dir() -> Result<String, String>;
// Returns absolute path to the archive folder, creating it if missing.
// Reads chosen path from app data `archive-location.txt`, or defaults to ~/Desktop/Mahmut Celayir Arşivi/.

#[tauri::command]
fn archive_set_dir(path: String) -> Result<(), String>;
// Relocates: writes the new path to app data, validates the folder is writable.

#[tauri::command]
fn archive_read_projects() -> Result<String, String>;
// Returns raw JSON string. Falls back to backups if main file is missing/invalid.

#[tauri::command]
fn archive_write_projects(json: String) -> Result<(), String>;
// Atomic write with rolling backup rotation. Writes archive-meta.json too.

#[tauri::command]
fn archive_list_logo_pool() -> Result<Vec<String>, String>;

#[tauri::command]
fn archive_save_logo_crop(bytes: Vec<u8>, index: u32) -> Result<String, String>;
// Returns absolute path to saved crop.

#[tauri::command]
fn archive_clear_logo_pool() -> Result<(), String>;

#[tauri::command]
fn archive_get_current_logo() -> Result<Option<String>, String>;

#[tauri::command]
fn archive_set_current_logo(path: String) -> Result<(), String>;

#[tauri::command]
fn archive_save_dock_icon(bytes: Vec<u8>) -> Result<String, String>;

#[tauri::command]
fn archive_stats() -> Result<ArchiveStats, String>;
// { dir, projectCount, poolSize, lastWriteAt, backups: [{path, size, mtime}] }
```

**Error handling:** every command returns `Result<T, String>`. On fatal error, the JS side shows a toast with "something went wrong reading archive — check backup files manually". We never silently swallow.

---

## 8. JS-side wrapper (`src/lib/archive.ts`)

Thin, typed wrapper over `invoke`:

```ts
export async function loadProjectsFromArchive(): Promise<Project[]>;
export async function saveProjectsToArchive(projects: Project[]): Promise<void>;
// Saves with debounce; uses migration chain.

export async function getArchiveDir(): Promise<string>;
export async function relocateArchive(newDir: string): Promise<void>;

export async function saveLogoCrop(bytes: Uint8Array, index: number): Promise<string>;
export async function listLogoCrops(): Promise<string[]>;
export async function clearLogoCrops(): Promise<void>;

export async function getCurrentLogoPath(): Promise<string | null>;
export async function setCurrentLogoPath(path: string): Promise<void>;

export async function getArchiveStats(): Promise<ArchiveStats>;
```

The existing `ProjectsContext` + `LogoContext` switch from `localStorage` calls to these IPC calls.

---

## 9. Migration from current (localStorage) state

**One-time, on next app launch after this update ships:**

```ts
async function migrateFromLocalStorageIfNeeded() {
  const archiveStats = await getArchiveStats();
  if (archiveStats.projectCount > 0) return; // already migrated

  const legacyProjects = readFromLocalStorage();
  if (legacyProjects.length === 0) return; // fresh install

  // Copy projects to archive
  await saveProjectsToArchive(legacyProjects);

  // Copy logo pool (JPEGs are already in appdata; copy to archive/logo/pool)
  const poolPaths = getLegacyPoolPaths();
  for (let i = 0; i < poolPaths.length; i++) {
    const bytes = await readFile(poolPaths[i]);
    await saveLogoCrop(bytes, i);
  }

  // Mark legacy as migrated but don't delete yet —
  // keep for 30 days in case something went wrong.
  localStorage.setItem("mcelayir.migrated.to.archive", new Date().toISOString());
}
```

**After 30 days, prompt: "Delete old local data?"** → confirm → clear localStorage keys.

**Safety net:** the archive folder is authoritative from the moment migration succeeds. localStorage is read-only-legacy after that.

---

## 10. Handling edge cases

| Case | Behavior |
|---|---|
| Archive folder deleted externally | App detects on launch, shows "Archive not found — restore from backup or start fresh" with buttons |
| Archive folder moved externally | App shows same "not found" state; "Locate folder…" button opens picker |
| `projects.json` corrupt | Falls through to `.backup.1` → `.backup.2` → `.backup.3` → empty. Corrupt file renamed with timestamp. |
| User opens same archive from two Macs | Last-write-wins. Not solving for real multi-device yet. |
| Image paths broken (user moved originals) | Artwork row shows placeholder + "Image not found — [Re-link]" button that opens file picker |
| PDF path broken | "Open" button shows toast "PDF moved or deleted"; entry stays in history |
| User manually edits `projects.json` | We read it fresh; invalid changes caught by schema validation |
| Disk full during write | Atomic write fails, original file untouched, toast shows error |
| Schema version in file > app version | App refuses to write, shows "This archive was written by a newer version of the app — please update." |
| Two windows open, both write | Last rename wins; debouncing reduces collision odds |

---

## 11. What this enables for the future

Because Rust owns the folder and the schema is versioned:

- **Giving uncle a rebuilt binary** → it reads the same folder, runs migrations, works
- **Massive refactor of data model** → add migration step, ship, data transforms on first run
- **Multiple profiles** → add a dropdown in Settings, each profile = one archive folder
- **Cloud sync later** (iCloud Drive) → just move the folder there, app still opens it
- **Export for printing/archival** → `npm run archive:export` writes a zip
- **Schema inspector** → Settings page shows current version + migration history

---

## 12. What changes in the UI

1. **Settings → add section "Archive folder"**:
   - Shows current path (`~/Desktop/Mahmut Celayir Arşivi/`)
   - "Reveal in Finder" button
   - "Move archive…" button (for future Mac transfers)
   - Shows stats: `3 projects · 256 logo fragments · last saved 2 min ago · 12 MB`
   - Shows backup list with timestamps
   - "Restore from backup…" (advanced — hidden by default)

2. **First-launch banner** (one time):
   > "Mahmut Celayir archive folder created at ~/Desktop/Mahmut Celayir Arşivi/. This is where all your project data lives — back it up by copying the folder."

3. **Broken-path inline fix** in ArtworkRow:
   > Image shows a dashed placeholder, caption reads "File not found — [Re-link]"

---

## 13. Execution plan (order matters)

**Step 1 — Rust side:**
- Add `archive_*` commands in `lib.rs`
- Add `archive-meta.json` read/write
- Implement atomic write + rolling backup
- Read archive-location.txt from app-data to find chosen path (defaults to Desktop)
- `cargo check` passes

**Step 2 — JS wrapper:**
- `src/lib/archive.ts` — typed IPC wrappers
- Migrations registry

**Step 3 — Contexts switch:**
- `ProjectsContext` reads from archive on mount, writes via debounced `saveProjectsToArchive`
- `LogoContext` reads/writes via new commands
- Keep localStorage code around for migration only

**Step 4 — Migration:**
- On app mount, check `mcelayir.migrated.to.archive`
- If unset + archive empty + localStorage has data → run migration
- Persist timestamp

**Step 5 — Settings UI:**
- "Archive folder" card with path + reveal + stats
- (Deferred: "Move archive…" button — low priority)

**Step 6 — Error paths:**
- Archive not found banner
- Broken image placeholder + re-link

**Step 7 — Ship:**
- Build unsigned DMG (works with right-click-Open on first run)
- Uncle installs → first launch migrates his current data → archive folder appears on Desktop → everything works

---

## 14. Testing matrix before shipping

| Scenario | Expected |
|---|---|
| Fresh install, no legacy data | Archive created, empty state UI |
| Fresh install + localStorage has 3 projects | Migration runs, archive has 3 projects, localStorage preserved (read-only) |
| Existing archive, open app | Projects load, no re-migration |
| Delete `projects.json`, open app | Restores from `.backup.1`, warns in toast |
| Delete `projects.json` + all backups | Empty state + "archive corrupted" banner |
| Move archive folder to Documents | Next launch shows "not found" → user re-points → data loads |
| Rename a field in `Project` type | Add migration, bump version, reload — transforms happen |
| Simulate disk full | Write fails, toast error, old data intact |
| Open archive with a future-version file | Refuses to write, shows "update app" message |

---

## 15. Apple Developer deferral — what this means

**Right now:**
- Distribution = unsigned DMG → uncle does right-click → Open on first launch → Gatekeeper remembers
- Updater config stays in `tauri.conf.json` but never triggers (no signed releases published)
- Settings "About & updates" button will say "Not configured" or show last-checked error

**When Apple renews:**
- Add the 7 GitHub Actions secrets (already designed)
- Tag `v0.2.0`, CI auto-builds signed DMG + `latest.json`
- Updater wakes up, uncle gets auto-updates
- No code changes needed — just secrets

The auto-updater infrastructure is **already shipped in v0.1.1** — it's just dormant until we publish a signed release.

---

## 16. Open decisions for user

1. **Folder name:** `Mahmut Celayir Arşivi` (Turkish) or `Mahmut Celayir Archive` (English)? I'll default to Turkish unless you say otherwise.

2. **Desktop or Documents?** I'll default to Desktop (more visible). Change?

3. **README.txt in the folder?** Yes/no. I'll default to yes, Turkish, one paragraph.

4. **Auto-keep backups:** 3 levels deep (default) or more?

5. **Migration deletion:** 30 days after successful migration, prompt to delete legacy localStorage. Or different cadence?

6. **Handle broken image paths:** inline placeholder + re-link, or just skip silently?

---

**End of plan. Tell me to proceed or tweak, then I execute steps 1–7.**
