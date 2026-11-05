/**
 * Construye las tres salidas de exportación a partir de todos los resultados.
 * Sin dependencias de React Native/Expo para poder testearlo en Node.
 */

import type { VerseResult } from "../bible/bibleService";
import type { BibleVersion } from "../bible/versions";

export type ExportFormat = "plain" | "txt" | "md";

export const NOT_FOUND_MARKER = "[Texto no encontrado en esta versión]";
export const missingVerseMarker = (verse: number) =>
  `[Versículo ${verse} no encontrado en esta versión]`;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatExportDate(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function formatFileStamp(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(
    date.getHours()
  )}${pad(date.getMinutes())}`;
}

function expectedVerseNumbers(result: VerseResult): number[] {
  const numbers = new Set<number>();
  for (const range of result.ref.verseRanges) {
    const end = range.end ?? range.start;
    for (let verse = range.start; verse <= end; verse++) numbers.add(verse);
  }
  return Array.from(numbers).sort((a, b) => a - b);
}

type ExportLine =
  | { kind: "verse"; number: number; text: string }
  | { kind: "missing"; number: number };

/** Recorre el rango esperado para señalar también versículos sueltos faltantes. */
function resultLines(result: VerseResult): ExportLine[] {
  if (result.notFound) return [];
  const texts = new Map(result.verses.map((verse) => [verse.number, verse.text]));
  return expectedVerseNumbers(result).map((number) => {
    const text = texts.get(number);
    return text === undefined
      ? { kind: "missing", number }
      : { kind: "verse", number, text };
  });
}

function plainResult(result: VerseResult): string[] {
  const lines = [result.displayRef];
  if (result.notFound) {
    lines.push(NOT_FOUND_MARKER);
  } else {
    for (const line of resultLines(result)) {
      lines.push(
        line.kind === "verse"
          ? `${line.number} ${line.text}`
          : missingVerseMarker(line.number)
      );
    }
  }
  return lines;
}

export function buildPlainExport(
  results: VerseResult[],
  version: BibleVersion
): string {
  const blocks = results.map((result) => plainResult(result).join("\n"));
  return [
    `Bible Lens · ${version.abbr}`,
    version.name,
    "",
    blocks.join("\n\n"),
    "",
    "—",
    version.copyright,
  ].join("\n");
}

export function buildTxtExport(
  results: VerseResult[],
  version: BibleVersion,
  date: Date = new Date()
): string {
  const blocks = results.map((result) => plainResult(result).join("\n"));
  return [
    `Bible Lens · ${version.abbr}`,
    version.name,
    formatExportDate(date),
    "",
    blocks.join("\n\n"),
    "",
    "—",
    version.copyright,
  ].join("\n");
}

function escapeMarkdown(value: string): string {
  return value.replace(/([\\`*_{}\[\]<>#])/g, "\\$1");
}

function markdownResult(result: VerseResult): string[] {
  const lines = [`## ${escapeMarkdown(result.displayRef)}`];
  if (result.notFound) {
    lines.push(`> _${NOT_FOUND_MARKER}_`);
  } else {
    for (const line of resultLines(result)) {
      lines.push(
        line.kind === "verse"
          ? `> **${line.number}** ${line.text}`
          : `> _${missingVerseMarker(line.number)}_`
      );
    }
  }
  return lines;
}

export function buildMarkdownExport(
  results: VerseResult[],
  version: BibleVersion,
  date: Date = new Date()
): string {
  return [
    `# Bible Lens · ${version.abbr}`,
    `**${version.name}**`,
    `_${formatExportDate(date)}_`,
    "",
    results.map((result) => markdownResult(result).join("\n")).join("\n\n"),
    "",
    "---",
    `_${version.copyright}_`,
  ].join("\n");
}

export function buildExport(
  format: ExportFormat,
  results: VerseResult[],
  version: BibleVersion,
  date: Date = new Date()
): string {
  if (format === "md") return buildMarkdownExport(results, version, date);
  if (format === "txt") return buildTxtExport(results, version, date);
  return buildPlainExport(results, version);
}
