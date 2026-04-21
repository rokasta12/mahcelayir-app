import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { SettingsButton } from "../components/SettingsButton";
import { Dropzone } from "../components/Dropzone";
import { ProjectCard } from "../components/ProjectCard";
import { useProjects } from "../contexts/ProjectsContext";
import { useDragDrop } from "../hooks/useDragDrop";
import { expandPaths, folderName, pickFolder, readFolderImages } from "../lib/tauriFiles";
import { genId } from "../lib/id";
import type { Project } from "../types";

async function projectFromFolder(folderPath: string): Promise<Project | null> {
  const images = await readFolderImages(folderPath);
  if (images.length === 0) return null;
  return {
    id: genId("proj"),
    name: folderName(folderPath),
    folderPath,
    addedAt: Date.now(),
    imagePaths: images,
    previewPaths: images.slice(0, 4),
    overrides: {},
    pdfs: [],
  };
}

export function HomePage() {
  const navigate = useNavigate();
  const { projects, upsertProject, removeProject } = useProjects();

  const handlePaths = useCallback(
    async (paths: string[]) => {
      const { folderPaths, filePaths } = await expandPaths(paths);

      if (folderPaths.length > 0) {
        let lastId: string | null = null;
        for (const folder of folderPaths) {
          const project = await projectFromFolder(folder);
          if (project) {
            upsertProject(project);
            lastId = project.id;
          }
        }
        if (folderPaths.length === 1 && lastId) {
          navigate(`/project/${lastId}`);
        }
        return;
      }

      if (filePaths.length > 0) {
        const parent = filePaths[0].slice(0, filePaths[0].lastIndexOf("/")) || ".";
        const project: Project = {
          id: genId("proj"),
          name: folderName(parent) || "Untitled",
          folderPath: parent,
          addedAt: Date.now(),
          imagePaths: filePaths,
          previewPaths: filePaths.slice(0, 4),
          overrides: {},
          pdfs: [],
        };
        upsertProject(project);
        navigate(`/project/${project.id}`);
      }
    },
    [navigate, upsertProject],
  );

  useDragDrop(handlePaths);

  const handleBrowse = useCallback(async () => {
    const paths = await pickFolder();
    if (paths.length === 0) return;
    await handlePaths(paths);
  }, [handlePaths]);

  return (
    <section className="view">
      <header className="app-header">
        <div className="brand">
          <BrandMark />
          <div className="brand-text">
            <h1>Mahmut Celayir</h1>
            <div className="brand-sub">Archive & Catalog</div>
          </div>
        </div>
        <SettingsButton />
      </header>

      {projects.length === 0 ? (
        <section className="home-empty">
          <Dropzone onBrowse={handleBrowse} />
        </section>
      ) : (
        <section className="grid-section">
          <div className="grid-header">
            <h2 className="section-title">Projects</h2>
            <button type="button" className="primary compact" onClick={handleBrowse}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                <line x1="12" y1="11" x2="12" y2="17" />
                <line x1="9" y1="14" x2="15" y2="14" />
              </svg>
              <span>Add folder</span>
            </button>
          </div>
          <ul className="project-grid">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} onDelete={removeProject} />
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
