import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getVersion } from "@tauri-apps/api/app";
import {
  emptyState,
  readArchive,
  writeArchiveDebounced,
  type ArchiveState,
} from "../lib/archive";
import { runLegacyMigrationIfNeeded } from "../lib/legacyMigration";

type ArchiveContextValue = {
  state: ArchiveState;
  ready: boolean;
  error: string | null;
  /** Apply a partial patch to the state. Write is debounced. */
  update: (patch: Partial<ArchiveState> | ((prev: ArchiveState) => ArchiveState)) => void;
};

const ArchiveContext = createContext<ArchiveContextValue | null>(null);

export function ArchiveProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ArchiveState>(() => emptyState("0.0.0"));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const appVersion = await getVersion().catch(() => "0.0.0");
        let loaded = await readArchive();

        // First-launch migration: if archive is empty but localStorage has data,
        // pull it in. Safe no-op on subsequent launches.
        if (!loaded || loaded.projects.length === 0) {
          const migrated = await runLegacyMigrationIfNeeded(appVersion);
          if (migrated) loaded = migrated;
        }

        if (cancelled) return;
        setState(loaded ?? emptyState(appVersion));
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        console.error("[archive] load failed:", err);
        setError(err instanceof Error ? err.message : String(err));
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(
    (patch: Partial<ArchiveState> | ((prev: ArchiveState) => ArchiveState)) => {
      setState((prev) => {
        const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
        void writeArchiveDebounced(next).catch((err) => {
          console.error("[archive] write failed:", err);
          setError(err instanceof Error ? err.message : String(err));
        });
        return next;
      });
    },
    [],
  );

  const value = useMemo<ArchiveContextValue>(
    () => ({ state, ready, error, update }),
    [state, ready, error, update],
  );

  return <ArchiveContext.Provider value={value}>{children}</ArchiveContext.Provider>;
}

export function useArchive(): ArchiveContextValue {
  const ctx = useContext(ArchiveContext);
  if (!ctx) throw new Error("useArchive must be used within ArchiveProvider");
  return ctx;
}
