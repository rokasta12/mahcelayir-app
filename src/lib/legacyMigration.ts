// One-time migration from localStorage (+ appdata crops) to the archive folder.
//
// Runs on first launch after the archive-based storage ships. Reads every
// piece of persisted state from the old locations, writes it into the new
// archive.json, and copies crop JPEGs into the new pool folder. The old
// localStorage keys are kept (read-only) until the user confirms migration
// via the "Clear legacy data" button in Settings.

import { appDataDir, join } from "@tauri-apps/api/path";
import { exists, readDir, readFile } from "@tauri-apps/plugin-fs";
import type { Project } from "../types";
import {
  emptyState,
  saveCrop,
  writeArchive,
  writeLegacyBackup,
  type ArchiveState,
} from "./archive";

const PROJECTS_KEY_CURRENT = "mcelayir.projects";
const PROJECTS_KEY_LEGACY = "mcelayir.projects.v1";
const LOGO_PATH_KEY = "mcelayir.logo.selection.v2";
const AUTOCROP_FLAG = "mcelayir.logo.autocrop.done.v2";
const MIGRATION_DONE_KEY = "mcelayir.migrated.to.archive";

function readProjectsFromLocalStorage(): Project[] {
  try {
    // Prefer the envelope form.
    const env = localStorage.getItem(PROJECTS_KEY_CURRENT);
    if (env) {
      const parsed = JSON.parse(env);
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.data)) {
        return parsed.data as Project[];
      }
      if (Array.isArray(parsed)) return parsed as Project[];
    }
    const legacy = localStorage.getItem(PROJECTS_KEY_LEGACY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed)) return parsed as Project[];
    }
    return [];
  } catch (err) {
    console.warn("[legacyMigration] read projects failed:", err);
    return [];
  }
}

function readLogoPath(): string | null {
  try {
    return localStorage.getItem(LOGO_PATH_KEY);
  } catch {
    return null;
  }
}

function readAutoCropped(): boolean {
  try {
    return localStorage.getItem(AUTOCROP_FLAG) === "1";
  } catch {
    return false;
  }
}

async function listLegacyCropBytes(): Promise<Array<{ index: number; bytes: Uint8Array }>> {
  try {
    const base = await appDataDir();
    const cropsDir = await join(base, "crops");
    if (!(await exists(cropsDir))) return [];
    const entries = await readDir(cropsDir);
    const result: Array<{ index: number; bytes: Uint8Array }> = [];
    for (const entry of entries) {
      if (!entry.isFile || !entry.name.endsWith(".jpg")) continue;
      const match = /^crop_(\d+)\.jpg$/.exec(entry.name);
      const index = match ? parseInt(match[1], 10) : result.length;
      const full = await join(cropsDir, entry.name);
      const bytes = await readFile(full);
      result.push({ index, bytes });
    }
    return result.sort((a, b) => a.index - b.index);
  } catch (err) {
    console.warn("[legacyMigration] list crops failed:", err);
    return [];
  }
}

function hasLegacyData(): boolean {
  return (
    localStorage.getItem(PROJECTS_KEY_CURRENT) !== null ||
    localStorage.getItem(PROJECTS_KEY_LEGACY) !== null ||
    localStorage.getItem(LOGO_PATH_KEY) !== null
  );
}

function wasMigrated(): boolean {
  return localStorage.getItem(MIGRATION_DONE_KEY) !== null;
}

function markMigrated(): void {
  try {
    localStorage.setItem(MIGRATION_DONE_KEY, new Date().toISOString());
  } catch {
    /* quota or private mode — non-fatal */
  }
}

/**
 * Runs exactly once per device. Returns the migrated ArchiveState
 * (or `null` if there was nothing to migrate).
 *
 * Safe to call unconditionally — it no-ops when:
 *   - Already migrated (flag set)
 *   - No legacy data in localStorage
 *
 * Preserves legacy data in localStorage as read-only backup. Writes a
 * `legacy-backup.json` into the archive folder as a belt-and-suspenders copy.
 */
export async function runLegacyMigrationIfNeeded(appVersion: string): Promise<ArchiveState | null> {
  if (wasMigrated() || !hasLegacyData()) return null;

  try {
    const projects = readProjectsFromLocalStorage();
    const logoCurrent = readLogoPath();
    const autoSeeded = readAutoCropped();

    const state: ArchiveState = {
      ...emptyState(appVersion),
      projects,
      logoCurrent,
      autoSeeded,
    };

    // Write archive.json first — this is the new source of truth.
    await writeArchive(state);

    // Copy crop JPEGs into the new pool folder.
    const legacyCrops = await listLegacyCropBytes();
    const newPoolPaths: string[] = [];
    for (const crop of legacyCrops) {
      try {
        const newPath = await saveCrop(crop.bytes, crop.index);
        newPoolPaths.push(newPath);
      } catch (err) {
        console.warn(`[legacyMigration] crop ${crop.index} copy failed:`, err);
      }
    }

    // If the saved logoCurrent points at the old appdata path, try to
    // remap to the corresponding new path by matching the crop_NNN filename.
    if (logoCurrent && !newPoolPaths.includes(logoCurrent)) {
      const match = /crop_(\d+)\.jpg$/.exec(logoCurrent);
      if (match) {
        const idx = parseInt(match[1], 10);
        const remapped = newPoolPaths.find((p) => p.endsWith(`crop_${String(idx).padStart(3, "0")}.jpg`));
        if (remapped) {
          state.logoCurrent = remapped;
          await writeArchive(state);
        } else {
          // No match — clear so the UI picks a valid fragment.
          state.logoCurrent = null;
          await writeArchive(state);
        }
      } else {
        state.logoCurrent = null;
        await writeArchive(state);
      }
    }

    // Write belt-and-suspenders legacy backup into the archive folder.
    const legacySnapshot = {
      migratedAt: new Date().toISOString(),
      projects,
      logoCurrent,
      autoSeeded,
      localStorageKeys: Object.keys(localStorage).filter((k) => k.startsWith("mcelayir.")),
    };
    await writeLegacyBackup(legacySnapshot);

    markMigrated();
    console.log(
      `[legacyMigration] migrated ${projects.length} projects + ${newPoolPaths.length} crops`,
    );
    return state;
  } catch (err) {
    console.error("[legacyMigration] migration failed:", err);
    // Don't mark as migrated — user can retry on next launch.
    return null;
  }
}
