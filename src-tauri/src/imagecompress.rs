// Image decoding + downscale + JPEG re-encode for PDF generation.
//
// Reads any format the `image` crate supports, downsamples if the long
// edge exceeds `max_dim`, and returns JPEG bytes at the requested quality.
// Keeps the JS side dumb: it always receives JPEG, never has to sniff format
// or worry about transparency (artwork photos don't need it).

use image::{codecs::jpeg::JpegEncoder, imageops::FilterType, DynamicImage, ImageReader};
use std::io::Cursor;

#[tauri::command]
pub fn image_compress_for_pdf(
    path: String,
    max_dim: u32,
    quality: u8,
) -> Result<Vec<u8>, String> {
    let reader = ImageReader::open(&path)
        .map_err(|e| format!("open {path}: {e}"))?
        .with_guessed_format()
        .map_err(|e| format!("guess format {path}: {e}"))?;

    let mut img: DynamicImage = reader
        .decode()
        .map_err(|e| format!("decode {path}: {e}"))?;

    let (w, h) = (img.width(), img.height());
    let longest = w.max(h);
    if longest > max_dim {
        let scale = max_dim as f32 / longest as f32;
        let new_w = (w as f32 * scale).round().max(1.0) as u32;
        let new_h = (h as f32 * scale).round().max(1.0) as u32;
        img = img.resize(new_w, new_h, FilterType::Lanczos3);
    }

    // JPEG has no alpha channel — flatten into RGB to avoid the encoder
    // complaining or silently dropping data.
    let rgb = img.into_rgb8();

    let mut buf: Vec<u8> = Vec::with_capacity(256 * 1024);
    {
        let mut encoder = JpegEncoder::new_with_quality(Cursor::new(&mut buf), quality);
        encoder
            .encode(rgb.as_raw(), rgb.width(), rgb.height(), image::ExtendedColorType::Rgb8)
            .map_err(|e| format!("encode jpeg: {e}"))?;
    }
    Ok(buf)
}
