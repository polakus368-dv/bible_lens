/**
 * Utilidades para trabajar con los rangos de versículos de una cita concreta.
 * La lista de resultados mergea por capítulo; la hoja de una cita necesita
 * quedarse solo con los versículos de esa ocurrencia.
 */

import type { VerseRange } from "../parser/bibleParser";

export function expandVerseRanges(ranges: VerseRange[]): Set<number> {
  const numbers = new Set<number>();
  for (const range of ranges) {
    const end = range.end ?? range.start;
    for (let verse = range.start; verse <= end; verse++) {
      numbers.add(verse);
    }
  }
  return numbers;
}

export function filterVersesByRanges<T extends { number: number }>(
  verses: T[],
  ranges: VerseRange[]
): T[] {
  const numbers = expandVerseRanges(ranges);
  return verses.filter((verse) => numbers.has(verse.number));
}
