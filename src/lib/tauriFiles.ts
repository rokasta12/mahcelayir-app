import { open } from "@tauri-apps/plugin-dialog";
import { readDir } from "@tauri-apps/plugin-fs";

export const IMAGE_EXT = /\.(jpe?g|png)$/i;

export function isImagePath(path: string): boolean {
  return IMAGE_EXT.test(path);
}

export function basename(path: string): string {
  const idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return idx >= 0 ? path.slice(idx + 1) : path;
}

export function folderName(path: string): string {
  return basename(path.replace(/\/$/, ""));
}

export function parentDir(path: string): string {
  const idx = path.lastIndexOf("/");
  if (idx <= 0) return "";
  return path.slice(0, idx);
}

export type ExpandedPaths = {
  folderPaths: string[];
  filePaths: string[];
};

export async function expandPaths(paths: string[]): Promise<ExpandedPaths> {
  const folderPaths: string[] = [];
  const filePaths: string[] = [];
  for (const p of paths) {
    if (isImagePath(p)) {
      filePaths.push(p);
      continue;
    }
    try {
      const entries = await readDir(p);
      const images = entries
        .filter((e) => e.isFile && isImagePath(e.name))
        .map((e) => `${p}/${e.name}`)
        .sort();
      if (images.length > 0) {
        folderPaths.push(p);
        filePaths.push(...images);
      }
    } catch {
      // unreadable path; skip
    }
  }
  return { folderPaths, filePaths };
}

export async function readFolderImages(folderPath: string): Promise<string[]> {
  try {
    const entries = await readDir(folderPath);
    return entries
      .filter((e) => e.isFile && isImagePath(e.name))
      .map((e) => `${folderPath}/${e.name}`)
      .sort();
  } catch {
    return [];
  }
}

export async function pickFolder(): Promise<string[]> {
  const selected = await open({ multiple: true, directory: true });
  if (!selected) return [];
  return Array.isArray(selected) ? selected : [selected];
}

export async function pickImageFiles(): Promise<string[]> {
  const selected = await open({
    multiple: true,
    directory: false,
    filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png"] }],
  });
  if (!selected) return [];
  return Array.isArray(selected) ? selected : [selected];
}
