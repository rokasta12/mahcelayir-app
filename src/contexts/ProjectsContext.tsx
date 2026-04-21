import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { GeneratedPdf, Project, ArtworkOverride } from "../types";
import {
  addPdfToProject as storeAddPdf,
  loadProjects,
  removePdfFromProject as storeRemovePdf,
  removeProject as storeRemoveProject,
  upsertProject as storeUpsertProject,
} from "../lib/store";

type ProjectsContextValue = {
  projects: Project[];
  getProject: (id: string) => Project | undefined;
  upsertProject: (project: Project) => void;
  removeProject: (id: string) => void;
  addPdf: (projectId: string, pdf: GeneratedPdf) => void;
  removePdf: (projectId: string, pdfId: string) => void;
  updateOverride: (projectId: string, path: string, override: ArtworkOverride) => void;
  updateImages: (projectId: string, updater: (images: string[]) => string[]) => void;
  allImagePaths: () => string[];
  refresh: () => void;
};

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());

  const refresh = useCallback(() => setProjects(loadProjects()), []);

  const getProject = useCallback(
    (id: string) => projects.find((p) => p.id === id),
    [projects],
  );

  const upsertProject = useCallback((project: Project) => {
    storeUpsertProject(project);
    setProjects(loadProjects());
  }, []);

  const removeProject = useCallback((id: string) => {
    storeRemoveProject(id);
    setProjects(loadProjects());
  }, []);

  const addPdf = useCallback((projectId: string, pdf: GeneratedPdf) => {
    storeAddPdf(projectId, pdf);
    setProjects(loadProjects());
  }, []);

  const removePdf = useCallback((projectId: string, pdfId: string) => {
    storeRemovePdf(projectId, pdfId);
    setProjects(loadProjects());
  }, []);

  const updateOverride = useCallback(
    (projectId: string, path: string, override: ArtworkOverride) => {
      setProjects((current) => {
        const next = current.map((p) => {
          if (p.id !== projectId) return p;
          const nextOverrides = { ...p.overrides, [path]: { ...p.overrides[path], ...override } };
          const updated = { ...p, overrides: nextOverrides };
          storeUpsertProject(updated);
          return updated;
        });
        return next;
      });
    },
    [],
  );

  const updateImages = useCallback(
    (projectId: string, updater: (images: string[]) => string[]) => {
      setProjects((current) => {
        const next = current.map((p) => {
          if (p.id !== projectId) return p;
          const imagePaths = updater(p.imagePaths);
          const updated: Project = {
            ...p,
            imagePaths,
            previewPaths: imagePaths.slice(0, 4),
          };
          storeUpsertProject(updated);
          return updated;
        });
        return next;
      });
    },
    [],
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
      projects,
      getProject,
      upsertProject,
      removeProject,
      addPdf,
      removePdf,
      updateOverride,
      updateImages,
      allImagePaths,
      refresh,
    }),
    [projects, getProject, upsertProject, removeProject, addPdf, removePdf, updateOverride, updateImages, allImagePaths, refresh],
  );

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects(): ProjectsContextValue {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects must be used within ProjectsProvider");
  return ctx;
}
