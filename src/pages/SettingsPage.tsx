import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { convertFileSrc } from "@tauri-apps/api/core";
import { LogoGrid } from "../components/LogoGrid";
import { AboutUpdatesCard } from "../components/AboutUpdatesCard";
import { ArchiveCard } from "../components/ArchiveCard";
import { useLogo } from "../contexts/LogoContext";
import { useProjects } from "../contexts/ProjectsContext";

export function SettingsPage() {
  const navigate = useNavigate();
  const { logo, pool, isRegenerating, regenerateProgress, setLogo, resetLogo, regeneratePool } = useLogo();
  const { allImagePaths } = useProjects();
  const hasImages = allImagePaths().length > 0;
  const [status, setStatus] = useState<string | null>(null);

  const handlePick = useCallback(
    (dataUrl: string) => {
      setLogo(dataUrl);
      setStatus("Saved. This is now your app logo.");
    },
    [setLogo],
  );

  const handleRegenerate = useCallback(async () => {
    setStatus(null);
    await regeneratePool();
    setStatus("New pool ready. Click any fragment to use it.");
  }, [regeneratePool]);

  const handleReset = useCallback(() => {
    resetLogo();
    setStatus("Surprise — new random fragment from your pool.");
  }, [resetLogo]);

  const countLabel = (() => {
    if (isRegenerating) return `Cropping ${regenerateProgress} / 256…`;
    if (pool.length === 0) return hasImages ? "No fragments yet." : "Drop a folder to start.";
    return `${pool.length} fragments. Click any one to use it.`;
  })();

  return (
    <section className="view">
      <header className="project-header">
        <button type="button" className="back-btn" aria-label="Back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Back</span>
        </button>
        <div className="project-header-text">
          <h1>Settings</h1>
          <div className="project-path">Personalize the app</div>
        </div>
      </header>

      <section className="settings-body">
        <section className="settings-card">
          <div className="settings-card-head">
            <div>
              <h2 className="settings-card-title">Logo</h2>
              <p className="settings-card-sub">
                Your logo is cut from your own artwork. Pick any fragment you like — the pool is 256 random
                crops, saved across app restarts.
              </p>
            </div>
            <div className="settings-logo-current">
              <div
                className={`settings-current-logo${logo ? " has-crop" : ""}`}
                style={logo ? { backgroundImage: `url(${convertFileSrc(logo)})` } : undefined}
              />
              <div className="settings-logo-caption">Current</div>
            </div>
          </div>
          <div className="settings-card-actions">
            <button
              type="button"
              className="primary compact"
              disabled={!hasImages || isRegenerating}
              onClick={handleRegenerate}
            >
              {isRegenerating ? (
                <span className="spinner" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M1 4v6h6" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
              )}
              <span>{isRegenerating ? "Rolling…" : "Roll new pool"}</span>
            </button>
            <button type="button" className="ghost" onClick={handleReset} disabled={pool.length === 0}>
              Random from pool
            </button>
            <div className="settings-status">{status ?? countLabel}</div>
          </div>

          {!hasImages ? (
            <div className="settings-empty">
              Drop a folder of artworks first. The logo picker generates fragments from your images.
            </div>
          ) : (
            <LogoGrid crops={pool} currentLogo={logo} onPick={handlePick} />
          )}
        </section>

        <ArchiveCard />
        <AboutUpdatesCard />
      </section>
    </section>
  );
}
