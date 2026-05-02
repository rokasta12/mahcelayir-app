## v0.1.1 — first build for distribution

### Persistence
- All data now lives in `~/Desktop/Mahmut Celayir/` — projects, logo fragments, generated PDFs
- Schema-versioned `archive.json` with atomic writes and rolling backup
- One-time migration from any older localStorage data on first launch
- "Archive folder" card in Settings shows location, stats, and a Reveal-in-Finder button
- Optional "Change folder…" for moving the archive to an external drive later

### PDF generation
- Image compression via Rust + mozjpeg → catalogs are 10–20× smaller
- Quality picker in the prep page footer: Lossless / High / Medium / Low
- Choice persists per-app, defaults to Medium (1800px / q82)
- PDFs default-save into `~/Desktop/Mahmut Celayir/pdfs/` so they're easy to find
- Skips unreadable images instead of crashing the whole catalog

### Stability
- Error boundary protects projects if a component crashes
- Versioned data migrations keep existing projects safe across future updates
- PDF viewer re-fits when the side panel resizes
- Removing an artwork now asks for confirmation
- Async cleanup fixes in drag-drop listeners

### UX polish
- Auto-updater infrastructure in place (dormant — activates on next signed release)
- Image quality tier picker
- Focus-visible states on all interactive elements
- Aria labels on logo fragments and image viewer dialog
- Hover preview pauses while the cursor is on it
