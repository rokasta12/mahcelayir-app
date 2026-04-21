import type { PdfQualityTier } from "../lib/archive";

type Props = {
  value: PdfQualityTier;
  onChange: (tier: PdfQualityTier) => void;
  disabled?: boolean;
};

const TIERS: Array<{ value: PdfQualityTier; label: string; hint: string }> = [
  { value: "lossless", label: "Lossless", hint: "original size" },
  { value: "high", label: "High", hint: "2400px · q92" },
  { value: "medium", label: "Medium", hint: "1800px · q82" },
  { value: "low", label: "Low", hint: "1200px · q70" },
];

export function QualityPicker({ value, onChange, disabled }: Props) {
  return (
    <div className="quality-picker" role="radiogroup" aria-label="PDF image quality">
      <span className="quality-picker-label">Quality</span>
      <div className="quality-picker-segments">
        {TIERS.map((tier) => {
          const selected = tier.value === value;
          return (
            <button
              key={tier.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`quality-seg${selected ? " selected" : ""}`}
              title={tier.hint}
              disabled={disabled}
              onClick={() => onChange(tier.value)}
            >
              {tier.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
