import { useCallback, useMemo } from "react";
import type { Artwork, ArtworkOverride, Project } from "../types";
import { parseFilename } from "../lib/parseFilename";
import { basename, IMAGE_EXT } from "../lib/tauriFiles";
import { useProjects } from "../contexts/ProjectsContext";
import { genId } from "../lib/id";

export function isComplete(a: Pick<Artwork, "title" | "medium" | "dimensions" | "year">): boolean {
  return (
    a.title.trim().length > 0 &&
    a.medium.trim().length > 0 &&
    a.dimensions.trim().length > 0 &&
    a.year !== null
  );
}

export function missingFieldsOf(a: Artwork): string[] {
  const missing: string[] = [];
  if (!a.title.trim()) missing.push("title");
  if (!a.medium.trim()) missing.push("medium");
  if (!a.dimensions.trim()) missing.push("dimensions");
  if (a.year === null) missing.push("year");
  return missing;
}

function buildArtwork(path: string, override?: ArtworkOverride): Artwork {
  const filename = basename(path);
  const parsed = parseFilename(filename);
  const title = override?.title ?? (parsed ? parsed.title : filename.replace(IMAGE_EXT, ""));
  const medium = override?.medium ?? parsed?.medium ?? "";
  const dimensions = override?.dimensions ?? parsed?.dimensions ?? "";
  const year = override?.year !== undefined ? override.year : (parsed?.year ?? null);
  return {
    id: genId("art"),
    path,
    filename,
    title,
    medium,
    dimensions,
    year,
    valid: isComplete({ title, medium, dimensions, year }),
  };
}

function sortArtworks(list: Artwork[]): Artwork[] {
  return [...list].sort((a, b) => {
    if (!a.valid && b.valid) return 1;
    if (a.valid && !b.valid) return -1;
    const ay = a.year ?? Number.POSITIVE_INFINITY;
    const by = b.year ?? Number.POSITIVE_INFINITY;
    if (ay !== by) return ay - by;
    return a.title.localeCompare(b.title, "tr");
  });
}

export function useArtworks(project: Project | undefined): {
  artworks: Artwork[];
  updateField: (path: string, patch: ArtworkOverride) => void;
  removeByPath: (path: string) => void;
} {
  const { updateOverride, updateImages } = useProjects();

  const artworks = useMemo<Artwork[]>(() => {
    if (!project) return [];
    return sortArtworks(
      project.imagePaths.map((path) => buildArtwork(path, project.overrides[path])),
    );
  }, [project]);

  const updateField = useCallback(
    (path: string, patch: ArtworkOverride) => {
      if (!project) return;
      updateOverride(project.id, path, patch);
    },
    [project, updateOverride],
  );

  const removeByPath = useCallback(
    (path: string) => {
      if (!project) return;
      updateImages(project.id, (paths) => paths.filter((p) => p !== path));
    },
    [project, updateImages],
  );

  return { artworks, updateField, removeByPath };
}
