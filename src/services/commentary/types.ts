export type CommentaryModuleMeta = {
  id: string;
  abbr: string;
  name: string;
  lang: string;
  license: "public-domain" | "cc-by-sa";
  sourceUrl: string;
  chapters: number;
  sizeBytes: number;
};
