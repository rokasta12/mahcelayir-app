import { useCallback, useEffect, useMemo, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";

type Props = {
  paths: string[];
  startIndex: number;
  onClose: () => void;
  title?: string;
};

export function ImageViewer({ paths, startIndex, onClose, title }: Props) {
  const [index, setIndex] = useState(() => Math.max(0, Math.min(startIndex, paths.length - 1)));
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const prev = useCallback(() => setIndex((i) => (i === 0 ? paths.length - 1 : i - 1)), [paths.length]);
  const next = useCallback(() => setIndex((i) => (i === paths.length - 1 ? 0 : i + 1)), [paths.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, prev, next]);

  const current = paths[index];
  const displaySrc = useMemo(() => (current ? convertFileSrc(current) : ""), [current]);

  const basename = (p: string) => {
    const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
    return i >= 0 ? p.slice(i + 1) : p;
  };

  const stripStart = Math.max(0, index - 4);
  const stripEnd = Math.min(paths.length, stripStart + 9);
  const stripSlice = paths.slice(stripStart, stripEnd);

  return (
    <div
      className={`image-viewer${visible ? " visible" : ""}`}
      role="dialog"
      aria-modal
      aria-labelledby="image-viewer-title"
    >
      <div className="image-viewer-backdrop" onClick={onClose} />
      <div className="image-viewer-panel">
        <header className="image-viewer-header">
          <div className="image-viewer-title" id="image-viewer-title">
            {title && <span className="iv-title">{title}</span>}
            <span className="iv-filename">{current ? basename(current) : ""}</span>
          </div>
          <div className="image-viewer-actions">
            <div className="image-viewer-counter">
              {index + 1} / {paths.length}
            </div>
            <button type="button" className="icon-close" aria-label="Close" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </header>

        <div className="image-viewer-stage">
          <button type="button" className="iv-nav left" aria-label="Previous" onClick={prev}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          {current && <img key={current} src={displaySrc} alt={basename(current)} className="iv-main" />}
          <button type="button" className="iv-nav right" aria-label="Next" onClick={next}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {paths.length > 1 && (
          <div className="image-viewer-strip">
            {stripSlice.map((path, i) => {
              const realIdx = stripStart + i;
              return (
                <button
                  key={path}
                  type="button"
                  className={`iv-thumb${realIdx === index ? " selected" : ""}`}
                  onClick={() => setIndex(realIdx)}
                  aria-label={`Image ${realIdx + 1}`}
                >
                  <img src={convertFileSrc(path)} alt="" loading="lazy" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
