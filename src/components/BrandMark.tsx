import { useNavigate } from "react-router-dom";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useLogo } from "../contexts/LogoContext";

export function BrandMark() {
  const { logo } = useLogo();
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className={`brand-mark${logo ? " has-crop" : ""}`}
      style={logo ? { backgroundImage: `url(${convertFileSrc(logo)})` } : undefined}
      title="Open settings"
      aria-label="Open settings"
      onClick={() => navigate("/settings")}
    />
  );
}
