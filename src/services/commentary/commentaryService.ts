/**
 * Comentarios descargables: clásicos de dominio público (vía sermonindex.net)
 * y notas en español de unfoldingWord. Los JSON y el manifiesto se generan
 * con scripts/build-commentary.ts; el APK no los incluye y se guardan en
 * Paths.document/commentary/ desde ⚙ Ajustes.
 */

import { GENERATED_COMMENTARIES } from "./commentaryMetadata.generated";
import type { CommentaryModuleMeta } from "./types";
import { isDownloaded, listDownloads, readDownloadedChapter } from "./downloads";

export type CommentaryEntry = {
  author: string;
  verseStart: number;
  verseEnd: number;
  text: string;
};

export type CommentaryModule = CommentaryModuleMeta;

export const COMMENTARIES: CommentaryModule[] = GENERATED_COMMENTARIES;

export const DEFAULT_COMMENTARY_IDS = ["adamclarke", "matthewhenry"];

/**
 * Capítulo de cualquier autor. `downloaded: false` indica que el autor existe
 * pero todavía no está en el dispositivo.
 */
export function getChapterCommentaryAny(
  authorId: string,
  bookId: string,
  chapter: number
): { entries: CommentaryEntry[]; downloaded: boolean } {
  return {
    entries: readDownloadedChapter(authorId, bookId, chapter) ?? [],
    downloaded: isDownloaded(authorId),
  };
}

/** Autores conocidos: clásicos del manifiesto más los descargables (uW). */
export function allAuthors(): CommentaryModule[] {
  const known = new Set(COMMENTARIES.map((module) => module.id));
  const extra: CommentaryModule[] = listDownloads()
    .filter((info) => !known.has(info.module.id))
    .map((info) => ({
      id: info.module.id,
      abbr: info.module.abbr,
      name: info.module.name,
      lang: info.module.lang,
      license: "cc-by-sa",
      sourceUrl: info.module.sourceUrl,
      chapters: 0,
      sizeBytes: info.module.sizeBytes,
    }));
  return [...COMMENTARIES, ...extra];
}

/** Entradas cuyo rango de versículos intersecta alguno de `verses`. */
export function pickForVerses(
  entries: CommentaryEntry[],
  verses: number[]
): CommentaryEntry[] {
  if (verses.length === 0) return entries;
  return entries.filter((entry) =>
    verses.some((verse) => verse >= entry.verseStart && verse <= entry.verseEnd)
  );
}

/** Autores con contenido en ese capítulo (para el carrusel). */
export function listAuthorsForChapter(
  bookId: string,
  chapter: number,
  authorIds?: string[]
): Array<{ module: CommentaryModule; count: number; preview: string; missing: boolean }> {
  const modules = authorIds
    ? allAuthors().filter((module) => authorIds.includes(module.id))
    : COMMENTARIES;
  const result: Array<{
    module: CommentaryModule;
    count: number;
    preview: string;
    missing: boolean;
  }> = [];
  for (const module of modules) {
    const { entries, downloaded } = getChapterCommentaryAny(module.id, bookId, chapter);
    if (!downloaded) {
      result.push({ module, count: 0, preview: "", missing: true });
      continue;
    }
    if (entries.length === 0) continue;
    result.push({
      module,
      count: entries.length,
      preview: entries[0].text.split("\n\n")[0].slice(0, 160),
      missing: false,
    });
  }
  return result;
}
