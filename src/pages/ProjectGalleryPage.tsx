import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SettingsButton } from "../components/SettingsButton";
import { ImageViewer } from "../components/ImageViewer";
import { useProjects } from "../contexts/ProjectsContext";
import { useArtworks } from "../hooks/useArtworks";
import { useDragDrop } from "../hooks/useDragDrop";
import { convertFileSrc } from "@tauri-apps/api/core";
import { expandPaths } from "../lib/tauriFiles";

export function ProjectGalleryPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { getProject, updateImages } = useProjects();
  const project = getProject(id);
  const { artworks } = useArtworks(project);

  const [viewerIdx, setViewerIdx] = useState<number | null>(null);

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

  if (!project) {
    return (
      <section className="view">
        <header className="gallery-header">
          <button type="button" className="back-btn" onClick={() => navigate("/")}>
            <span>Back</span>
          </button>
        </header>
        <div className="settings-empty">Project not found.</div>
      </section>
    );
  }

  return (
    <section className="view gallery-view">
      <header className="gallery-header">
        <div className="gallery-header-left">
          <button
            type="button"
            className="back-btn"
            aria-label="Back to projects"
            onClick={() => navigate("/")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Projects</span>
          </button>
        </div>
        <div className="gallery-title-block">
          <h1 className="gallery-title">{project.name}</h1>
          <div className="gallery-count">
            {artworks.length} artwork{artworks.length === 1 ? "" : "s"}
            {project.pdfs.length > 0 && ` · ${project.pdfs.length} PDF${project.pdfs.length === 1 ? "" : "s"}`}
          </div>
        </div>
        <div className="gallery-header-right">
          <button
            type="button"
            className="icon-btn"
            title="Prepare PDF"
            aria-label="Prepare PDF"
            onClick={() => navigate(`/project/${project.id}/prepare`)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="15" x2="15" y2="15" />
              <line x1="12" y1="12" x2="12" y2="18" />
            </svg>
          </button>
          <SettingsButton />
        </div>
      </header>

      {artworks.length === 0 ? (
        <div className="settings-empty">No artworks yet — drop images into this project.</div>
      ) : (
        <ul className="gallery-grid">
          {artworks.map((artwork, i) => (
            <li key={artwork.id} className="gallery-tile">
              <button
                type="button"
                className="gallery-tile-btn"
                onClick={() => setViewerIdx(i)}
                aria-label={`View ${artwork.title}`}
              >
                <img src={convertFileSrc(artwork.path)} alt={artwork.title} loading="lazy" />
              </button>
              <figcaption className="gallery-caption">
                <div className="gallery-caption-title">{artwork.title}</div>
                <div className="gallery-caption-meta">
                  {[artwork.dimensions, artwork.year].filter(Boolean).join(" · ")}
                </div>
              </figcaption>
            </li>
          ))}
        </ul>
      )}

      {viewerIdx !== null && (
        <ImageViewer
          paths={artworks.map((a) => a.path)}
          startIndex={viewerIdx}
          title={project.name}
          onClose={() => setViewerIdx(null)}
        />
      )}
    </section>
  );
}
