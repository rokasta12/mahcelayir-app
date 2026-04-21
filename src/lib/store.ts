import type { Project, GeneratedPdf } from "../types";

const STORAGE_KEY = "mcelayir.projects";
const LEGACY_KEY = "mcelayir.projects.v1";
const BACKUP_KEY = "mcelayir.projects.backup";
const CURRENT_VERSION = 1;

type Envelope<T> = { schemaVersion: number; data: T };

const migrations: Record<number, (raw: unknown) => unknown> = {
  // 1: (raw) => raw, // future: v1 → v2 transform
};

function isEnvelope(v: unknown): v is Envelope<unknown> {
  return typeof v === "object" && v !== null && "schemaVersion" in v && "data" in v;
}

function runMigrations(env: Envelope<unknown>): Project[] {
  let { schemaVersion: version, data } = env;
  while (version < CURRENT_VERSION) {
    const migrate = migrations[version];
    if (!migrate) throw new Error(`No migration from v${version} to v${version + 1}`);
    data = migrate(data);
    version++;
  }
  return Array.isArray(data) ? (data as Project[]) : [];
}

function readRaw(): Project[] {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) {
      const parsed = JSON.parse(current);
      if (isEnvelope(parsed)) return runMigrations(parsed);
      // corrupted envelope — fall through to legacy read or empty
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      const arr = Array.isArray(parsed) ? (parsed as Project[]) : [];
      const migrated = runMigrations({ schemaVersion: 1, data: arr });
      writeRaw(migrated);
      localStorage.removeItem(LEGACY_KEY);
      return migrated;
    }
    return [];
  } catch (err) {
    console.error("[store] read failed — backing up corrupt data", err);
    const corrupt = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (corrupt) localStorage.setItem(BACKUP_KEY, corrupt);
    return [];
  }
}

function writeRaw(projects: Project[]): void {
  const env: Envelope<Project[]> = { schemaVersion: CURRENT_VERSION, data: projects };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(env));
}

export function loadProjects(): Project[] {
  return readRaw().sort((a, b) => b.addedAt - a.addedAt);
}

export function getProject(id: string): Project | undefined {
  return readRaw().find((p) => p.id === id);
}

export function upsertProject(project: Project): void {
  const all = readRaw();
  const idx = all.findIndex((p) => p.id === project.id);
  if (idx >= 0) all[idx] = project;
  else all.push(project);
  writeRaw(all);
}

export function removeProject(id: string): void {
  writeRaw(readRaw().filter((p) => p.id !== id));
}

export function addPdfToProject(projectId: string, pdf: GeneratedPdf): void {
  const all = readRaw();
  const proj = all.find((p) => p.id === projectId);
  if (!proj) return;
  proj.pdfs = [pdf, ...proj.pdfs];
  writeRaw(all);
}

export function removePdfFromProject(projectId: string, pdfId: string): void {
  const all = readRaw();
  const proj = all.find((p) => p.id === projectId);
  if (!proj) return;
  proj.pdfs = proj.pdfs.filter((p) => p.id !== pdfId);
  writeRaw(all);
}
