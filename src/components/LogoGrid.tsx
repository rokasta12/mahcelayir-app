import { convertFileSrc } from "@tauri-apps/api/core";

type Props = {
  crops: string[];
  currentLogo: string | null;
  onPick: (path: string) => void;
};

export function LogoGrid({ crops, currentLogo, onPick }: Props) {
  return (
    <div className="crop-grid-inline" role="listbox" aria-label="Logo fragments">
      {crops.map((path, i) => {
        const selected = path === currentLogo;
        return (
          <button
            key={path}
            type="button"
            role="option"
            aria-selected={selected}
            aria-label={`Fragment ${i + 1}${selected ? " (current)" : ""}`}
            className={`crop-cell${selected ? " selected" : ""}`}
            style={{ backgroundImage: `url(${convertFileSrc(path)})` }}
            onClick={() => onPick(path)}
          />
        );
      })}
    </div>
  );
}
