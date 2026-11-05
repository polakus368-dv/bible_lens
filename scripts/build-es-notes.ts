/**
 * Genera las notas en español de unfoldingWord (es_tn) en formato de comentario.
 *
 * Uso (desde bible-lens/):
 *   node scripts/tsx-shim.js scripts/build-es-notes.ts
 *   node scripts/tsx-shim.js scripts/build-es-notes.ts --only JHN ROM ...
 *
 * Fuente: https://git.door43.org/uW/es_tn/raw/branch/master/ingredients/<OSIS>.tsv
 * Licencia: CC BY-SA 4.0 (atribución + misma licencia para el derivado).
 *
 * Salida (mismo formato que los comentarios bundleados, pero descargable):
 *   assets/commentary/uW-es_tn.json  { "JHN": { "3": [ { "v": 16, "t": "…" } ] } }
 * y actualiza el manifiesto src/services/commentary/commentaryMetadata.generated.ts
 * con el módulo `uW-es_tn` marcado como descargable.
 */

import fs from "node:fs";
import path from "node:path";
import type { CommentaryItem } from "./commentary/parse";

const BASE_URL = "https://git.door43.org/uW/es_tn/raw/branch/master/ingredients";
const MODULE_ID = "uW-es_tn";
const EXPECTED_FILES = 41;
const MIN_BOOKS = 30;

type CommentaryDB = Record<string, Record<string, CommentaryItem[]>>;

/** Quita Markdown ligero y el enlace "Ver: …" al pie de cada nota. */
function cleanNote(raw: string): string {
  let text = raw.replace(/\\n/g, "\n");
  if (text.startsWith('"')) text = text.slice(1);
  text = text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/[“”"]/g, (quote) => (quote === '"' ? "”" : quote))
    .replace(/\n\s*Ver:\s*[^\n]*(\n|$)/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.endsWith('"')) text = text.slice(0, -1).trimEnd();
  return text;
}

/** Parser TSV mínimo: HREF puede llevar tabulaciones internas, REF/QUOTE no. */
export function parseTsBook(tsv: string): Array<{ ref: string; quote: string; note: string }> {
  const lines = tsv.split("\n");
  const header = lines.shift()?.replace(/^\uFEFF/, "").split("\t") ?? [];
  const refIndex = header.indexOf("REF");
  const quoteIndex = header.indexOf("QUOTE");
  const hrefIndex = header.indexOf("HREF");
  if (refIndex < 0 || hrefIndex < 0) throw new Error("TSV sin columnas REF/HREF");

  const rows: Array<{ ref: string; quote: string; note: string }> = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = line.split("\t");
    const note = cleanNote(cells.slice(hrefIndex).join(" "));
    if (!note) continue;
    rows.push({
      ref: cells[refIndex].trim(),
      quote: quoteIndex >= 0 ? (cells[quoteIndex] ?? "").trim() : "",
      note,
    });
  }
  return rows;
}

async function downloadBook(bookId: string): Promise<string | null> {
  const url = `${BASE_URL}/${bookId}.tsv`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2_000 * attempt));
    }
  }
  return null;
}

async function listBooks(): Promise<string[]> {
  const response = await fetch("https://git.door43.org/api/v1/repos/uW/es_tn/contents/ingredients", {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`No se pudo listar es_tn: HTTP ${response.status}`);
  const files = (await response.json()) as Array<{ name: string }>;
  return files
    .map((file) => file.name)
    .filter((name) => /^[1-3]?[A-Z]{2,3}\.tsv$/.test(name))
    .map((name) => name.replace(/\.tsv$/, ""))
    .sort();
}

async function main(): Promise<void> {
  if (!fs.existsSync(path.join(process.cwd(), "package.json"))) {
    throw new Error("Ejecutá el script desde el directorio bible-lens/");
  }
  const only = process.argv
    .slice(2)
    .filter((arg) => !arg.startsWith("--") && /^[1-3]?[A-Z]{2,3}$/.test(arg));

  const available = await listBooks();
  if (available.length !== EXPECTED_FILES) {
    console.warn(`  aviso: es_tn tiene ${available.length} libros (se esperaban ${EXPECTED_FILES})`);
  }
  const books = only.length ? only : available;

  const db: CommentaryDB = {};
  let entries = 0;
  for (const [index, bookId] of books.entries()) {
    const tsv = await downloadBook(bookId);
    process.stdout.write(`\r  ${bookId}: ${index + 1}/${books.length}`);
    if (!tsv) continue;

    for (const row of parseTsBook(tsv)) {
      const match = /^(\d+):(\d+)/.exec(row.ref);
      if (!match) continue;
      const chapter = String(Number(match[1]));
      const verse = Number(match[2]);
      // La cita al inicio ya está en el texto bíblico: se usa solo como contexto.
      const text = row.quote ? `${row.quote} — ${row.note}` : row.note;
      db[bookId] ??= {};
      db[bookId][chapter] ??= [];
      // Una nota por fila: el visor agrupa las del mismo versículo.
      db[bookId][chapter].push({ v: verse, t: text });
      entries++;
    }
  }
  process.stdout.write("\n");

  if (Object.keys(db).length < Math.min(MIN_BOOKS, books.length)) {
    throw new Error(`Solo ${Object.keys(db).length} libros con notas; revisar la fuente`);
  }

  const outputDir = path.join(process.cwd(), "assets", "commentary");
  fs.mkdirSync(outputDir, { recursive: true });
  const json = JSON.stringify(db);
  fs.writeFileSync(path.join(outputDir, `${MODULE_ID}.json`), `${json}\n`);
  console.log(
    `  ${MODULE_ID}: ${Object.keys(db).length} libros, ${entries} notas, ` +
      `${(Buffer.byteLength(json) / 1024 / 1024).toFixed(2)} MB`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
