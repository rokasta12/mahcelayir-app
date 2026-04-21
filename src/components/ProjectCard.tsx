import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { Project } from "../types";
import { HoverPreview } from "./HoverPreview";
import { ImageViewer } from "./ImageViewer";

type Props = {
  project: Project;
  onDelete: (id: string) => void;
};

const PREVIEW_CELLS = 4;

export function ProjectCard({ project, onDelete }: Props) {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLLIElement | null>(null);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [viewerStart, setViewerStart] = useState<number | null>(null);
  const hoverTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    };
  }, []);

  const open = () => navigate(`/project/${project.id}`);

  const onMouseEnter = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setHoverOpen(true), 500);
  };
  const onMouseLeave = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    setHoverOpen(false);
  };

  const cells = Array.from({ length: PREVIEW_CELLS }, (_, i) => project.previewPaths[i]);

  return (
    <>
      <li
        ref={rootRef}
        className="project-card"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div className="folder-tile">
          <div className="folder-thumbs">
            {cells.map((path, i) => (
              <div key={i} className="folder-thumb">
                {path && <img src={convertFileSrc(path)} loading="lazy" alt="" />}
              </div>
            ))}
          </div>
        </div>
        <div className="project-meta">
          <div className="project-name">{project.name}</div>
          <div className="project-sub">
            {project.imagePaths.length} image{project.imagePaths.length === 1 ? "" : "s"}
            {project.pdfs.length > 0 && ` · ${project.pdfs.length} PDF${project.pdfs.length === 1 ? "" : "s"}`}
          </div>
        </div>
        <button
          type="button"
          className="card-delete"
          title="Remove from list"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Remove "${project.name}" from the list? The folder on disk is not deleted.`)) {
              onDelete(project.id);
            }
          }}
        >
          ×
        </button>
      </li>
      <HoverPreview
        project={project}
        anchor={rootRef.current}
        open={hoverOpen}
        onFeatureClick={(i) => {
          setHoverOpen(false);
          setViewerStart(i);
        }}
      />
      {viewerStart !== null && (
        <ImageViewer
          paths={project.imagePaths}
          startIndex={viewerStart}
          title={project.name}
          onClose={() => setViewerStart(null)}
        />
      )}
    </>
  );
}
