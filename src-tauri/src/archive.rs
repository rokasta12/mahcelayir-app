// Archive folder persistence — the source of truth for all user data.
//
// Lives at ~/Desktop/Mahmut Celayir/ by default. User can relocate
// (e.g. to an external drive) via `archive_relocate`. The chosen path
// is persisted at <app_data>/archive-location.txt.
//
// Writes are atomic (tmp + rename) and take a one-deep backup — we snapshot
// the current file to `.backup` before writing. If the write fails,
// the previous version is still on disk at either the target or `.backup`.

use serde::Serialize;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const DEFAULT_FOLDER_NAME: &str = "Mahmut Celayir";
const LOCATION_POINTER: &str = "archive-location.txt";
const ARCHIVE_FILE: &str = "archive.json";
const ARCHIVE_BACKUP: &str = "archive.json.backup";
const META_FILE: &str = "archive-meta.json";
const LEGACY_BACKUP_FILE: &str = "legacy-backup.json";
const README_FILENAME: &str = "readme.txt";

const README_TR: &str = "Mahmut Celayir uygulamasının veri klasörü.\n\
Bu klasör silinmemeli, taşınmamalıdır. \
Tüm projeler, logo seçimi ve oluşturulan PDF'ler burada saklanır.\n\n\
Yedek almak için bu klasörü başka bir diske kopyalamak yeterlidir.\n";

#[derive(Serialize, Debug)]
pub struct ArchiveStats {
    pub dir: String,
    pub has_archive_file: bool,
    pub has_backup: bool,
    pub crop_count: usize,
    pub size_bytes: u64,
    pub last_write_at: Option<String>,
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))
}

fn location_pointer(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join(LOCATION_POINTER))
}

fn default_archive_root(app: &AppHandle) -> Result<PathBuf, String> {
    // Prefer Desktop; fall back to home if Desktop somehow missing.
    let root = app
        .path()
        .desktop_dir()
        .or_else(|_| app.path().home_dir())
        .map_err(|e| format!("desktop/home dir: {e}"))?;
    Ok(root.join(DEFAULT_FOLDER_NAME))
}

pub fn resolve_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let pointer = location_pointer(app)?;
    if pointer.exists() {
        let raw = fs::read_to_string(&pointer)
            .map_err(|e| format!("read location pointer: {e}"))?;
        let trimmed = raw.trim();
        if !trimmed.is_empty() {
            let path = PathBuf::from(trimmed);
            if path.exists() {
                return Ok(path);
            }
            // Pointer is stale (user deleted folder externally) — fall through.
        }
    }
    default_archive_root(app)
}

fn ensure_structure(dir: &Path) -> Result<(), String> {
    fs::create_dir_all(dir)
        .map_err(|e| format!("create {}: {}", dir.display(), e))?;
    fs::create_dir_all(dir.join("logo/pool"))
        .map_err(|e| format!("create logo/pool: {e}"))?;
    fs::create_dir_all(dir.join("pdfs"))
        .map_err(|e| format!("create pdfs: {e}"))?;

    let readme = dir.join(README_FILENAME);
    if !readme.exists() {
        let _ = fs::write(&readme, README_TR);
    }
    Ok(())
}

fn atomic_write_with_backup(dir: &Path, filename: &str, content: &[u8]) -> Result<(), String> {
    let target = dir.join(filename);
    let backup = dir.join(format!("{}.backup", filename));
    let tmp = dir.join(format!("{}.tmp", filename));

    // Best-effort snapshot: copy current → backup (if current exists).
    if target.exists() {
        if let Err(e) = fs::copy(&target, &backup) {
            // Don't abort the write — but log it.
            eprintln!("[archive] backup copy failed: {e}");
        }
    }

    // Atomic write: write tmp, fsync, rename.
    {
        let mut file = fs::File::create(&tmp).map_err(|e| format!("create tmp: {e}"))?;
        file.write_all(content).map_err(|e| format!("write tmp: {e}"))?;
        file.sync_all().map_err(|e| format!("fsync tmp: {e}"))?;
    }
    fs::rename(&tmp, &target).map_err(|e| format!("rename tmp: {e}"))?;
    Ok(())
}

fn write_meta(dir: &Path, app_version: &str) -> Result<(), String> {
    let now = chrono_like_iso8601();
    let body = format!(
        "{{\n  \"schemaVersion\": 1,\n  \"lastWriteAt\": \"{}\",\n  \"appVersion\": \"{}\"\n}}\n",
        now, app_version
    );
    fs::write(dir.join(META_FILE), body).map_err(|e| format!("write meta: {e}"))
}

fn chrono_like_iso8601() -> String {
    // Minimal ISO-8601 without pulling chrono as a dependency.
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;
    // Rough conversion — good enough for "when did we last write" display.
    let secs = now / 1000;
    let ms = now % 1000;
    // Use a sortable format; exact timezone not critical for our display.
    format!("{}.{:03}Z-epoch-ms", secs, ms)
}

#[tauri::command]
pub fn archive_resolve_dir(app: AppHandle) -> Result<String, String> {
    let dir = resolve_dir(&app)?;
    ensure_structure(&dir)?;
    Ok(dir.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn archive_relocate(app: AppHandle, path: String) -> Result<String, String> {
    let new_dir = PathBuf::from(&path);
    ensure_structure(&new_dir)?;
    // Write pointer so future launches find it.
    let pointer = location_pointer(&app)?;
    if let Some(parent) = pointer.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create app_data: {e}"))?;
    }
    fs::write(&pointer, new_dir.to_string_lossy().as_bytes())
        .map_err(|e| format!("write pointer: {e}"))?;
    Ok(new_dir.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn archive_read(app: AppHandle) -> Result<Option<String>, String> {
    let dir = resolve_dir(&app)?;
    ensure_structure(&dir)?;
    let main = dir.join(ARCHIVE_FILE);
    if main.exists() {
        return fs::read_to_string(&main)
            .map(Some)
            .map_err(|e| format!("read archive: {e}"));
    }
    // Try backup.
    let backup = dir.join(ARCHIVE_BACKUP);
    if backup.exists() {
        return fs::read_to_string(&backup)
            .map(Some)
            .map_err(|e| format!("read backup: {e}"));
    }
    Ok(None)
}

#[tauri::command]
pub fn archive_write(app: AppHandle, json: String, app_version: String) -> Result<(), String> {
    let dir = resolve_dir(&app)?;
    ensure_structure(&dir)?;
    atomic_write_with_backup(&dir, ARCHIVE_FILE, json.as_bytes())?;
    write_meta(&dir, &app_version)?;
    Ok(())
}

#[tauri::command]
pub fn archive_write_legacy_backup(app: AppHandle, json: String) -> Result<(), String> {
    let dir = resolve_dir(&app)?;
    ensure_structure(&dir)?;
    fs::write(dir.join(LEGACY_BACKUP_FILE), json).map_err(|e| format!("write legacy: {e}"))
}

#[tauri::command]
pub fn archive_save_crop(app: AppHandle, bytes: Vec<u8>, index: u32) -> Result<String, String> {
    let dir = resolve_dir(&app)?;
    let pool = dir.join("logo/pool");
    fs::create_dir_all(&pool).map_err(|e| format!("ensure pool: {e}"))?;
    let filename = format!("crop_{:03}.jpg", index);
    let path = pool.join(&filename);
    fs::write(&path, bytes).map_err(|e| format!("write crop: {e}"))?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn archive_list_crops(app: AppHandle) -> Result<Vec<String>, String> {
    let dir = resolve_dir(&app)?;
    let pool = dir.join("logo/pool");
    if !pool.exists() {
        return Ok(Vec::new());
    }
    let mut out: Vec<String> = Vec::new();
    for entry in fs::read_dir(&pool).map_err(|e| format!("read pool: {e}"))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let p = entry.path();
        if p.extension().and_then(|s| s.to_str()) == Some("jpg") {
            out.push(p.to_string_lossy().into_owned());
        }
    }
    out.sort();
    Ok(out)
}

#[tauri::command]
pub fn archive_clear_crops(app: AppHandle) -> Result<(), String> {
    let dir = resolve_dir(&app)?;
    let pool = dir.join("logo/pool");
    if !pool.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(&pool).map_err(|e| format!("read pool: {e}"))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let p = entry.path();
        if p.is_file() {
            let _ = fs::remove_file(p);
        }
    }
    Ok(())
}

#[tauri::command]
pub fn archive_pdfs_dir(app: AppHandle) -> Result<String, String> {
    let dir = resolve_dir(&app)?;
    ensure_structure(&dir)?;
    Ok(dir.join("pdfs").to_string_lossy().into_owned())
}

#[tauri::command]
pub fn archive_stats(app: AppHandle) -> Result<ArchiveStats, String> {
    let dir = resolve_dir(&app)?;
    let main = dir.join(ARCHIVE_FILE);
    let backup = dir.join(ARCHIVE_BACKUP);
    let pool = dir.join("logo/pool");

    let has_archive_file = main.exists();
    let has_backup = backup.exists();

    let crop_count = if pool.exists() {
        fs::read_dir(&pool)
            .map(|it| {
                it.filter_map(|e| e.ok())
                    .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("jpg"))
                    .count()
            })
            .unwrap_or(0)
    } else {
        0
    };

    let size_bytes = dir_size(&dir).unwrap_or(0);

    let last_write_at = fs::metadata(&main)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| format!("{}", d.as_millis()));

    Ok(ArchiveStats {
        dir: dir.to_string_lossy().into_owned(),
        has_archive_file,
        has_backup,
        crop_count,
        size_bytes,
        last_write_at,
    })
}

fn dir_size(dir: &Path) -> std::io::Result<u64> {
    let mut total: u64 = 0;
    if !dir.exists() {
        return Ok(0);
    }
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let meta = entry.metadata()?;
        if meta.is_dir() {
            total = total.saturating_add(dir_size(&entry.path())?);
        } else {
            total = total.saturating_add(meta.len());
        }
    }
    Ok(total)
}
