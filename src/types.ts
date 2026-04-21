export type ParsedFilename = {
  title: string;
  medium: string;
  dimensions: string;
  year: number | null;
};

export type Artwork = {
  id: string;
  path: string;
  filename: string;
  title: string;
  medium: string;
  dimensions: string;
  year: number | null;
  valid: boolean;
};

export type ArtworkOverride = Partial<Pick<Artwork, "title" | "medium" | "dimensions" | "year">>;

export type GeneratedPdf = {
  id: string;
  path: string;
  filename: string;
  generatedAt: number;
  artworkCount: number;
};

export type Project = {
  id: string;
  name: string;
  folderPath: string;
  addedAt: number;
  imagePaths: string[];
  previewPaths: string[];
  overrides: Record<string, ArtworkOverride>;
  pdfs: GeneratedPdf[];
};
