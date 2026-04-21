import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  checkForUpdate,
  downloadAndInstall,
  getAppVersion,
  type UpdateState,
} from "../lib/updater";

type UpdateContextValue = {
  state: UpdateState;
  currentVersion: string;
  recheck: () => Promise<void>;
  install: () => Promise<void>;
  dismiss: () => void;
  dismissed: boolean;
};

const UpdateContext = createContext<UpdateContextValue | null>(null);

export function UpdateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UpdateState>({ kind: "idle" });
  const [currentVersion, setCurrentVersion] = useState("unknown");
  const [dismissed, setDismissed] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    getAppVersion().then((v) => {
      if (mountedRef.current) setCurrentVersion(v);
    });
  }, []);

  const recheck = useCallback(async () => {
    if (!mountedRef.current) return;
    setState({ kind: "checking" });
    const next = await checkForUpdate();
    if (mountedRef.current) setState(next);
  }, []);

  useEffect(() => {
    // silent launch-time check after a short delay so it doesn't block first paint
    const t = setTimeout(() => {
      void recheck();
    }, 1200);
    return () => clearTimeout(t);
  }, [recheck]);

  const install = useCallback(async () => {
    if (state.kind !== "available") return;
    const { update, version } = state;
    setState({ kind: "downloading", version, downloaded: 0, total: 0 });
    try {
      await downloadAndInstall(update, (downloaded, total) => {
        if (!mountedRef.current) return;
        setState({ kind: "downloading", version, downloaded, total });
      });
      if (mountedRef.current) setState({ kind: "installing", version });
      // relaunch happens inside downloadAndInstall; app will restart
    } catch (err) {
      if (mountedRef.current) {
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : String(err),
          checkedAt: Date.now(),
        });
      }
    }
  }, [state]);

  const dismiss = useCallback(() => setDismissed(true), []);

  // reset dismissed state when a new version becomes available
  useEffect(() => {
    if (state.kind === "available") setDismissed(false);
  }, [state.kind]);

  const value = useMemo<UpdateContextValue>(
    () => ({ state, currentVersion, recheck, install, dismiss, dismissed }),
    [state, currentVersion, recheck, install, dismiss, dismissed],
  );

  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>;
}

export function useUpdate(): UpdateContextValue {
  const ctx = useContext(UpdateContext);
  if (!ctx) throw new Error("useUpdate must be used within UpdateProvider");
  return ctx;
}
