// Thin typed wrapper over the Rust archive commands.
// All persistence goes through this module — do not import @tauri-apps/api/core
// in contexts directly.

import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import type { GeneratedPdf, Project } from "../types";

export type PdfQualityTier = "lossless" | "high" | "medium" | "low";

export type ArchiveSchemaV1 = {
  schemaVersion: 1;
  writtenAt: string;
  appVersion: string;
  projects: Project[];
  logoCurrent: string | null;
  autoSeeded: boolean;
  pdfQualityTier?: PdfQualityTier;
};

export type ArchiveState = ArchiveSchemaV1;

export const CURRENT_SCHEMA_VERSION = 1;

export type ArchiveStats = {
  dir: string;
  hasArchiveFile: boolean;
  hasBackup: boolean;
  cropCount: number;
  sizeBytes: number;
  lastWriteAt: string | null;
};

type ArchiveStatsRust = {
  dir: string;
  has_archive_file: boolean;
  has_backup: boolean;
  crop_count: number;
  size_bytes: number;
  last_write_at: string | null;
};

// ── Path resolution ─────────────────────────────────────

export async function getArchiveDir(): Promise<string> {
  return invoke<string>("archive_resolve_dir");
}

export async function relocateArchive(newPath: string): Promise<string> {
  return invoke<string>("archive_relocate", { path: newPath });
}

export async function getPdfsDir(): Promise<string> {
  return invoke<string>("archive_pdfs_dir");
}

export async function getArchiveStats(): Promise<ArchiveStats> {
  const raw = await invoke<ArchiveStatsRust>("archive_stats");
  return {
    dir: raw.dir,
    hasArchiveFile: raw.has_archive_file,
    hasBackup: raw.has_backup,
    cropCount: raw.crop_count,
    sizeBytes: raw.size_bytes,
    lastWriteAt: raw.last_write_at,
  };
}

// ── Main state read / write ─────────────────────────────

export function emptyState(appVersion: string): ArchiveState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    writtenAt: new Date().toISOString(),
    appVersion,
    projects: [],
    logoCurrent: null,
    autoSeeded: false,
    pdfQualityTier: "medium",
  };
}

const migrations: Record<number, (raw: unknown) => unknown> = {
  // 1: (v1) => ({ ...(v1 as object), /* v2 field */ }),
};

function runMigrations(raw: unknown): ArchiveState {
  if (!raw || typeof raw !== "object") {
    throw new Error("archive file is not a JSON object");
  }
  const obj = raw as Record<string, unknown>;
  let version = typeof obj.schemaVersion === "number" ? obj.schemaVersion : 0;
  let data: unknown = raw;

  if (version === 0) {
    // Unknown shape — be defensive.
    throw new Error("archive file is missing schemaVersion");
  }

  while (version < CURRENT_SCHEMA_VERSION) {
    const fn = migrations[version];
    if (!fn) throw new Error(`no migration from v${version} to v${version + 1}`);
    data = fn(data);
    version++;
  }
  return data as ArchiveState;
}

export async function readArchive(): Promise<ArchiveState | null> {
  const raw = await invoke<string | null>("archive_read");
  if (raw == null) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return runMigrations(parsed);
  } catch (err) {
    console.error("[archive] parse/migrate failed:", err);
    throw err;
  }
}

let writeQueue: Promise<void> = Promise.resolve();
let debounceTimer: number | null = null;
let pending: ArchiveState | null = null;

export async function writeArchive(state: ArchiveState): Promise<void> {
  const appVersion = await getVersion().catch(() => state.appVersion);
  const body: ArchiveState = {
    ...state,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    writtenAt: new Date().toISOString(),
    appVersion,
  };
  const json = JSON.stringify(body, null, 2);
  await invoke("archive_write", { json, appVersion });
}

/**
 * Write with 300ms debounce. Multiple calls within the window collapse into one.
 * Returns a promise resolved after the eventual write completes.
 */
export function writeArchiveDebounced(state: ArchiveState): Promise<void> {
  pending = state;
  if (debounceTimer !== null) window.clearTimeout(debounceTimer);
  return new Promise((resolve, reject) => {
    debounceTimer = window.setTimeout(() => {
      debounceTimer = null;
      const toWrite = pending;
      pending = null;
      if (!toWrite) {
        resolve();
        return;
      }
      writeQueue = writeQueue
        .then(() => writeArchive(toWrite))
        .then(resolve, reject);
    }, 300);
  });
}

export async function writeLegacyBackup(obj: unknown): Promise<void> {
  await invoke("archive_write_legacy_backup", { json: JSON.stringify(obj, null, 2) });
}

// ── Logo pool ───────────────────────────────────────────

export async function saveCrop(bytes: Uint8Array, index: number): Promise<string> {
  return invoke<string>("archive_save_crop", { bytes: Array.from(bytes), index });
}

export async function listCrops(): Promise<string[]> {
  return invoke<string[]>("archive_list_crops");
}

export async function clearCrops(): Promise<void> {
  await invoke("archive_clear_crops");
}

// ── Utility ─────────────────────────────────────────────

export function ensurePdfWithinArchive(pdf: GeneratedPdf, _archiveDir: string): GeneratedPdf {
  // Placeholder: for v1 we just accept wherever the user saved the PDF.
  // Future: if path is outside archive, offer to copy in.
  return pdf;
}

export function setLogoCurrent(state: ArchiveState, path: string | null): ArchiveState {
  return { ...state, logoCurrent: path };
}
