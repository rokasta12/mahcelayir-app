import { createContext, useCallback, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import type { ArtworkOverride, GeneratedPdf, Project } from "../types";
import { useArchive } from "./ArchiveProvider";

type ProjectsContextValue = {
  projects: Project[];
  ready: boolean;
  getProject: (id: string) => Project | undefined;
  upsertProject: (project: Project) => void;
  removeProject: (id: string) => void;
  addPdf: (projectId: string, pdf: GeneratedPdf) => void;
  removePdf: (projectId: string, pdfId: string) => void;
  updateOverride: (projectId: string, path: string, override: ArtworkOverride) => void;
  updateImages: (projectId: string, updater: (images: string[]) => string[]) => void;
  allImagePaths: () => string[];
};

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const { state, ready, update } = useArchive();
  const projects = state.projects;

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => b.addedAt - a.addedAt),
    [projects],
  );

  const getProject = useCallback(
    (id: string) => projects.find((p) => p.id === id),
    [projects],
  );

  const upsertProject = useCallback(
    (project: Project) => {
      update((prev) => {
        const idx = prev.projects.findIndex((p) => p.id === project.id);
        const next = [...prev.projects];
        if (idx >= 0) next[idx] = project;
        else next.push(project);
        return { ...prev, projects: next };
      });
    },
    [update],
  );

  const removeProject = useCallback(
    (id: string) => {
      update((prev) => ({ ...prev, projects: prev.projects.filter((p) => p.id !== id) }));
    },
    [update],
  );

  const addPdf = useCallback(
    (projectId: string, pdf: GeneratedPdf) => {
      update((prev) => ({
        ...prev,
        projects: prev.projects.map((p) =>
          p.id === projectId ? { ...p, pdfs: [pdf, ...p.pdfs] } : p,
        ),
      }));
    },
    [update],
  );

  const removePdf = useCallback(
    (projectId: string, pdfId: string) => {
      update((prev) => ({
        ...prev,
        projects: prev.projects.map((p) =>
          p.id === projectId ? { ...p, pdfs: p.pdfs.filter((x) => x.id !== pdfId) } : p,
        ),
      }));
    },
    [update],
  );

  const updateOverride = useCallback(
    (projectId: string, path: string, override: ArtworkOverride) => {
      update((prev) => ({
        ...prev,
        projects: prev.projects.map((p) => {
          if (p.id !== projectId) return p;
          const nextOverrides = { ...p.overrides, [path]: { ...p.overrides[path], ...override } };
          return { ...p, overrides: nextOverrides };
        }),
      }));
    },
    [update],
  );

  const updateImages = useCallback(
    (projectId: string, updater: (images: string[]) => string[]) => {
      update((prev) => ({
        ...prev,
        projects: prev.projects.map((p) => {
          if (p.id !== projectId) return p;
          const imagePaths = updater(p.imagePaths);
          return { ...p, imagePaths, previewPaths: imagePaths.slice(0, 4) };
        }),
      }));
    },
    [update],
  );

  const allImagePaths = useCallback(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of projects) {
      for (const path of p.imagePaths) {
        if (seen.has(path)) continue;
        seen.add(path);
        out.push(path);
      }
    }
    return out;
  }, [projects]);

  const value = useMemo<ProjectsContextValue>(
    () => ({
      projects: sortedProjects,
      ready,
      getProject,
      upsertProject,
      removeProject,
      addPdf,
      removePdf,
      updateOverride,
      updateImages,
      allImagePaths,
    }),
    [
      sortedProjects,
      ready,
      getProject,
      upsertProject,
      removeProject,
      addPdf,
      removePdf,
      updateOverride,
      updateImages,
      allImagePaths,
    ],
  );

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects(): ProjectsContextValue {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects must be used within ProjectsProvider");
  return ctx;
}
