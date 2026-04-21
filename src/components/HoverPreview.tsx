import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { Project } from "../types";

type Props = {
  project: Project;
  anchor: HTMLElement | null;
  open: boolean;
  onFeatureClick?: (index: number) => void;
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function HoverPreview({ project, anchor, open, onFeatureClick }: Props) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [featureIdx, setFeatureIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !anchor) {
      setPosition(null);
      return;
    }
    setFeatureIdx(0);
    setPaused(false);
    const rect = anchor.getBoundingClientRect();
    const panelW = 480;
    setPosition({
      top: Math.min(rect.bottom + 10, window.innerHeight - 380),
      left: Math.max(12, Math.min(rect.left, window.innerWidth - panelW - 16)),
    });
  }, [open, anchor]);

  // Auto-cycle the featured image slowly while hover is open, but pause
  // when the user's cursor enters the panel so they can focus on one image.
  useEffect(() => {
    if (!open || paused || project.imagePaths.length < 2) return;
    const id = window.setInterval(() => {
      setFeatureIdx((i) => (i + 1) % Math.min(6, project.imagePaths.length));
    }, 1400);
    return () => window.clearInterval(id);
  }, [open, paused, project.imagePaths.length]);

  if (!position) return null;

  const strip = project.imagePaths.slice(0, 6);
  const featured = strip[featureIdx] ?? strip[0];

  return (
    <div
      ref={panelRef}
      className={`hover-preview${open ? " visible" : ""}`}
      style={{ top: position.top, left: position.left }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {featured && (
        <button
          type="button"
          className="hover-feature"
          onClick={() => onFeatureClick?.(featureIdx)}
          aria-label="View artworks"
        >
          <img src={convertFileSrc(featured)} alt="" />
        </button>
      )}
      <div className="hover-title">{project.name}</div>
      <div className="hover-strip">
        {strip.map((path, i) => (
          <button
            key={path}
            type="button"
            className={`hover-strip-thumb${i === featureIdx ? " active" : ""}`}
            onMouseEnter={() => setFeatureIdx(i)}
            onClick={() => onFeatureClick?.(i)}
          >
            <img src={convertFileSrc(path)} alt="" loading="lazy" />
          </button>
        ))}
      </div>
      <div className="hover-sub">
        {project.imagePaths.length} images · added {formatDate(project.addedAt)}
      </div>
    </div>
  );
}
