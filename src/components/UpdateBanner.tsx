import { useUpdate } from "../contexts/UpdateContext";

export function UpdateBanner() {
  const { state, install, dismiss, dismissed } = useUpdate();

  if (state.kind === "downloading") {
    const pct = state.total > 0 ? Math.min(100, (state.downloaded / state.total) * 100) : 0;
    return (
      <div className="update-banner downloading">
        <span>Downloading v{state.version}… {Math.round(pct)}%</span>
        <div className="update-progress">
          <div className="update-progress-bar" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  if (state.kind === "installing") {
    return (
      <div className="update-banner installing">
        <span>Installing v{state.version}… restarting</span>
      </div>
    );
  }

  if (state.kind !== "available" || dismissed) return null;

  return (
    <div className="update-banner available">
      <div className="update-banner-text">
        <strong>Update available</strong>
        <span>v{state.version}</span>
      </div>
      <div className="update-banner-actions">
        <button type="button" className="ghost-sm" onClick={dismiss}>Later</button>
        <button type="button" className="primary compact" onClick={() => void install()}>
          Install
        </button>
      </div>
    </div>
  );
}
