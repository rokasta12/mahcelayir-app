import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { convertFileSrc } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { resolveResource, join as joinPath } from "@tauri-apps/api/path";
import { getPdfsDir } from "./archive";
import type { Artwork } from "../types";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 40;
const CAPTION_BLOCK_HEIGHT = 90;
const BG_COLOR = rgb(0.97, 0.965, 0.95);

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

async function loadFont(doc: PDFDocument, filename: string): Promise<PDFFont> {
  const resourcePath = await resolveResource(`fonts/${filename}`);
  const bytes = await fetchBytes(convertFileSrc(resourcePath));
  return await doc.embedFont(bytes, { subset: true });
}

async function embedArtworkImage(doc: PDFDocument, path: string) {
  const bytes = await fetchBytes(convertFileSrc(path));
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return await doc.embedPng(bytes);
  return await doc.embedJpg(bytes);
}

function drawCaption(
  page: PDFPage,
  artwork: Artwork,
  fontRegular: PDFFont,
  fontBold: PDFFont,
) {
  const baseY = MARGIN + CAPTION_BLOCK_HEIGHT - 20;
  const textColor = rgb(0.12, 0.11, 0.1);
  const mutedColor = rgb(0.45, 0.43, 0.4);

  page.drawText(artwork.title, {
    x: MARGIN,
    y: baseY,
    size: 13,
    font: fontBold,
    color: textColor,
  });

  const mediumLine = artwork.medium;
  page.drawText(mediumLine, {
    x: MARGIN,
    y: baseY - 18,
    size: 10,
    font: fontRegular,
    color: mutedColor,
  });

  const dimsYear = [artwork.dimensions, artwork.year ?? ""]
    .filter(Boolean)
    .join(", ");
  page.drawText(dimsYear, {
    x: MARGIN,
    y: baseY - 34,
    size: 10,
    font: fontRegular,
    color: mutedColor,
  });
}

export type GenerateResult = {
  path: string;
  artworkCount: number;
  skipped: { filename: string; reason: string }[];
};

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "-").trim() || "katalog";
}

export async function generatePdf(artworks: Artwork[], projectName?: string): Promise<GenerateResult | null> {
  const valid = artworks.filter((a) => a.valid);
  if (valid.length === 0) throw new Error("No valid artworks to include.");

  // Default into the archive's pdfs/ subfolder so uncle always knows where
  // catalogs live. User can still pick elsewhere via the save dialog.
  let defaultPath = "katalog.pdf";
  try {
    const pdfsDir = await getPdfsDir();
    const base = projectName ? sanitizeFilename(projectName) : "katalog";
    const stamp = new Date().toISOString().slice(0, 10);
    defaultPath = await joinPath(pdfsDir, `${base}-${stamp}.pdf`);
  } catch {
    /* fall through to plain filename — dialog will still work */
  }

  const outputPath = await save({
    defaultPath,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!outputPath) return null;

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [fontRegular, fontBold] = await Promise.all([
    loadFont(doc, "NotoSans-Regular.ttf"),
    loadFont(doc, "NotoSans-Bold.ttf"),
  ]);

  const imageAreaTop = A4_HEIGHT - MARGIN;
  const imageAreaBottom = MARGIN + CAPTION_BLOCK_HEIGHT;
  const imageAreaHeight = imageAreaTop - imageAreaBottom;
  const imageAreaWidth = A4_WIDTH - MARGIN * 2;

  const skipped: { filename: string; reason: string }[] = [];
  let embedded = 0;

  for (const artwork of valid) {
    let img;
    try {
      img = await embedArtworkImage(doc, artwork.path);
    } catch (err) {
      skipped.push({
        filename: artwork.filename,
        reason: err instanceof Error ? err.message : "unreadable image",
      });
      continue;
    }

    const page = doc.addPage([A4_WIDTH, A4_HEIGHT]);
    page.drawRectangle({
      x: 0, y: 0, width: A4_WIDTH, height: A4_HEIGHT, color: BG_COLOR,
    });

    const scale = Math.min(imageAreaWidth / img.width, imageAreaHeight / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const drawX = (A4_WIDTH - drawW) / 2;
    const drawY = imageAreaBottom + (imageAreaHeight - drawH) / 2;

    page.drawImage(img, { x: drawX, y: drawY, width: drawW, height: drawH });
    drawCaption(page, artwork, fontRegular, fontBold);
    embedded++;
  }

  if (embedded === 0) {
    throw new Error("Could not read any of the selected images.");
  }

  const pdfBytes = await doc.save();
  await writeFile(outputPath, pdfBytes);
  return { path: outputPath, artworkCount: embedded, skipped };
}
