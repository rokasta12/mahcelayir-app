type Props = {
  onBrowse: () => void;
  title?: string;
  hint?: string;
};

export function Dropzone({ onBrowse, title = "Drop a folder of artworks here", hint = "Each folder becomes a project you can turn into a PDF." }: Props) {
  return (
    <div
      className="dropzone"
      role="button"
      tabIndex={0}
      onClick={onBrowse}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onBrowse();
        }
      }}
      aria-label="Drop images or click to browse"
    >
      <div className="dropzone-inner">
        <svg className="dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <div className="dropzone-text">{title}</div>
        <div className="dropzone-hint">
          {hint}
          <br />
          or{" "}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onBrowse();
            }}
          >
            choose folder…
          </button>
        </div>
      </div>
    </div>
  );
}
