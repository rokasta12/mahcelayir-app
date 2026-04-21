import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

type DragDropHandler = (paths: string[]) => void | Promise<void>;

export function useDragDrop(onDrop: DragDropHandler) {
  const [isDragActive, setIsDragActive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const unlisten: Array<() => void> = [];

    const register = async (event: string, handler: (e: { payload: unknown }) => void) => {
      const off = await listen(event, handler);
      if (cancelled) off();
      else unlisten.push(off);
    };

    void register("tauri://drag-enter", () => setIsDragActive(true));
    void register("tauri://drag-leave", () => setIsDragActive(false));
    void register("tauri://drag-drop", async (event) => {
      setIsDragActive(false);
      const payload = event.payload as { paths?: string[] } | null;
      const paths = payload?.paths ?? [];
      if (paths.length > 0) {
        try {
          await onDrop(paths);
        } catch (err) {
          console.error("[useDragDrop] handler failed:", err);
        }
      }
    });

    return () => {
      cancelled = true;
      for (const fn of unlisten) fn();
    };
  }, [onDrop]);

  return { isDragActive };
}
