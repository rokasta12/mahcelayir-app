import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

type PdfPanelState = { path: string; filename: string } | null;

type PdfPanelContextValue = {
  current: PdfPanelState;
  show: (state: { path: string; filename: string }) => void;
  close: () => void;
};

const PdfPanelContext = createContext<PdfPanelContextValue | null>(null);

export function PdfPanelProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<PdfPanelState>(null);

  const show = useCallback((state: { path: string; filename: string }) => {
    setCurrent(state);
  }, []);

  const close = useCallback(() => setCurrent(null), []);

  const value = useMemo(() => ({ current, show, close }), [current, show, close]);

  return <PdfPanelContext.Provider value={value}>{children}</PdfPanelContext.Provider>;
}

export function usePdfPanel(): PdfPanelContextValue {
  const ctx = useContext(PdfPanelContext);
  if (!ctx) throw new Error("usePdfPanel must be used within PdfPanelProvider");
  return ctx;
}
