import { convertFileSrc } from "@tauri-apps/api/core";
import { writeFile } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";

const ICON_SIZE = 1024;
// Apple's macOS icon safe-area ratio is ~9% of the full tile
const MARGIN_RATIO = 0.088;
// macOS/iOS squircle radius proportion — roughly 22.37% of inner size
const CORNER_RADIUS_RATIO = 0.2237;

async function loadImage(path: string): Promise<HTMLImageElement> {
  const res = await fetch(convertFileSrc(path));
  if (!res.ok) throw new Error(`icon source unreachable: ${path}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("decode failed"));
      img.src = url;
    });
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

function drawRoundedSquare(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + size - radius, y);
  ctx.quadraticCurveTo(x + size, y, x + size, y + radius);
  ctx.lineTo(x + size, y + size - radius);
  ctx.quadraticCurveTo(x + size, y + size, x + size - radius, y + size);
  ctx.lineTo(x + radius, y + size);
  ctx.quadraticCurveTo(x, y + size, x, y + size - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) return reject(new Error("encode failed"));
        const ab = await blob.arrayBuffer();
        resolve(new Uint8Array(ab));
      },
      "image/png",
    );
  });
}

/**
 * Builds a macOS-shaped Dock icon (transparent margins + squircle mask + the
 * crop inside it) and writes it to the app data dir. Returns the path.
 *
 * The resulting file is overwritten each time so the Dock picks up the new
 * image reliably.
 */
export async function composeDockIcon(cropPath: string): Promise<string> {
  const img = await loadImage(cropPath);

  const canvas = document.createElement("canvas");
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");

  ctx.clearRect(0, 0, ICON_SIZE, ICON_SIZE);

  const margin = Math.round(ICON_SIZE * MARGIN_RATIO);
  const innerSize = ICON_SIZE - margin * 2;
  const radius = Math.round(innerSize * CORNER_RADIUS_RATIO);

  // Soft outer drop-shadow so the icon reads cleanly on any Dock background
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.28)";
  ctx.shadowBlur = Math.round(ICON_SIZE * 0.03);
  ctx.shadowOffsetY = Math.round(ICON_SIZE * 0.012);
  ctx.fillStyle = "#000";
  drawRoundedSquare(ctx, margin, margin, innerSize, radius);
  ctx.fill();
  ctx.restore();

  // Clip to the squircle and paint the image at cover-fit
  ctx.save();
  drawRoundedSquare(ctx, margin, margin, innerSize, radius);
  ctx.clip();

  const scale = innerSize / Math.min(img.width, img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const dx = margin + (innerSize - drawW) / 2;
  const dy = margin + (innerSize - drawH) / 2;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, dx, dy, drawW, drawH);

  // Subtle inner highlight — mimics the gloss of Apple icons without looking fake
  const grad = ctx.createLinearGradient(0, margin, 0, margin + innerSize);
  grad.addColorStop(0, "rgba(255, 255, 255, 0.10)");
  grad.addColorStop(0.5, "rgba(255, 255, 255, 0)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0.06)");
  ctx.fillStyle = grad;
  ctx.fillRect(margin, margin, innerSize, innerSize);

  ctx.restore();

  const bytes = await canvasToPngBytes(canvas);
  const base = await appDataDir();
  const iconPath = await join(base, "dock-icon.png");
  await writeFile(iconPath, bytes);
  return iconPath;
}
