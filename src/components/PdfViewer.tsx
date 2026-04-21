import { useCallback, useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import { convertFileSrc } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";

// Worker is copied to public/ at dev+build time; Tauri serves it from root.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

type Props = {
  path: string;
  filename: string;
  onClose: () => void;
};

/**
 * Renders in the right-hand split panel (not a full-screen modal).
 * Height fills the panel; width is controlled by .pdf-side-panel.
 */
export function PdfViewer({ path, filename, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const docRef = useRef<pdfjs.PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        const res = await fetch(convertFileSrc(path));
        if (!res.ok) throw new Error("File not found (it may have been moved).");
        const data = new Uint8Array(await res.arrayBuffer());
        const doc = await pdfjs.getDocument({ data }).promise;
        if (cancelled) {
          doc.destroy();
          return;
        }
        docRef.current = doc;
        setPageCount(doc.numPages);
        setPage(1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load PDF.");
      }
    })();
    return () => {
      cancelled = true;
      docRef.current?.destroy();
      docRef.current = null;
    };
  }, [path]);

  useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    let cancelled = false;
    setIsRendering(true);
    (async () => {
      try {
        const pageObj = await doc.getPage(page);
        if (cancelled) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const dpr = window.devicePixelRatio || 1;
        const viewport = pageObj.getViewport({ scale: scale * dpr });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;
        await pageObj.render({ canvasContext: ctx, viewport, canvas }).promise;
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, scale, pageCount]);

  const fitPage = useCallback(async () => {
    const doc = docRef.current;
    const stage = stageRef.current;
    if (!doc || !stage) return;
    const pageObj = await doc.getPage(page);
    const raw = pageObj.getViewport({ scale: 1 });
    const availW = stage.clientWidth - 24;
    const availH = stage.clientHeight - 24;
    const next = Math.min(availW / raw.width, availH / raw.height);
    if (Number.isFinite(next) && next > 0) setScale(next);
  }, [page]);

  useEffect(() => {
    if (pageCount === 0) return;
    void fitPage();
  }, [pageCount, fitPage]);

  // Re-fit when the panel / window resizes.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || pageCount === 0) return;
    let raf = 0;
    const obs = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => void fitPage());
    });
    obs.observe(stage);
    return () => {
      obs.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [fitPage, pageCount]);

  return (
    <div className="pdf-panel-inner">
      <header className="pdf-viewer-header">
        <div className="pdf-viewer-meta">
          <div className="pdf-viewer-title">{filename}</div>
          <div className="pdf-viewer-path">{path}</div>
        </div>
        <div className="pdf-viewer-actions">
          <button
            type="button"
            className="ghost-sm"
            onClick={() => openPath(path).catch(() => undefined)}
            title="Open in Preview app"
          >
            Preview
          </button>
          <button type="button" className="ghost-sm icon-close" aria-label="Close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      <div className="pdf-viewer-stage" ref={stageRef}>
        {error ? (
          <div className="pdf-viewer-error">
            <strong>Couldn't load PDF</strong>
            {error}
          </div>
        ) : (
          <>
            <canvas className="pdf-canvas" ref={canvasRef} />
            {isRendering && pageCount === 0 && (
              <div className="pdf-viewer-loading">
                <span className="spinner" />
                <span>Loading PDF…</span>
              </div>
            )}
          </>
        )}
      </div>

      <footer className="pdf-viewer-footer">
        <div className="pdf-nav">
          <button type="button" className="ghost-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ‹
          </button>
          <div className="pdf-page-indicator">
            {page} / {pageCount || "–"}
          </div>
          <button type="button" className="ghost-sm" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
            ›
          </button>
        </div>
        <div className="pdf-zoom">
          <button type="button" className="ghost-sm" onClick={() => setScale((s) => Math.max(0.4, s - 0.2))}>
            −
          </button>
          <div className="pdf-zoom-indicator">{Math.round(scale * 100)}%</div>
          <button type="button" className="ghost-sm" onClick={() => setScale((s) => Math.min(4, s + 0.2))}>
            +
          </button>
          <button type="button" className="ghost-sm" onClick={fitPage}>
            Fit
          </button>
        </div>
      </footer>
    </div>
  );
}
