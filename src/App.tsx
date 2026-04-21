import { Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { ArchiveProvider } from "./contexts/ArchiveProvider";
import { ProjectsProvider } from "./contexts/ProjectsContext";
import { LogoProvider } from "./contexts/LogoContext";
import { PdfPanelProvider, usePdfPanel } from "./contexts/PdfPanelContext";
import { UpdateProvider } from "./contexts/UpdateContext";
import { PdfViewer } from "./components/PdfViewer";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { UpdateBanner } from "./components/UpdateBanner";
import { HomePage } from "./pages/HomePage";
import { ProjectGalleryPage } from "./pages/ProjectGalleryPage";
import { ProjectEditPage } from "./pages/ProjectEditPage";
import { SettingsPage } from "./pages/SettingsPage";

function useDragVisual() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const cleanups: Array<() => void> = [];
    const register = async (event: string, handler: () => void) => {
      const off = await listen(event, handler);
      if (cancelled) off();
      else cleanups.push(off);
    };
    void register("tauri://drag-enter", () => setActive(true));
    void register("tauri://drag-leave", () => setActive(false));
    void register("tauri://drag-drop", () => setActive(false));
    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  }, []);
  useEffect(() => {
    document.body.classList.toggle("drag-active", active);
  }, [active]);
}

function DragOverlay() {
  useDragVisual();
  return null;
}

function AppShell() {
  const { current, close } = usePdfPanel();
  const open = !!current;
  return (
    <div className={`app-shell${open ? " with-panel" : ""}`}>
      <div className="app-main">
        <main className="app">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/project/:id" element={<ProjectGalleryPage />} />
            <Route path="/project/:id/prepare" element={<ProjectEditPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
      {current && (
        <aside className="pdf-side-panel">
          <PdfViewer path={current.path} filename={current.filename} onClose={close} />
        </aside>
      )}
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <UpdateProvider>
        <ArchiveProvider>
          <ProjectsProvider>
            <LogoProvider>
              <PdfPanelProvider>
                <DragOverlay />
                <UpdateBanner />
                <AppShell />
              </PdfPanelProvider>
            </LogoProvider>
          </ProjectsProvider>
        </ArchiveProvider>
      </UpdateProvider>
    </ErrorBoundary>
  );
}
