import { useUpdate } from "../contexts/UpdateContext";

function relativeTime(ts: number | undefined): string {
  if (!ts) return "never";
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const days = Math.round(hr / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function AboutUpdatesCard() {
  const { state, currentVersion, recheck, install } = useUpdate();

  const busy =
    state.kind === "checking" ||
    state.kind === "downloading" ||
    state.kind === "installing";

  let statusLine: string;
  let statusClass = "";
  switch (state.kind) {
    case "idle":
      statusLine = "Not checked yet.";
      break;
    case "checking":
      statusLine = "Checking for updates…";
      break;
    case "up_to_date":
      statusLine = `You're on the latest version. Checked ${relativeTime(state.checkedAt)}.`;
      break;
    case "available":
      statusLine = `v${state.version} is available. Checked ${relativeTime(state.checkedAt)}.`;
      statusClass = "status-available";
      break;
    case "downloading": {
      const pct = state.total > 0 ? Math.round((state.downloaded / state.total) * 100) : 0;
      statusLine = `Downloading v${state.version}… ${pct}%`;
      break;
    }
    case "installing":
      statusLine = `Installing v${state.version}… app will restart.`;
      break;
    case "error":
      statusLine = `Couldn't check for updates: ${state.message}`;
      statusClass = "status-error";
      break;
  }

  return (
    <section className="settings-card">
      <div className="settings-card-head">
        <div>
          <h2 className="settings-card-title">About &amp; updates</h2>
          <p className="settings-card-sub">
            The app checks for updates automatically when it launches. You can also check manually below.
          </p>
        </div>
        <div className="settings-version-block">
          <div className="settings-version-label">Current version</div>
          <div className="settings-version-value">v{currentVersion}</div>
        </div>
      </div>
      <div className="settings-card-actions">
        <button
          type="button"
          className="primary compact"
          disabled={busy}
          onClick={() => void recheck()}
        >
          {state.kind === "checking" ? <span className="spinner" /> : null}
          <span>{state.kind === "checking" ? "Checking…" : "Check for updates"}</span>
        </button>
        {state.kind === "available" && (
          <button type="button" className="ghost" onClick={() => void install()}>
            Install v{state.version}
          </button>
        )}
        <div className={`settings-status ${statusClass}`}>{statusLine}</div>
      </div>
      {state.kind === "available" && state.notes && (
        <div className="update-notes">
          <div className="update-notes-label">What's new</div>
          <pre className="update-notes-body">{state.notes}</pre>
        </div>
      )}
    </section>
  );
}
