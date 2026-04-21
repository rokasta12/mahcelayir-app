import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { clearCrops, listCrops, saveCrop } from "../lib/archive";
import { streamCropBytes } from "../lib/cropLogo";
import { composeDockIcon } from "../lib/iconComposer";
import { useArchive } from "./ArchiveProvider";
import { useProjects } from "./ProjectsContext";

async function applyDockIcon(path: string | null): Promise<void> {
  if (!path) return;
  try {
    const iconPath = await composeDockIcon(path);
    await invoke("set_dock_icon", { path: iconPath });
  } catch {
    /* non-macOS or init race — silent */
  }
}

const POOL_SIZE = 256;

type LogoContextValue = {
  logo: string | null;
  pool: string[];
  poolReady: boolean;
  isRegenerating: boolean;
  regenerateProgress: number;
  setLogo: (path: string) => void;
  resetLogo: () => void;
  regeneratePool: () => Promise<void>;
};

const LogoContext = createContext<LogoContextValue | null>(null);

export function LogoProvider({ children }: { children: ReactNode }) {
  const { state, ready, update } = useArchive();
  const { allImagePaths } = useProjects();

  const [pool, setPool] = useState<string[]>([]);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateProgress, setRegenerateProgress] = useState(0);

  const regenRef = useRef<AbortController | null>(null);
  const autoRunRef = useRef(false);
  const initRef = useRef(false);

  const logo = state.logoCurrent;

  // Initial load of pool from archive folder.
  useEffect(() => {
    if (!ready || initRef.current) return;
    initRef.current = true;
    let cancelled = false;
    listCrops()
      .then((crops) => {
        if (cancelled) return;
        setPool(crops);
        // Reconcile: if saved logo no longer exists on disk, clear it.
        if (logo && !crops.includes(logo)) {
          update({ logoCurrent: null });
        }
      })
      .catch((err) => console.error("[logo] listCrops failed:", err));
    return () => {
      cancelled = true;
    };
  }, [ready, logo, update]);

  // Push saved logo to macOS Dock on mount (once).
  useEffect(() => {
    if (!ready || !logo) return;
    void applyDockIcon(logo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const setLogo = useCallback(
    (path: string) => {
      update({ logoCurrent: path, autoSeeded: true });
      void applyDockIcon(path);
    },
    [update],
  );

  const resetLogo = useCallback(() => {
    if (pool.length > 0) {
      const next = pool[Math.floor(Math.random() * pool.length)];
      update({ logoCurrent: next, autoSeeded: true });
      void applyDockIcon(next);
      return;
    }
    update({ logoCurrent: null, autoSeeded: true });
  }, [pool, update]);

  const regeneratePool = useCallback(async () => {
    const paths = allImagePaths();
    if (paths.length === 0) return;
    regenRef.current?.abort();
    const controller = new AbortController();
    regenRef.current = controller;
    setIsRegenerating(true);
    setRegenerateProgress(0);

    await clearCrops();
    const collected: string[] = [];

    try {
      await streamCropBytes(paths, POOL_SIZE, {
        signal: controller.signal,
        onCrop: async (bytes, index) => {
          if (controller.signal.aborted) return;
          const filePath = await saveCrop(bytes, index - 1);
          collected.push(filePath);
          setPool([...collected]);
          setRegenerateProgress(index);
        },
      });
    } catch {
      /* partial — keep what we have */
    } finally {
      if (regenRef.current === controller) setIsRegenerating(false);
      if (collected.length === 0) setPool([]);
    }
  }, [allImagePaths]);

  // Auto-seed pool + logo once after the user has images.
  useEffect(() => {
    if (!ready || autoRunRef.current) return;
    if (state.autoSeeded) {
      autoRunRef.current = true;
      return;
    }
    const paths = allImagePaths();
    if (paths.length === 0) return;
    autoRunRef.current = true;

    const controller = new AbortController();
    const collected: string[] = [];

    (async () => {
      try {
        await streamCropBytes(paths, POOL_SIZE, {
          signal: controller.signal,
          onCrop: async (bytes, index) => {
            if (controller.signal.aborted) return;
            const filePath = await saveCrop(bytes, index - 1);
            collected.push(filePath);
            setPool([...collected]);
            setRegenerateProgress(index);
          },
        });
        if (controller.signal.aborted || collected.length === 0) return;
        const first = collected[0];
        update({ logoCurrent: first, autoSeeded: true });
        void applyDockIcon(first);
      } catch {
        /* silent */
      }
    })();

    return () => controller.abort();
  }, [ready, state.autoSeeded, allImagePaths, update]);

  const poolReady = pool.length > 0;

  const value = useMemo<LogoContextValue>(
    () => ({
      logo,
      pool,
      poolReady,
      isRegenerating,
      regenerateProgress,
      setLogo,
      resetLogo,
      regeneratePool,
    }),
    [logo, pool, poolReady, isRegenerating, regenerateProgress, setLogo, resetLogo, regeneratePool],
  );

  return <LogoContext.Provider value={value}>{children}</LogoContext.Provider>;
}

export function useLogo(): LogoContextValue {
  const ctx = useContext(LogoContext);
  if (!ctx) throw new Error("useLogo must be used within LogoProvider");
  return ctx;
}
