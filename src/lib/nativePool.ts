import { appDataDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, readDir, remove, writeFile } from "@tauri-apps/plugin-fs";

const CROPS_DIR_NAME = "crops";

let cachedCropsDir: string | null = null;

async function cropsDir(): Promise<string> {
  if (cachedCropsDir) return cachedCropsDir;
  const base = await appDataDir();
  const path = await join(base, CROPS_DIR_NAME);
  cachedCropsDir = path;
  return path;
}

async function ensureCropsDir(): Promise<string> {
  const dir = await cropsDir();
  try {
    const here = await exists(dir);
    if (!here) await mkdir(dir, { recursive: true });
  } catch {
    try {
      await mkdir(dir, { recursive: true });
    } catch {
      /* already exists or permission issue */
    }
  }
  return dir;
}

export async function saveCropToFile(bytes: Uint8Array, index: number): Promise<string> {
  const dir = await ensureCropsDir();
  const name = `crop_${String(index).padStart(3, "0")}.jpg`;
  const path = await join(dir, name);
  await writeFile(path, bytes);
  return path;
}

export async function listCropFiles(): Promise<string[]> {
  try {
    const dir = await cropsDir();
    const entries = await readDir(dir);
    return entries
      .filter((e) => e.isFile && e.name.endsWith(".jpg"))
      .map((e) => `${dir}/${e.name}`)
      .sort();
  } catch {
    return [];
  }
}

export async function clearCropFiles(): Promise<void> {
  try {
    const dir = await cropsDir();
    const entries = await readDir(dir);
    await Promise.all(
      entries
        .filter((e) => e.isFile)
        .map((e) => remove(`${dir}/${e.name}`).catch(() => undefined)),
    );
  } catch {
    /* directory missing — nothing to clear */
  }
}
