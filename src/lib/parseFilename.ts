import type { ParsedFilename } from "../types";

/**
 * Tolerant filename parser. Works by extracting known shapes (year, dimensions)
 * from wherever they appear, instead of assuming part positions.
 *
 * Handles all observed quirks:
 *   - Commas OR periods as separators ("Kral Yolu. tuval üzeri...")
 *   - Dimensions as "NxN", "NxN cm", or "N cm capinda/çapında" (circles)
 *   - Year embedded in the middle of a part or missing entirely
 *   - Trailing commas, "2025jpg", extra whitespace
 *   - Untitled files (3-part medium/dims/year) → title = "İsimsiz"
 *   - Number-prefixed medium ("41-Tuval üzeri...") → title = "41"
 *
 * Returns null only when nothing useful can be extracted.
 */
export function parseFilename(filename: string): ParsedFilename | null {
  let stem = filename.replace(/\.(jpe?g|png)$/i, "").trim();
  stem = stem.replace(/jpg$/i, "").trim();
  stem = stem.replace(/(-\d+)\.(?=\S)/, "$1,");

  // Split on commas OR periods-before-whitespace (handles "Title. medium...").
  const parts = stem
    .split(/,|\.(?=\s+)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length === 0) return null;

  // 1. Pull out year (last 4-digit match, 19xx or 20xx preferred).
  let year: number | null = null;
  for (let i = parts.length - 1; i >= 0; i--) {
    const exact = parts[i].match(/^(\d{4})$/);
    if (exact) {
      year = parseInt(exact[1], 10);
      parts.splice(i, 1);
      break;
    }
    const embedded = parts[i].match(/\b((?:19|20)\d{2})\b/);
    if (embedded) {
      year = parseInt(embedded[1], 10);
      const cleaned = parts[i]
        .replace(embedded[1], "")
        .replace(/^[\s,]+|[\s,]+$/g, "")
        .trim();
      if (cleaned) parts[i] = cleaned;
      else parts.splice(i, 1);
      break;
    }
  }

  // 2. Pull out dimensions (rectangle NxN first, then circular "N cm capinda").
  let dimensions = "";
  const rectRegex = /(\d+\s*x\s*\d+(?:\s*cm)?)/i;
  const circleRegex = /(\d+\s*cm\s*(?:capinda|çapında|diameter))/i;
  for (let i = 0; i < parts.length; i++) {
    const m = parts[i].match(rectRegex) || parts[i].match(circleRegex);
    if (m) {
      dimensions = m[1].replace(/\s+/g, " ").trim();
      const cleaned = parts[i]
        .replace(m[1], "")
        .replace(/^[\s,]+|[\s,]+$/g, "")
        .trim();
      if (cleaned) parts[i] = cleaned;
      else parts.splice(i, 1);
      break;
    }
  }

  // 3. Whatever's left is title + medium.
  let title = "";
  let medium = "";
  if (parts.length === 1) {
    const leading = parts[0].match(/^(\d+)[\s\-–—]+(.+)$/);
    if (leading) {
      title = leading[1];
      medium = leading[2].trim();
    } else {
      title = "İsimsiz";
      medium = parts[0];
    }
  } else if (parts.length >= 2) {
    title = parts[0];
    medium = parts.slice(1).join(", ");
  } else if (year !== null || dimensions) {
    title = "İsimsiz";
  } else {
    return null;
  }

  return { title, medium, dimensions, year };
}
