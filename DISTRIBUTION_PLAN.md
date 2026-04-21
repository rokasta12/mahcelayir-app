# Mahmut Celayir — Distribution, Updates & Migration Plan

**Status:** Pre-execution spec. Approved: private distribution (uncle only, no App Store / public release). Apple Developer account available under **JellyLabs**.

**Confirmed constants:**
- GitHub owner: `rokasta12` (personal account)
- Repo: `mahcelayir-app` (private, to be created)
- Updater endpoint: `https://api.github.com/repos/rokasta12/mahcelayir-app/releases/latest`
- macOS minimum: 10.15 (Catalina)
- Target arch: `x86_64-apple-darwin` (Intel Mac)

This document is the single source of truth for the distribution pipeline. Everything is executed after the secrets are collected.

---

## 0. Vision in one paragraph

The app installs once on uncle's Intel Mac (13") and then updates itself forever. A new release is one `git tag vX.Y.Z && git push --tags` away — GitHub Actions builds a signed + notarized `.app.tar.gz`, uploads it as a release asset, regenerates `latest.json`, and the running app on uncle's Mac sees the update on next launch and offers to install it. Uncle's projects, artwork paths, generated PDFs, and logo selection are never touched.

---

## 1. Guiding principles

1. **Zero-ritual updates.** Uncle clicks one button ("Install update") or sees the banner on launch. No DMG re-download, no drag-and-drop, no right-click-Open.
2. **Data is sacred.** Every schema change is a migration. Old data is never crashed on, never silently dropped.
3. **One command from developer to uncle.** Tagging a version is the only manual step. CI does the rest.
4. **Private, not public.** Source and releases live in a private GitHub repo. The updater uses a fine-grained read-only PAT scoped to releases on that repo only.
5. **Signed + notarized always.** Gatekeeper approves every build. No "unidentified developer" prompts.
6. **Rollback is free.** Past releases stay in GitHub. `latest.json` can be repointed to an older version in 30 seconds if a release is bad.

---

## 2. Architecture

```
┌────────────────────────────────────┐         ┌────────────────────────┐
│   Developer machine (this repo)    │         │  Uncle's Mac 13" Intel │
│                                    │         │                        │
│   git tag v0.2.0 && git push --tag │         │   Mahmut Celayir.app   │
└──────────────┬─────────────────────┘         │                        │
               │                                │   on launch →          │
               ▼                                │   updater.check()      │
┌────────────────────────────────────┐         │          │              │
│   GitHub Actions (macos-latest)    │         │          ▼              │
│   1. install Rust + Node           │         │   GET latest.json       │
│   2. restore signing cert          │◀────────┼──┐       │              │
│   3. tauri build --target x86_64   │         │  │       ▼              │
│   4. codesign + notarize           │         │  │  newer version? →    │
│   5. tauri signer sign .app.tar.gz │         │  │    banner + button   │
│   6. publish GitHub Release        │         │  │       │              │
│   7. regenerate latest.json        │────────▶│  │       ▼              │
└────────────────────────────────────┘         │  │  downloadAndInstall  │
                                                │  │       │              │
         GitHub Release assets:                 │  │       ▼              │
         • Mahmut Celayir_0.2.0_x64.dmg         │  │  verify minisign     │
         • Mahmut Celayir_0.2.0_x64.app.tar.gz  │  │       │              │
         • …x64.app.tar.gz.sig                  │  │       ▼              │
         • latest.json ─────────────────────────┘  └─▶  swap .app +       │
                                                       relaunch           │
                                                └────────────────────────┘
```

---

## 3. What changes in the codebase

### 3.1 New dependencies

**`src-tauri/Cargo.toml`:**
```toml
[dependencies]
# ...existing
tauri-plugin-updater = "2"
tauri-plugin-process = "2"  # for relaunch()
```

**`package.json`:**
```json
{
  "dependencies": {
    "@tauri-apps/plugin-updater": "^2",
    "@tauri-apps/plugin-process": "^2"
  }
}
```

### 3.2 `src-tauri/tauri.conf.json` additions

```json
{
  "bundle": {
    "createUpdaterArtifacts": true,
    "macOS": {
      "signingIdentity": "Developer ID Application: JellyLabs (<TEAM_ID>)",
      "minimumSystemVersion": "10.15"
    }
  },
  "plugins": {
    "updater": {
      "pubkey": "<MINISIGN_PUBLIC_KEY_CONTENT>",
      "endpoints": [
        "https://raw.githubusercontent.com/<owner>/mahmut-celayir-archive/releases/latest.json"
      ]
    }
  }
}
```

**Note:** The endpoint URL format above assumes public raw access. For a **private** repo we use the GitHub API `releases/latest` endpoint with a PAT passed via `headers`. See §4.

### 3.3 `src-tauri/src/lib.rs` — register plugins

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    // ...existing plugins
```

### 3.4 `src-tauri/capabilities/default.json`

Add permissions:
```json
{
  "permissions": [
    "updater:default",
    "process:allow-restart"
  ]
}
```

### 3.5 New file: `src/lib/updater.ts`

Thin wrapper around the plugin so React components don't touch Tauri APIs directly:

```ts
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "up_to_date"; checkedAt: number }
  | { kind: "available"; version: string; notes: string; update: Update }
  | { kind: "downloading"; progress: number; total: number }
  | { kind: "installing" }
  | { kind: "error"; message: string };

export async function checkForUpdate(): Promise<UpdateState> { ... }
export async function installUpdate(update: Update,
                                    onProgress: (d: number, t: number) => void)
                                    : Promise<void> { ... }
```

### 3.6 New file: `src/contexts/UpdateContext.tsx`

- Runs `checkForUpdate()` once on app mount (silent)
- Exposes current `UpdateState` + manual `recheck()` and `install()` methods
- Shows a toast-style banner globally if `kind === "available"`

### 3.7 `src/pages/SettingsPage.tsx` — new "About & Updates" section

- Current version (read from `@tauri-apps/api/app` → `getVersion()`)
- Last checked timestamp
- **"Check for updates"** button — triggers `recheck()`
- If available: **"Install update"** button with release notes + progress bar
- If up-to-date: muted "You're on the latest version"

### 3.8 `src/App.tsx` — mount the provider

Wrap the tree in `<UpdateProvider>` alongside `<ProjectsProvider>`, `<LogoProvider>`, `<PdfPanelProvider>`.

### 3.9 Global update banner

A small pill that slides down from the top when `state.kind === "available"`, with "Update" button and "Later" dismiss. Dismisses until next launch.

---

## 4. Private GitHub Releases strategy

### The problem
Tauri updater does an unauthenticated GET on the endpoint URL. A private repo returns 404 without auth.

### The solution
Use the endpoint + custom headers via the runtime check options:

```ts
const update = await check({
  headers: {
    Authorization: `Bearer ${GH_PAT}`,
    Accept: "application/vnd.github+json",
  },
});
```

We pass `GH_PAT` at build time via `VITE_UPDATER_PAT` env var. The PAT is:
- **Fine-grained**, scoped to only `mahmut-celayir-archive` repo
- **Read-only** access to `Contents` and `Metadata` (needed for release assets)
- Expires in 1 year; we regenerate + ship a new build before expiry

**Alternative considered:** Static-site hosting (Cloudflare Pages) with public `latest.json` pointing to GitHub release download URLs. Rejected because it adds a second deploy step and doesn't meaningfully improve privacy (binaries are signed either way).

### The endpoint URL

```
https://api.github.com/repos/<owner>/mahmut-celayir-archive/releases/latest
```

This returns GitHub's release JSON. We use a **custom manifest fetcher** in `updater.ts` that:
1. Calls the GitHub API with the PAT
2. Finds the asset named `latest.json`
3. Downloads its content via `browser_download_url` (with the same auth header)
4. Returns the Tauri-format update JSON

The updater plugin accepts multiple endpoints and falls back; we configure only the GitHub API one.

**Even simpler variant** (chosen for v1): host `latest.json` + `.app.tar.gz` as release assets; since the updater supports fetching asset URLs directly with custom headers, just set the endpoint to the asset's `browser_download_url` once known, OR — easiest of all — make the single release asset `latest.json` and have it point to the `.app.tar.gz` asset URL on the same release.

**Final chosen endpoint in `tauri.conf.json`:**
```
https://api.github.com/repos/JellyLabs-OWNER/mahmut-celayir-archive/releases/latest
```
…and `updater.ts` transforms GitHub's response into Tauri's expected shape.

---

## 5. Data migration — versioned schema

### 5.1 Current state
- `localStorage["mcelayir.projects.v1"]` → `Project[]`
- `localStorage["mcelayir.logo.selection.v2"]` → `string | null`
- `localStorage["mcelayir.logo.pool.paths.v1"]` → `string[]`
- `localStorage["mcelayir.logo.autocrop.done.v2"]` → `"1"` | absent
- File: `$APPDATA/crops/crop_NNN.jpg`

Versions are already baked into the *keys*, which works for breaking changes that rename keys — but a migration at read time is cleaner.

### 5.2 New approach — envelope with `schemaVersion`

Each stored blob becomes:

```ts
type Envelope<T> = { schemaVersion: number; data: T };
```

**`src/lib/store.ts` refactor:**

```ts
const STORAGE_KEY = "mcelayir.projects";
const CURRENT_VERSION = 2;

type ProjectV1 = { /* old shape */ };
type ProjectV2 = Project;

const migrations: Record<number, (raw: unknown) => unknown> = {
  1: (raw) => {
    // v1 → v2: example, if we add `archivedAt` field
    const arr = raw as ProjectV1[];
    return arr.map((p) => ({ ...p, archivedAt: null }));
  },
  // 2: (raw) => raw,  // when we reach v3, add here
};

function readWithMigration(): Project[] {
  const s = localStorage.getItem(STORAGE_KEY);
  if (!s) {
    // check legacy key `mcelayir.projects.v1`
    const legacy = localStorage.getItem("mcelayir.projects.v1");
    if (!legacy) return [];
    const parsed = JSON.parse(legacy);
    return runMigrations({ schemaVersion: 1, data: parsed });
  }
  const env = JSON.parse(s) as Envelope<unknown>;
  return runMigrations(env);
}

function runMigrations(env: Envelope<unknown>): Project[] {
  let { schemaVersion: v, data } = env;
  while (v < CURRENT_VERSION) {
    const fn = migrations[v];
    if (!fn) throw new Error(`No migration from v${v} to v${v + 1}`);
    data = fn(data);
    v++;
  }
  return data as Project[];
}

function write(projects: Project[]): void {
  const env: Envelope<Project[]> = { schemaVersion: CURRENT_VERSION, data: projects };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(env));
}
```

**Same pattern for** logo selection and pool paths. After first successful read+write, the legacy `.v1` keys are deleted.

### 5.3 Migration test
Add `src/lib/store.migrations.test.ts` later — not blocking v0.2.0.

### 5.4 Schema version bump checklist
When changing `Project` shape:
1. Bump `CURRENT_VERSION`
2. Add `migrations[oldVersion]` that transforms from old to new
3. Do NOT modify old type aliases (keep `ProjectV1`, `ProjectV2`, …)
4. Ship

---

## 6. Code signing + notarization

### 6.1 One-time developer machine setup

1. At developer.apple.com, create a **Developer ID Application** certificate (creates JellyLabs-signed certs for apps distributed outside the App Store).
2. Download `.cer` → double-click to add to Keychain.
3. Confirm the private key is present: `security find-identity -v -p codesigning` shows `Developer ID Application: JellyLabs (<TEAM_ID>)`.
4. Generate app-specific password at appleid.apple.com (name: `tauri-notarize`).
5. Export cert for CI: in Keychain Access, right-click the cert → Export → `.p12` with a strong password. Base64 encode:
   ```bash
   openssl base64 -A -in jellylabs-devid.p12 -out cert-b64.txt
   ```

### 6.2 Environment variables (local builds)

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: JellyLabs (<TEAM_ID>)"
export APPLE_ID="<apple-id-email>"
export APPLE_PASSWORD="<app-specific-password>"
export APPLE_TEAM_ID="<TEAM_ID>"
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/mahmut-celayir.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="<minisign-password>"
```

### 6.3 GitHub Actions secrets

| Secret name                       | Source                                 |
|-----------------------------------|----------------------------------------|
| `APPLE_CERTIFICATE`               | base64 of `.p12`                       |
| `APPLE_CERTIFICATE_PASSWORD`      | password used when exporting `.p12`    |
| `APPLE_SIGNING_IDENTITY`          | `Developer ID Application: JellyLabs …`|
| `APPLE_ID`                        | Apple ID email                         |
| `APPLE_PASSWORD`                  | app-specific password                  |
| `APPLE_TEAM_ID`                   | 10-char Team ID                        |
| `TAURI_SIGNING_PRIVATE_KEY`       | content of `~/.tauri/mahmut-celayir.key`|
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | minisign keypair password           |
| `UPDATER_PAT`                     | fine-grained GH PAT (read releases)    |

### 6.4 Verifying Gatekeeper passes

After a build:
```bash
spctl -a -vv "Mahmut Celayir.app"
# expect: accepted, source=Notarized Developer ID

stapler validate "Mahmut Celayir.app"
# expect: The validate action worked!
```

---

## 7. Minisign keypair for updater signatures

```bash
npm run tauri signer generate -- -w ~/.tauri/mahmut-celayir.key
```

- Private key → `~/.tauri/mahmut-celayir.key` (chmod 600, **never committed**)
- Public key → printed to stdout → copy entire content into `tauri.conf.json` `plugins.updater.pubkey`
- Password protects the private key; store in 1Password

Signing happens automatically during `tauri build` when `TAURI_SIGNING_PRIVATE_KEY` env var is set — produces `.app.tar.gz.sig` next to the `.app.tar.gz`.

---

## 8. GitHub Actions workflow

File: `.github/workflows/release.yml`

```yaml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - uses: dtolnay/rust-toolchain@stable
        with: { targets: x86_64-apple-darwin }

      - name: Import signing cert
        env:
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          KEYCHAIN_PASSWORD: ephemeral-ci
        run: |
          echo "$APPLE_CERTIFICATE" | base64 -d > /tmp/cert.p12
          security create-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
          security default-keychain -s build.keychain
          security unlock-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
          security import /tmp/cert.p12 -k build.keychain \
            -P "$APPLE_CERTIFICATE_PASSWORD" -T /usr/bin/codesign
          security set-key-partition-list -S apple-tool:,apple:,codesign: \
            -s -k "$KEYCHAIN_PASSWORD" build.keychain

      - run: npm ci
      - name: Build + sign + notarize
        env:
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
          VITE_UPDATER_PAT: ${{ secrets.UPDATER_PAT }}
        run: npm run tauri build -- --target x86_64-apple-darwin

      - name: Generate latest.json
        run: node scripts/make-latest-json.mjs

      - name: Upload release assets
        uses: softprops/action-gh-release@v2
        with:
          files: |
            src-tauri/target/x86_64-apple-darwin/release/bundle/dmg/*.dmg
            src-tauri/target/x86_64-apple-darwin/release/bundle/macos/*.app.tar.gz
            src-tauri/target/x86_64-apple-darwin/release/bundle/macos/*.app.tar.gz.sig
            latest.json
          body_path: RELEASE_NOTES.md  # optional per-tag notes
```

### `scripts/make-latest-json.mjs`
Reads the `.sig` file, builds the update manifest:

```js
import fs from "fs";
import path from "path";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const bundleDir = "src-tauri/target/x86_64-apple-darwin/release/bundle/macos";
const tarGz = fs.readdirSync(bundleDir).find((f) => f.endsWith(".app.tar.gz"));
const sig = fs.readFileSync(path.join(bundleDir, tarGz + ".sig"), "utf8");
const tag = process.env.GITHUB_REF_NAME; // e.g. "v0.2.0"
const owner = process.env.GITHUB_REPOSITORY; // "user/repo"

const manifest = {
  version: pkg.version,
  notes: fs.readFileSync("RELEASE_NOTES.md", "utf8"),
  pub_date: new Date().toISOString(),
  platforms: {
    "darwin-x86_64": {
      signature: sig,
      url: `https://github.com/${owner}/releases/download/${tag}/${tarGz}`,
    },
  },
};

fs.writeFileSync("latest.json", JSON.stringify(manifest, null, 2));
```

---

## 9. First-install DMG for uncle

One-time: uncle downloads `Mahmut Celayir_0.1.0_x64.dmg` from a direct link (iMessage / email / iCloud).

Because the DMG is **notarized**, double-click → drag to Applications → open → "Mahmut Celayir" is developed by JellyLabs and Apple approved. No right-click-Open dance.

### `README-for-uncle.md` (Turkish)
Short one-pager: download link, drag to Applications, double-click, done. Updates happen automatically — when he opens the app and sees "Yeni güncelleme var", he clicks "Yükle".

---

## 10. Update flow at runtime (sequence)

```
App launch
  ↓
UpdateProvider mounts
  ↓
check() with PAT in header ── GET api.github.com/.../releases/latest
                              ↓
                           release JSON
                              ↓
                           find latest.json asset URL
                              ↓
                           GET latest.json with PAT
                              ↓
                           compare versions (semver)
                              ↓
  (newer)                     (same)
  ↓                             ↓
UpdateState = "available"     UpdateState = "up_to_date"
  ↓
Banner + Settings button both visible
  ↓
User clicks "Install update"
  ↓
downloadAndInstall() with progress events
  ↓
verify minisign signature against embedded pubkey
  ↓
swap .app in place
  ↓
relaunch()
```

---

## 11. UX polish punchlist (folded into this release)

From the earlier review pass (high-priority items only — medium/low deferred):

1. Remove unused `genId` in [src/pages/ProjectEditPage.tsx:16](src/pages/ProjectEditPage.tsx:16)
2. Remove 7 dead `.hidden` CSS modifier classes in styles.css
3. Add missing `.pdf-viewer-error` styles
4. Add `aria-label` + `focus-visible` outline to LogoGrid crop cells
5. Standardize icon sizing (16px buttons, 20px nav)
6. Convert ArtworkRow `defaultValue` inputs to controlled inputs
7. Pause HoverPreview auto-cycle on hover
8. Consistent empty-state cards across HomePage / Gallery / Edit
9. Unified delete-button affordance (no surprise-hidden × buttons)
10. Status line in ProjectEditPage footer gets a container with padding

Medium items (deferred to v0.3.0): focus rings on all buttons, icon consistency audit, native FS migration of project metadata.

---

## 12. Execution phases

**Phase 1 — Secrets collection (via browser tools)**
- [ ] Fetch Team ID from developer.apple.com
- [ ] Run `security find-identity` locally to confirm signing identity (requires user to run this, or cert creation)
- [ ] Generate + retrieve app-specific password from appleid.apple.com
- [ ] Create private GitHub repo `mahmut-celayir-archive` (or confirm existing)
- [ ] Generate fine-grained PAT scoped to that repo's Contents:read, Metadata:read
- [ ] Generate minisign keypair locally
- [ ] Store all secrets in 1Password + GitHub repo secrets

**Phase 2 — Migration layer (pure frontend, zero risk)**
- [ ] Refactor `src/lib/store.ts` to envelope + migrations
- [ ] Refactor `src/lib/cropLogo.ts` localStorage helpers to same pattern
- [ ] Read-test: launch app, confirm existing projects still load

**Phase 3 — Updater wiring (frontend + Rust)**
- [ ] Add `tauri-plugin-updater`, `tauri-plugin-process` to Cargo.toml
- [ ] Add `@tauri-apps/plugin-updater`, `@tauri-apps/plugin-process` to package.json
- [ ] Register plugins in `lib.rs`
- [ ] Add capabilities: `updater:default`, `process:allow-restart`
- [ ] Write `src/lib/updater.ts` + `UpdateContext.tsx`
- [ ] Add "About & Updates" section to Settings
- [ ] Add global banner component
- [ ] Configure `tauri.conf.json` `plugins.updater.pubkey` + `endpoints`

**Phase 4 — Signing config**
- [ ] Add `bundle.macOS.signingIdentity` + `minimumSystemVersion` to tauri.conf.json
- [ ] Add `bundle.createUpdaterArtifacts: true`

**Phase 5 — CI pipeline**
- [ ] Add `.github/workflows/release.yml`
- [ ] Add `scripts/make-latest-json.mjs`
- [ ] Seed all GitHub repo secrets

**Phase 6 — UX punchlist** (see §11)

**Phase 7 — First release (v0.1.0 → v0.1.1)**
- [ ] Local dry-run: `tauri build` with signing env vars set → verify `spctl` passes
- [ ] Push test tag `v0.1.1` → verify workflow succeeds
- [ ] Verify `latest.json` structure correct
- [ ] Install v0.1.0 locally (simulated uncle's machine), let it detect v0.1.1, install, relaunch → success

**Phase 8 — Ship to uncle**
- [ ] Send v0.1.1 DMG via iMessage + README-for-uncle.md in Turkish
- [ ] Confirm he can launch + Apple Gatekeeper doesn't block
- [ ] Monitor error reports (log to file in appdata for debugging)

---

## 13. Rollback strategy

**If a release is bad:**
1. Delete that GitHub release (or mark it draft)
2. Edit previous `latest.json` asset to bump its `version` artificially above the bad one (or re-upload an older good release with a new tag)
3. Alternative: push `v<bad+1>` tagged at the previous good commit → CI rebuilds → uncle's app updates past the bad version

**Worst case:**
Uncle can redownload previous good DMG from GitHub releases and drag to Applications. His data is preserved in `~/Library/Application Support/com.mahmutcelayir.archive/`.

---

## 14. What could break and how we handle it

| Scenario | Impact | Mitigation |
|---|---|---|
| PAT expires | App can't check for updates | Notify: add timestamp-based warning "last checked >30 days ago" in Settings. Ship new PAT in next build. |
| Apple cert expires | New builds fail in CI | Recreate cert, re-export, update `APPLE_CERTIFICATE` secret |
| Notarization service down | Build fails | Retry; notarization is async, Tauri waits |
| Minisign private key lost | All future updates impossible — users must reinstall | Store in 1Password + encrypted backup on iCloud |
| Uncle's Mac on old macOS (<10.15) | App won't run | `minimumSystemVersion: 10.15` enforces at install time |
| Schema migration bug | Uncle's data corrupted | Migrations wrapped in try/catch; on failure, rename old key to `*.backup` and start fresh with warning. Never throw. |
| User launches while offline | Update check fails silently | `UpdateState = "idle"`; no banner; manual retry works when online |

---

## 15. Data migration test matrix (for phase 2 verification)

| Starting state | Expected outcome |
|---|---|
| Fresh install, no localStorage | Empty projects list |
| Has `mcelayir.projects.v1` only | Read from legacy key, write to new envelope, delete legacy |
| Has new envelope at v1 | Read + migrate to v2 if needed |
| Has garbage in envelope | Catch → start fresh + log warning (data backed up) |
| Has mixed legacy + envelope | Prefer envelope |

---

## 16. Future roadmap (post-v0.2.0, not in this pass)

- **Windows support** — uncle is Mac-only, but build pipeline is cheap to extend
- **Universal macOS binary** (arm64 + x86_64) — uncle gets Apple Silicon someday
- **Crash reporter** — Sentry or local log-to-file
- **Opt-in beta channel** — separate `beta.json` endpoint
- **Delta updates** — Tauri supports bsdiff patches; not worth it at our size
- **Localization** — Turkish UI strings for uncle-friendliness

---

## 17. Open questions for user before executing

**Resolved:**
- ✅ Distribution model: private, uncle only, auto-updater
- ✅ Apple Developer identity: JellyLabs
- ✅ Migration approach: versioned envelope with migration chain
- ✅ Update UX: launch check + manual "Install update" button in Settings + global banner

**Pending — will fetch via browser:**
- Team ID (Apple Developer → Membership)
- App-specific password (appleid.apple.com)
- Apple ID email (confirm)
- GitHub repo: new private `mahmut-celayir-archive`, or existing one?
- GitHub org/owner: personal account or JellyLabs org?

**To be run locally by user:**
- `security find-identity -v -p codesigning` → paste `Developer ID Application: JellyLabs (…)` line
- If no such line exists: walk through cert creation flow via browser

**Nothing-to-do-until-execute:**
- Minisign keypair generation (I'll do this in terminal when phase 2 starts)
- GitHub PAT generation (I'll walk user through browser flow)
- `.p12` export from Keychain (I'll guide user through GUI steps)

---

## 18. Definition of done

- [ ] Uncle's Mac shows "Mahmut Celayir — developed by JellyLabs" when opened from Gatekeeper
- [ ] App launches with uncle's existing projects intact (migration worked)
- [ ] Settings has working "About & Updates" section
- [ ] Pushing `v0.1.1` tag triggers CI → appears as banner in running app within 60 seconds of launch
- [ ] Clicking "Install update" → download → relaunch → app is v0.1.1 → data intact
- [ ] `RELEASE_NOTES.md` shows up as the banner notes
- [ ] Rollback works: pushing a fake `v0.1.2` tagged at an older commit reverts uncle's app

---

**End of plan. Awaiting secrets collection to execute.**
