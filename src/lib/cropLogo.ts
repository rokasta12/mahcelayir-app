// Pure image-cropping logic — takes source image paths, produces random
// square JPEG crops as bytes. Persistence is handled by the archive module.

import { convertFileSrc } from "@tauri-apps/api/core";

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
