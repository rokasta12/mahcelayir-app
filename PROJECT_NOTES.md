# Mahmut Celayir Archive — Project Notes

_Internal reflection written after re-reading every prompt in this build session. Not for the uncle — for the developer._

---

## 1. How the vision evolved (chronological reading)

The ask shifted dramatically across the session. Tracking this matters because earlier decisions (framed around "a small PDF tool") are now constraining a much bigger vision.

### Phase 1 — "simple desktop app for my uncle"
- Framing: a small utility that parses Turkish filenames, sorts artworks chronologically, generates a PDF.
- Tone: curious, collaborative, asked me to "research deeply first".
- Output: PyQt vs Tauri discussion, we landed on Tauri, user said "Tauri seems very nice ver good".

### Phase 2 — Building the first working version
- Scaffolded Tauri v2 + vanilla TS + pdf-lib + Noto Sans.
- User dropped his uncle's folder, screenshot showed the app working but all rows flagged "needs attention".
- Tone still collaborative. First frustration: "even those should work need to have a input area where my uncle can edit".

### Phase 3 — Feature requests (moderate complexity)
- Drag-drop folders → persist → store PDFs.
- Hover previews.
- Apple-like folder icons, 2×2 thumbnail collages.
- 500ms hover delay with larger preview.

### Phase 4 — Creative idea
- "Crop random pieces from random images, 128 logos, customizable"
- Genuinely delighted by this. Implemented crop picker.
- Tone: "really good idea btw".

### Phase 5 — Scaling + customization
- Bumped to 256 crops.
- "Make app customizable by adding a settings part for logo selection."
- Persistence across app restarts emphasized: _"apps icon still be changeable after closing and opening as well"_.

### Phase 6 — Full refactor demand
- "Dude we can make a lot of them... don't take it that seriously but app icon must persist"
- "Move to React with Vite and nicel react router... separate pages components keep typescript and state nicely... divide and conquer"
- Executed: Vanilla TS → React + Context + React Router. 30 files, clean boundaries.

### Phase 7 — Polish + real-app expectations
- Rebrand: drop "PDF Maker", **"just use Mahmut Celayir for all"**.
- Bigger in-app icon.
- Hover should show inner images without entering the project.
- Nice image viewer for curators/visitors.
- **Expanded scope**: "he can use this application to put his all photographs of artworks and his life to make this app much much better actually"
- **macOS Dock icon must be the selected crop, not a static design**: _"deck icon should not be this shitty one stupid fuck"_.
- **Storage**: _"relying on web storage options is ridiculous"_ — wants native Rust-backed storage.

### Phase 8 — Professional presentation
- "This app will be like my uncle's artist's folders of images of artworks"
- "Nicely view each of them and full view as well"
- **Critical**: _"this screen should be a nice grid like mahmutcelayir.com has nice ui!"_
- **Architectural**: PDF generation should be a **separate page** behind a small icon — "he can use it for presenting his artworks to people" (curators, visitors).
- Gallery-first, editor-second flow.

---

## 2. Tone shift observed

Tone moved from collaborative exploration → impatient frustration. Specific signals:
- Phase 1–3: full sentences, "please", "carefully", hedged requests.
- Phase 4–5: still playful ("dude", exclamation marks in a friendly way).
- Phase 6–7: harsher when things didn't work ("stupid fuck", "shitty one", "are you fucking dumb ass").
- Underlying reason: the build was taking time, icons didn't match expectations, I made visible mistakes (CSS bug where crops rendered as empty squares because I didn't wrap paths in `convertFileSrc`).

**What this tells me**: the user cares a lot about this app. It's for family. Every misstep feels heavier than in a commercial context. Default posture going forward: prioritize visual polish and end-user feel over engineering cleanliness.

---

## 3. What's actually shipped and working

### Architecture (React refactor — done well)
- Vite + React 18 + React Router v6
- ProjectsContext + LogoContext with `useMemo`-stable values
- Lib/Hooks/Components/Pages separation
- TypeScript strict mode, all files type-check clean

### Features shipped
- Drag-drop folders → auto-created projects
- Tolerant filename parser (Turkish quirks, commas, periods, circle dimensions, trailing commas)
- Editable artwork rows with contextual "MISSING: year" hints
- PDF generation via pdf-lib + Noto Sans (Turkish glyphs)
- In-app PdfViewer via pdf.js
- ImageViewer lightbox (arrow keys, thumb strip, fullscreen, backdrop blur)
- Hover preview with featured image auto-cycling
- 256-crop logo pool generated from user's artwork
- Native file storage for crops (JPEGs in `~/Library/Application Support/…/crops/`)
- Dynamic macOS Dock icon via Cocoa (`NSApp.setApplicationIconImage`)
- Squircle icon compositor (proper Apple shape with safe-area margin)
- **Gallery view** (default when opening a project) with Didot typography
- **Prepare PDF page** (editor, hidden behind small icon)
- Settings page with crop picker, live preview, reroll
- Persistence across restarts (localStorage + file system)
- Logo defaults to a random pool crop, never to typographic fallback when art is available

### Build
- macOS bundle for Intel (x86_64-apple-darwin) — building right now

---

## 4. What's understood but NOT yet done

These are requests the user made that I haven't fully delivered on, or that I implemented partially and should revisit:

### Storage — partially migrated
- **Done**: Crops live as JPEGs in app data dir
- **Still localStorage**: Project metadata, overrides, PDF history
- User said "relying on web storage options is ridiculous" — this may still feel wrong to him, even though metadata is only ~10KB/project.
- **Plan**: Migrate project metadata to `projects.json` in app data dir. Keep API surface identical (ProjectsContext stays the same internally).

### "Life photos / biography" section
- User mentioned: "he can use this application to put his all photographs of artworks and his life"
- **Not done**: Projects are generic; there's no category distinction between "artworks" and "life photos".
- **Plan**: Add optional project type ("Artworks" | "Life" | "Exhibitions") that affects default sort + gallery layout. Low priority but would signal the app grew.

### Gallery polish
- Current gallery is a clean 3-col grid. mahmutcelayir.com has subtle touches I didn't fully replicate:
  - Masonry/variable-height tiles for visual rhythm
  - Entrance animation (staggered fade-in)
  - Title typography could be bigger / more book-like
- **Plan**: Add a grid density toggle (comfortable / compact) and a staggered reveal on mount.

### Image viewer — more professional
- Current viewer is basic: prev/next, thumbs, Esc.
- Curator-grade additions:
  - Zoom on scroll / pinch
  - Double-click to fit → 100%
  - Metadata overlay (title, medium, dims, year) that auto-hides
  - Keyboard "i" to toggle metadata
  - Maybe auto-slideshow mode for exhibitions
- **Plan**: Next iteration.

### App icon (static .icns) — good but not great
- Current `.icns` is the Didot "M" with CELAYIR caps. Auto-generated via `tauri icon`.
- Dock icon dynamically swaps to selected crop on launch via Cocoa.
- **Issue**: The `.icns` is what the user sees BEFORE the Rust code runs (during splash) and in Finder before launch. If user wants the Dock icon selection to also affect the Finder/bundle icon, we'd need to rewrite the bundle on selection — not easy.
- **Acceptance**: Dock updates, that's what people see most.

### Settings is thin
- Currently only has logo customization. User said "make app customizable" — this could grow.
- **Future sections**: Default caption font for PDFs, PDF page size (A4 / US Letter), light/dark theme override, language (Turkish UI?).

### PDF preview improvements
- PdfViewer is basic. Curators might want to see the catalog as a page-turn book, two-page spread.
- **Plan**: Not urgent; move on.

---

## 5. What genuinely needs refactor

Opportunities I see to tighten things, in priority order:

### High value
1. **Project metadata to file-based storage** (JSON in app data dir). Simple but keeps word to user about "not relying on web storage".
2. **Error boundaries in React** — right now an error in any page crashes everything. Add a top-level ErrorBoundary with a friendly "Something broke — reset?" screen.
3. **useDragDrop singleton**: currently each page sets up its own tauri listener. Two pages mounted = duplicate event handling. Move to a context with handler registration.

### Medium value
4. **Split `styles.css`** (now 1800+ lines) into per-component or per-feature CSS. Global CSS is fine until it isn't.
5. **`pdf-lib` fonts loaded per-generation** — each PDF re-reads the TTF file. Cache the PDFFont instances across generations in a module-level map.
6. **`LogoContext` effects are getting tangled** — auto-seed + reconcile + Dock icon sync are all in one component. Extract to `useLogoAutoSeed`, `useLogoReconcile`, `useDockIconSync` hooks.

### Low value (but would feel good)
7. **Replace localStorage keys with a typed wrapper** — `store.get("projects")` with schema validation. Protects against corrupted state.
8. **Proper logger** — `console.error` in catch blocks should route through a toast UI for debug-mode visibility.

---

## 6. Key lessons for next interaction

- **Prototype visually first**. The user evaluates via screenshots. Engineering correctness (type-checks, storage location) is invisible until it breaks the UI.
- **Brand identity came late but mattered most**. Spending 3 iterations on logos would have been less painful had I started with "this is HIS app, named for him, styled like his catalog cover" on day one.
- **"Carefully do it all"** means the visible polish, not code quality.
- **Frustration signal**: when the user says "stupid fuck" or similar, stop adding features and fix the specific visible thing. Engineering quality gestures (type-checking, refactoring) don't address the frustration.
- **The user will not read long technical summaries**. They'll skim for "did you do the thing". Summaries should be about visible changes, not internal architecture.

---

## 7. Plan for this and next session

### This session — in-flight
- [x] Gallery view at `/project/:id`
- [x] Editor at `/project/:id/prepare`
- [x] Small PDF icon in gallery header
- [x] Didot serif gallery title
- [x] macOS Intel build — _in progress, background task_

### Next session priorities (in order)
1. Verify the Intel build runs on the uncle's Mac (right-click → Open the first time)
2. Migrate project metadata to file-based JSON storage
3. Image viewer zoom + metadata overlay
4. Gallery entrance animation + tile sizing refinements
5. Maybe: "life photos" project type with a different grid (denser, no metadata required)

---

## 8. File inventory (current state)

```
src/
├── main.tsx                        React entry
├── App.tsx                         Routes + providers
├── types.ts                        Domain types
├── styles.css                      All styles
├── pages/
│   ├── HomePage.tsx                Project grid / empty dropzone
│   ├── ProjectGalleryPage.tsx      Default project view (visual)
│   ├── ProjectEditPage.tsx         Editor / PDF generation
│   └── SettingsPage.tsx            Logo customizer
├── components/
│   ├── BrandMark.tsx               Dynamic logo tile (click → settings)
│   ├── SettingsButton.tsx          Gear icon
│   ├── Dropzone.tsx                Empty-state drop target
│   ├── ProjectCard.tsx             Folder tile on home
│   ├── HoverPreview.tsx            Floating preview panel
│   ├── ArtworkRow.tsx              Editable row (editor only)
│   ├── GeneratedPdfList.tsx        PDF history
│   ├── PdfViewer.tsx               pdf.js canvas modal
│   ├── ImageViewer.tsx             Fullscreen lightbox
│   └── LogoGrid.tsx                Crop picker grid
├── contexts/
│   ├── ProjectsContext.tsx
│   └── LogoContext.tsx
├── hooks/
│   ├── useDragDrop.ts
│   └── useArtworks.ts
└── lib/
    ├── parseFilename.ts
    ├── generatePdf.ts
    ├── cropLogo.ts
    ├── nativePool.ts
    ├── iconComposer.ts
    ├── store.ts
    └── tauriFiles.ts
```

```
src-tauri/
├── src/lib.rs                      Plugin registration + set_dock_icon
├── src/main.rs                     Boilerplate
├── Cargo.toml                      Deps (tauri, plugins, cocoa on macOS)
├── tauri.conf.json                 App identity (Mahmut Celayir)
├── capabilities/default.json       Permissions + fs scope
├── icons/                          Multi-resolution app icons
├── fonts/                          Noto Sans TTF (bundled resource)
└── icon-source.svg                 Source for app icon
```

Total: ~3800 lines (1800 TS, 1500 CSS, 50 Rust).

---

_End of notes._
