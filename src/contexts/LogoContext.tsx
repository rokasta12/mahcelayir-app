import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  clearCachedPoolPaths,
  clearLogoPath,
  getCachedPoolPaths,
  getSavedLogoPath,
  hasAutoCropped,
  markAutoCropped,
  resetAutoCropFlag,
  saveCachedPoolPaths,
  saveLogoPath,
  streamCropBytes,
} from "../lib/cropLogo";
import { clearCropFiles, listCropFiles, saveCropToFile } from "../lib/nativePool";
import { composeDockIcon } from "../lib/iconComposer";
import { useProjects } from "./ProjectsContext";

async function applyDockIcon(path: string | null): Promise<void> {
  if (!path) return;
  try {
    const iconPath = await composeDockIcon(path);
    await invoke("set_dock_icon", { path: iconPath });
  } catch {
    /* ignore — non-macOS or initialization race */
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
  const { allImagePaths } = useProjects();
  const [logo, setLogoState] = useState<string | null>(() => getSavedLogoPath());
  const [pool, setPool] = useState<string[]>(() => getCachedPoolPaths());
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateProgress, setRegenerateProgress] = useState(0);

  const regenRef = useRef<AbortController | null>(null);
  const autoRunRef = useRef(false);

  // If localStorage has paths but the disk lost them, reconcile at mount.
  useEffect(() => {
    if (pool.length === 0) return;
    let cancelled = false;
    listCropFiles().then((onDisk) => {
      if (cancelled || onDisk.length === pool.length) return;
      const onDiskSet = new Set(onDisk);
      const stillHere = pool.filter((p) => onDiskSet.has(p));
      if (stillHere.length !== pool.length) {
        setPool(stillHere);
        saveCachedPoolPaths(stillHere);
        if (logo && !onDiskSet.has(logo)) {
          clearLogoPath();
          setLogoState(null);
        }
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLogo = useCallback((path: string) => {
    saveLogoPath(path);
    markAutoCropped();
    setLogoState(path);
    void applyDockIcon(path);
  }, []);

  const resetLogo = useCallback(() => {
    // Never fall back to the plain M when real art is available — re-roll
    // a random crop from the existing pool. Only clear to null as a true
    // last resort when there are literally no fragments to choose from.
    if (pool.length > 0) {
      const next = pool[Math.floor(Math.random() * pool.length)];
      saveLogoPath(next);
      markAutoCropped();
      setLogoState(next);
      void applyDockIcon(next);
      return;
    }
    clearLogoPath();
    markAutoCropped();
    setLogoState(null);
  }, [pool]);

  // On mount, push the saved logo to the macOS Dock icon.
  useEffect(() => {
    if (!logo) return;
    void applyDockIcon(logo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const regeneratePool = useCallback(async () => {
    const paths = allImagePaths();
    if (paths.length === 0) return;
    regenRef.current?.abort();
    const controller = new AbortController();
    regenRef.current = controller;
    setIsRegenerating(true);
    setRegenerateProgress(0);

    await clearCropFiles();
    const collected: string[] = [];

    try {
      await streamCropBytes(paths, POOL_SIZE, {
        signal: controller.signal,
        onCrop: async (bytes, index) => {
          if (controller.signal.aborted) return;
          const filePath = await saveCropToFile(bytes, index - 1);
          collected.push(filePath);
          setPool([...collected]);
          setRegenerateProgress(index);
        },
      });
    } catch {
      /* streaming aborted or partial — keep whatever we got */
    } finally {
      // Always persist whatever was collected — never leave the user with
      // empty pool after their old files were deleted.
      if (collected.length > 0) {
        saveCachedPoolPaths(collected);
      } else {
        clearCachedPoolPaths();
        setPool([]);
      }
      if (regenRef.current === controller) {
        setIsRegenerating(false);
      }
    }
  }, [allImagePaths]);

  // Auto-seed pool + logo exactly once after the user has images.
  useEffect(() => {
    if (autoRunRef.current) return;
    const paths = allImagePaths();
    if (paths.length === 0) return;
    if (hasAutoCropped()) {
      autoRunRef.current = true;
      return;
    }
    autoRunRef.current = true;

    const controller = new AbortController();
    const collected: string[] = [];

    (async () => {
      try {
        await streamCropBytes(paths, POOL_SIZE, {
          signal: controller.signal,
          onCrop: async (bytes, index) => {
            if (controller.signal.aborted) return;
            const filePath = await saveCropToFile(bytes, index - 1);
            collected.push(filePath);
            setPool([...collected]);
            setRegenerateProgress(index);
          },
        });
        if (controller.signal.aborted || collected.length === 0) return;
        saveCachedPoolPaths(collected);
        saveLogoPath(collected[0]);
        markAutoCropped();
        setLogoState(collected[0]);
        void applyDockIcon(collected[0]);
      } catch {
        /* silent — typographic fallback stays */
      }
    })();

    return () => controller.abort();
  }, [allImagePaths]);

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

export function hardResetLogoState(): void {
  clearLogoPath();
  clearCachedPoolPaths();
  resetAutoCropFlag();
  clearCropFiles().catch(() => undefined);
}
