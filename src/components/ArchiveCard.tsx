import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { getArchiveStats, relocateArchive, type ArchiveStats } from "../lib/archive";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function ArchiveCard() {
  const [stats, setStats] = useState<ArchiveStats | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await getArchiveStats();
      setStats(s);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const reveal = useCallback(async () => {
    if (!stats) return;
    try {
      await invoke("plugin:opener|open_path", { path: stats.dir });
    } catch {
      // Fallback via opener plugin default API.
      try {
        const { openPath } = await import("@tauri-apps/plugin-opener");
        await openPath(stats.dir);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Couldn't open folder");
      }
    }
  }, [stats]);

  const relocate = useCallback(async () => {
    setMessage(null);
    try {
      const picked = await openDialog({ directory: true, multiple: false });
      if (!picked || typeof picked !== "string") return;
      setWorking(true);
      await relocateArchive(picked);
      setMessage("Archive moved. Reload the app to use the new folder.");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }, [refresh]);

  return (
    <section className="settings-card">
      <div className="settings-card-head">
        <div>
          <h2 className="settings-card-title">Archive folder</h2>
          <p className="settings-card-sub">
            Everything — projects, logo fragments, generated PDFs — lives in this folder.
            Back it up by copying the folder anywhere.
          </p>
        </div>
      </div>

      {stats && (
        <div className="archive-info">
          <div className="archive-row">
            <span className="archive-label">Location</span>
            <code className="archive-path">{stats.dir}</code>
          </div>
          <div className="archive-row archive-meta">
            <span>
              {stats.hasArchiveFile ? "data file ok" : "no data file yet"}
              {stats.hasBackup && " · backup ✓"}
            </span>
            <span>
              {stats.cropCount} logo fragment{stats.cropCount === 1 ? "" : "s"}
            </span>
            <span>{formatBytes(stats.sizeBytes)} total</span>
          </div>
        </div>
      )}

      <div className="settings-card-actions">
        <button type="button" className="ghost" onClick={() => void reveal()} disabled={!stats}>
          Reveal in Finder
        </button>
        <button type="button" className="ghost" onClick={() => void relocate()} disabled={working}>
          {working ? "Moving…" : "Change folder…"}
        </button>
        {message && <div className="settings-status">{message}</div>}
      </div>
    </section>
  );
}
