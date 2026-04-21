import { convertFileSrc } from "@tauri-apps/api/core";

const SELECTION_KEY = "mcelayir.logo.selection.v2";
const POOL_PATHS_KEY = "mcelayir.logo.pool.paths.v1";
const AUTOCROP_FLAG = "mcelayir.logo.autocrop.done.v2";
const OUT_SIZE = 192;

async function loadImageFromPath(imagePath: string): Promise<HTMLImageElement> {
  const res = await fetch(convertFileSrc(imagePath));
  if (!res.ok) throw new Error(`failed to load ${imagePath}`);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`decode failed: ${imagePath}`));
      img.src = blobUrl;
    });
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
  }
}

function randomCropToCanvas(img: HTMLImageElement, outSize = OUT_SIZE): HTMLCanvasElement {
  const short = Math.min(img.width, img.height);
  const minFrac = 0.12;
  const maxFrac = 0.42;
  const frac = minFrac + Math.random() * (maxFrac - minFrac);
  const cropSize = Math.max(32, Math.floor(short * frac));
  const sx = Math.floor(Math.random() * Math.max(1, img.width - cropSize));
  const sy = Math.floor(Math.random() * Math.max(1, img.height - cropSize));
  const canvas = document.createElement("canvas");
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas context unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, outSize, outSize);
  return canvas;
}

function canvasToJpegBytes(canvas: HTMLCanvasElement, quality = 0.82): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) return reject(new Error("canvas encode failed"));
        const buf = await blob.arrayBuffer();
        resolve(new Uint8Array(buf));
      },
      "image/jpeg",
      quality,
    );
  });
}

export type CropBytesStreamOptions = {
  onCrop: (bytes: Uint8Array, index: number, total: number) => Promise<void> | void;
  signal?: AbortSignal;
};

export async function streamCropBytes(
  imagePaths: string[],
  count: number,
  options: CropBytesStreamOptions,
): Promise<number> {
  if (imagePaths.length === 0) return 0;
  const imageCache = new Map<string, HTMLImageElement>();
  const sources = [...imagePaths].sort(() => Math.random() - 0.5);
  let sourceIdx = 0;
  let produced = 0;

  while (produced < count) {
    if (options.signal?.aborted) break;
    const path = sources[sourceIdx % sources.length];
    sourceIdx++;
    try {
      let img = imageCache.get(path);
      if (!img) {
        img = await loadImageFromPath(path);
        imageCache.set(path, img);
      }
      const canvas = randomCropToCanvas(img);
      const bytes = await canvasToJpegBytes(canvas);
      produced++;
      await options.onCrop(bytes, produced, count);
    } catch {
      // skip unreadable image
    }
    if (sourceIdx > imagePaths.length * 30) break;
  }

  return produced;
}

// ── localStorage helpers for the (tiny) metadata ─────────

export function getSavedLogoPath(): string | null {
  try {
    return localStorage.getItem(SELECTION_KEY);
  } catch {
    return null;
  }
}

export function saveLogoPath(path: string): void {
  localStorage.setItem(SELECTION_KEY, path);
}

export function clearLogoPath(): void {
  localStorage.removeItem(SELECTION_KEY);
}

type PoolEnvelope = { schemaVersion: number; paths: string[] };
const POOL_VERSION = 1;

export function getCachedPoolPaths(): string[] {
  try {
    const raw = localStorage.getItem(POOL_PATHS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed; // legacy shape
    if (parsed && typeof parsed === "object" && "paths" in parsed && Array.isArray(parsed.paths)) {
      return parsed.paths;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveCachedPoolPaths(paths: string[]): void {
  try {
    const env: PoolEnvelope = { schemaVersion: POOL_VERSION, paths };
    localStorage.setItem(POOL_PATHS_KEY, JSON.stringify(env));
  } catch {
    /* quota guard — unlikely at just paths */
  }
}

export function clearCachedPoolPaths(): void {
  localStorage.removeItem(POOL_PATHS_KEY);
}

export function hasAutoCropped(): boolean {
  return localStorage.getItem(AUTOCROP_FLAG) === "1";
}

export function markAutoCropped(): void {
  localStorage.setItem(AUTOCROP_FLAG, "1");
}

export function resetAutoCropFlag(): void {
  localStorage.removeItem(AUTOCROP_FLAG);
}
