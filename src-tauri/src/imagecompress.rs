// Image decoding + downscale + (re-)encode for PDF generation.
//
// Four quality tiers, matching the picker UX in the frontend:
//
//   Lossless — embed the source bytes untouched (JPEG or PNG); no decode.
//              Fallback: decode unknown formats and re-encode as PNG.
//   High     — 2400px long edge, mozjpeg quality 92
//   Medium   — 1800px long edge, mozjpeg quality 82   (default)
//   Low      — 1200px long edge, mozjpeg quality 70
//
// The encoder is `mozjpeg` (industry-standard JPEG with progressive encoding
// and optimized Huffman tables) — consistently 10-20% smaller than libjpeg
// defaults at the same perceived quality. Falls back to the pure-Rust
// `image` crate encoder if mozjpeg can't be invoked for any reason.

use image::{imageops::FilterType, DynamicImage, ImageFormat, ImageReader};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Cursor;

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum QualityTier {
    Lossless,
    High,
    Medium,
    Low,
}

impl Default for QualityTier {
    fn default() -> Self {
        QualityTier::Medium
    }
}

struct TierParams {
    max_dim: u32,
    jpeg_quality: f32,
}

impl QualityTier {
    fn params(self) -> Option<TierParams> {
        match self {
            QualityTier::Lossless => None,
            QualityTier::High => Some(TierParams { max_dim: 2400, jpeg_quality: 92.0 }),
            QualityTier::Medium => Some(TierParams { max_dim: 1800, jpeg_quality: 82.0 }),
            QualityTier::Low => Some(TierParams { max_dim: 1200, jpeg_quality: 70.0 }),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct CompressedImage {
    pub bytes: Vec<u8>,
    pub format: &'static str, // "jpg" | "png"
    pub width: u32,
    pub height: u32,
    pub source_size: u64,
    pub output_size: u64,
}

fn encode_jpeg_mozjpeg(img: &DynamicImage, quality: f32) -> Result<Vec<u8>, String> {
    use mozjpeg::{ColorSpace, Compress};
    let rgb = img.to_rgb8();
    let (w, h) = (rgb.width() as usize, rgb.height() as usize);
    let mut compress = Compress::new(ColorSpace::JCS_RGB);
    compress.set_size(w, h);
    compress.set_quality(quality);
    compress.set_progressive_mode();
    compress.set_optimize_scans(true);
    let mut started = compress
        .start_compress(Vec::<u8>::new())
        .map_err(|e| format!("mozjpeg start: {e}"))?;
    started
        .write_scanlines(rgb.as_raw())
        .map_err(|e| format!("mozjpeg scanlines: {e}"))?;
    started
        .finish()
        .map_err(|e| format!("mozjpeg finish: {e}"))
}

fn encode_jpeg_fallback(img: &DynamicImage, quality: u8) -> Result<Vec<u8>, String> {
    use image::codecs::jpeg::JpegEncoder;
    let rgb = img.to_rgb8();
    let mut buf: Vec<u8> = Vec::with_capacity(256 * 1024);
    let mut encoder = JpegEncoder::new_with_quality(Cursor::new(&mut buf), quality);
    encoder
        .encode(rgb.as_raw(), rgb.width(), rgb.height(), image::ExtendedColorType::Rgb8)
        .map_err(|e| format!("encode jpeg: {e}"))?;
    Ok(buf)
}

fn encode_png(img: &DynamicImage) -> Result<Vec<u8>, String> {
    use image::codecs::png::{CompressionType, FilterType as PngFilter, PngEncoder};
    use image::ImageEncoder;
    let rgba = img.to_rgba8();
    let mut buf: Vec<u8> = Vec::with_capacity(512 * 1024);
    let encoder = PngEncoder::new_with_quality(
        Cursor::new(&mut buf),
        CompressionType::Best,
        PngFilter::Adaptive,
    );
    encoder
        .write_image(rgba.as_raw(), rgba.width(), rgba.height(), image::ExtendedColorType::Rgba8)
        .map_err(|e| format!("encode png: {e}"))?;
    Ok(buf)
}

#[tauri::command]
pub fn image_compress_for_pdf(
    path: String,
    tier: QualityTier,
) -> Result<CompressedImage, String> {
    let source_size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);

    // Lossless path — return the source bytes straight through for JPEG/PNG.
    // For other formats, decode and re-encode as PNG so PDF gets lossless data.
    if matches!(tier, QualityTier::Lossless) {
        let reader = ImageReader::open(&path)
            .map_err(|e| format!("open {path}: {e}"))?
            .with_guessed_format()
            .map_err(|e| format!("guess format {path}: {e}"))?;
        let format = reader.format();
        match format {
            Some(ImageFormat::Jpeg) => {
                let bytes = fs::read(&path).map_err(|e| format!("read raw jpeg: {e}"))?;
                let dims = image::image_dimensions(&path)
                    .map_err(|e| format!("dimensions: {e}"))?;
                return Ok(CompressedImage {
                    output_size: bytes.len() as u64,
                    bytes,
                    format: "jpg",
                    width: dims.0,
                    height: dims.1,
                    source_size,
                });
            }
            Some(ImageFormat::Png) => {
                let bytes = fs::read(&path).map_err(|e| format!("read raw png: {e}"))?;
                let dims = image::image_dimensions(&path)
                    .map_err(|e| format!("dimensions: {e}"))?;
                return Ok(CompressedImage {
                    output_size: bytes.len() as u64,
                    bytes,
                    format: "png",
                    width: dims.0,
                    height: dims.1,
                    source_size,
                });
            }
            _ => {
                // WebP, TIFF, BMP, etc — decode + re-encode as PNG.
                let img = reader.decode().map_err(|e| format!("decode {path}: {e}"))?;
                let (w, h) = (img.width(), img.height());
                let bytes = encode_png(&img)?;
                return Ok(CompressedImage {
                    output_size: bytes.len() as u64,
                    bytes,
                    format: "png",
                    width: w,
                    height: h,
                    source_size,
                });
            }
        }
    }

    // Lossy tiers — decode, optionally downscale, encode JPEG via mozjpeg.
    let params = tier.params().expect("non-lossless tier must have params");
    let reader = ImageReader::open(&path)
        .map_err(|e| format!("open {path}: {e}"))?
        .with_guessed_format()
        .map_err(|e| format!("guess format {path}: {e}"))?;
    let mut img = reader
        .decode()
        .map_err(|e| format!("decode {path}: {e}"))?;

    let (w, h) = (img.width(), img.height());
    let longest = w.max(h);
    if longest > params.max_dim {
        let scale = params.max_dim as f32 / longest as f32;
        let new_w = (w as f32 * scale).round().max(1.0) as u32;
        let new_h = (h as f32 * scale).round().max(1.0) as u32;
        img = img.resize(new_w, new_h, FilterType::Lanczos3);
    }
    let out_w = img.width();
    let out_h = img.height();

    let bytes = encode_jpeg_mozjpeg(&img, params.jpeg_quality).or_else(|err| {
        eprintln!("[imagecompress] mozjpeg failed ({err}), falling back to image crate");
        encode_jpeg_fallback(&img, params.jpeg_quality as u8)
    })?;

    Ok(CompressedImage {
        output_size: bytes.len() as u64,
        bytes,
        format: "jpg",
        width: out_w,
        height: out_h,
        source_size,
    })
}
