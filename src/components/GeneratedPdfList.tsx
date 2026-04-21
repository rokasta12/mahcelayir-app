import type { GeneratedPdf } from "../types";

type Props = {
  pdfs: GeneratedPdf[];
  onOpen: (pdf: GeneratedPdf) => void;
  onRemove: (pdfId: string) => void;
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function GeneratedPdfList({ pdfs, onOpen, onRemove }: Props) {
  if (pdfs.length === 0) return null;
  return (
    <section className="pdf-history">
      <h3 className="section-title small">Generated PDFs</h3>
      <ul className="pdf-history-list">
        {pdfs.map((pdf) => (
          <li key={pdf.id} className="pdf-item">
            <div className="pdf-icon">PDF</div>
            <div className="pdf-meta">
              <div className="pdf-name">{pdf.filename}</div>
              <div className="pdf-sub">
                {pdf.artworkCount} page{pdf.artworkCount === 1 ? "" : "s"} · {formatDate(pdf.generatedAt)}
              </div>
            </div>
            <button type="button" className="ghost-sm" onClick={() => onOpen(pdf)}>
              Open
            </button>
            <button type="button" className="icon-sm" title="Remove from list" onClick={() => onRemove(pdf.id)}>
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
