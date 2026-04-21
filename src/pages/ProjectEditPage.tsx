import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SettingsButton } from "../components/SettingsButton";
import { ArtworkRow } from "../components/ArtworkRow";
import { GeneratedPdfList } from "../components/GeneratedPdfList";
import { ImageViewer } from "../components/ImageViewer";
import { useProjects } from "../contexts/ProjectsContext";
import { usePdfPanel } from "../contexts/PdfPanelContext";
import { useArtworks } from "../hooks/useArtworks";
import { useDragDrop } from "../hooks/useDragDrop";
import { basename, expandPaths, pickImageFiles } from "../lib/tauriFiles";
import { generatePdf } from "../lib/generatePdf";
import { genId } from "../lib/id";
import type { GeneratedPdf } from "../types";

export function ProjectEditPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { getProject, updateImages, addPdf, removePdf } = useProjects();
  const project = getProject(id);
  const { artworks, updateField, removeByPath } = useArtworks(project);

  const [status, setStatus] = useState<{ message: string; kind: "" | "error" | "success" }>({ message: "", kind: "" });
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewingImageIdx, setViewingImageIdx] = useState<number | null>(null);
  const { show: showPdf } = usePdfPanel();

  const validCount = useMemo(() => artworks.filter((a) => a.valid).length, [artworks]);
  const invalidCount = artworks.length - validCount;
  const topMissing = useMemo(() => {
    const counts: Record<string, number> = { title: 0, medium: 0, dimensions: 0, year: 0 };
    for (const a of artworks) {
      if (a.valid) continue;
      if (!a.title.trim()) counts.title++;
      if (!a.medium.trim()) counts.medium++;
      if (!a.dimensions.trim()) counts.dimensions++;
      if (a.year === null) counts.year++;
    }
    const entries = Object.entries(counts).filter(([, n]) => n > 0);
    if (entries.length === 0) return null;
    entries.sort((a, b) => b[1] - a[1]);
    const [topField] = entries[0];
    return entries.length > 1 ? `${topField} and more` : topField;
  }, [artworks]);

  const handleAddImages = useCallback(async () => {
    const paths = await pickImageFiles();
    if (paths.length === 0 || !project) return;
    updateImages(project.id, (existing) => {
      const set = new Set(existing);
      for (const p of paths) set.add(p);
      return [...set].sort();
    });
  }, [project, updateImages]);

  const handlePaths = useCallback(
    async (paths: string[]) => {
      if (!project) return;
      const { filePaths } = await expandPaths(paths);
      if (filePaths.length === 0) return;
      updateImages(project.id, (existing) => {
        const set = new Set(existing);
        for (const p of filePaths) set.add(p);
        return [...set].sort();
      });
    },
    [project, updateImages],
  );

  useDragDrop(handlePaths);

  const handleGenerate = useCallback(async () => {
    if (!project) return;
    setIsGenerating(true);
    setStatus({ message: "Building pages…", kind: "" });
    try {
      const result = await generatePdf(artworks);
      if (!result) {
        setStatus({ message: "", kind: "" });
        return;
      }
      const filename = basename(result.path);
      const pdf: GeneratedPdf = {
        id: genId("pdf"),
        path: result.path,
        filename,
        generatedAt: Date.now(),
        artworkCount: result.artworkCount,
      };
      addPdf(project.id, pdf);
      const skippedNote = result.skipped.length > 0
        ? ` · skipped ${result.skipped.length} unreadable ${result.skipped.length === 1 ? "image" : "images"}`
        : "";
      setStatus({ message: `Saved ${result.artworkCount} pages${skippedNote}`, kind: "success" });
      showPdf({ path: pdf.path, filename: pdf.filename });
    } catch (err) {
      setStatus({ message: err instanceof Error ? err.message : "Failed to generate PDF.", kind: "error" });
    } finally {
      setIsGenerating(false);
    }
  }, [project, artworks, addPdf]);

  if (!project) {
    return (
      <section className="view">
        <header className="project-header">
          <button className="back-btn" onClick={() => navigate("/")}>
            <span>Back</span>
          </button>
        </header>
        <div className="settings-empty">Project not found.</div>
      </section>
    );
  }

  return (
    <section className="view">
      <header className="project-header">
        <button type="button" className="back-btn" aria-label="Back to gallery" onClick={() => navigate(`/project/${project.id}`)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Gallery</span>
        </button>
        <div className="project-header-text">
          <h1>Prepare PDF — {project.name}</h1>
          <div className="project-path">{project.folderPath}</div>
        </div>
        <button type="button" className="ghost" onClick={handleAddImages}>
          Add images…
        </button>
        <SettingsButton />
      </header>

      <section className="list-section">
        <div className="list-header">
          <div className="list-title">
            <span id="count-label">
              {validCount} of {artworks.length} ready
            </span>
            {invalidCount > 0 && (
              <span className="warning">
                {invalidCount} need {topMissing ?? "attention"}
              </span>
            )}
          </div>
        </div>
        <ul className="artwork-list">
          {artworks.map((artwork, i) => (
            <ArtworkRow
              key={artwork.id}
              artwork={artwork}
              onFieldChange={(patch) => updateField(artwork.path, patch)}
              onRemove={() => removeByPath(artwork.path)}
              onView={() => setViewingImageIdx(i)}
            />
          ))}
        </ul>
      </section>

      <GeneratedPdfList
        pdfs={project.pdfs}
        onOpen={(pdf) => showPdf({ path: pdf.path, filename: pdf.filename })}
        onRemove={(pdfId) => removePdf(project.id, pdfId)}
      />

      <footer className="app-footer">
        <div className={`status ${status.kind}`}>{status.message}</div>
        <button type="button" className="primary" disabled={validCount === 0 || isGenerating} onClick={handleGenerate}>
          {isGenerating ? (
            <span className="spinner" />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          )}
          <span>{isGenerating ? "Generating…" : validCount > 0 ? `Generate PDF (${validCount} pages)` : "Generate PDF"}</span>
        </button>
      </footer>

      {viewingImageIdx !== null && (
        <ImageViewer
          paths={artworks.map((a) => a.path)}
          startIndex={viewingImageIdx}
          title={project.name}
          onClose={() => setViewingImageIdx(null)}
        />
      )}
    </section>
  );
}
