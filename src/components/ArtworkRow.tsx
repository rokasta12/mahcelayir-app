import { convertFileSrc } from "@tauri-apps/api/core";
import type { Artwork, ArtworkOverride } from "../types";
import { missingFieldsOf } from "../hooks/useArtworks";

type Props = {
  artwork: Artwork;
  onFieldChange: (patch: ArtworkOverride) => void;
  onRemove: () => void;
  onView?: () => void;
};

export function ArtworkRow({ artwork, onFieldChange, onRemove, onView }: Props) {
  const missing = artwork.valid ? [] : missingFieldsOf(artwork);
  return (
    <li className={`artwork-row${artwork.valid ? "" : " invalid"}`}>
      <button type="button" className="thumb thumb-btn" onClick={onView} title="View artwork" aria-label={`View ${artwork.title}`}>
        <img src={convertFileSrc(artwork.path)} loading="lazy" alt={artwork.title} />
      </button>
      <input
        className="field title"
        type="text"
        placeholder="e.g. Hora-1"
        defaultValue={artwork.title}
        onBlur={(e) => onFieldChange({ title: e.currentTarget.value.trim() })}
      />
      <div className="meta-row">
        <input
          className="field medium"
          type="text"
          placeholder="e.g. tuval üzeri yağlıboya"
          defaultValue={artwork.medium}
          onBlur={(e) => onFieldChange({ medium: e.currentTarget.value.trim() })}
        />
        <input
          className="field dimensions"
          type="text"
          placeholder="e.g. 150 x 200 cm"
          defaultValue={artwork.dimensions}
          onBlur={(e) => onFieldChange({ dimensions: e.currentTarget.value.trim() })}
        />
        <input
          className="field year"
          type="text"
          inputMode="numeric"
          placeholder="e.g. 2024"
          defaultValue={artwork.year?.toString() ?? ""}
          onBlur={(e) => {
            const raw = e.currentTarget.value.trim();
            const parsed = /^\d{4}$/.test(raw) ? parseInt(raw, 10) : null;
            onFieldChange({ year: parsed });
          }}
        />
      </div>
      {missing.length > 0 && <div className="row-hint">Missing: {missing.join(", ")}</div>}
      <button
        type="button"
        className="delete-btn"
        title="Remove from project (file is kept)"
        aria-label={`Remove ${artwork.title} from project`}
        onClick={() => {
          const ok = window.confirm(
            `Remove "${artwork.title}" from this project?\n\nThe image file is not deleted — it stays on disk.`,
          );
          if (ok) onRemove();
        }}
      >
        ×
      </button>
    </li>
  );
}
