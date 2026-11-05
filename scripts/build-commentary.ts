/**
 * Genera los comentarios de dominio público desde sermonindex.net.
 *
 * Uso (desde bible-lens/):
 *   node scripts/tsx-shim.js scripts/build-commentary.ts                      # todos
 *   node scripts/tsx-shim.js scripts/build-commentary.ts --only adamclarke    # uno
 *   node scripts/tsx-shim.js scripts/build-commentary.ts --only gill rev      # un libro
 *   node scripts/tsx-shim.js scripts/build-commentary.ts --check              # solo compara
 *
 * Descarga /commentary/<módulo>/<OSIS>/<cap> con pausa entre peticiones, parsea
 * los bloques por versículo y escribe assets/commentary/<módulo>.json:
 *   { "GEN": { "1": [ { "v": 1, "e": 3, "t": "texto…" } ] } }
 * Además regenera src/services/commentary/commentaryMetadata.generated.ts.
 *
 * No se ejecuta en runtime: la app solo lee los archivos locales.
 */

import fs from "node:fs";
import path from "node:path";
import { BOOKS } from "../src/services/parser/books";
import type { CommentaryItem } from "./commentary/parse";
import { parseCommentaryChapter, tidyCommentary } from "./commentary/parse";
import { COMMENTARY_SOURCES, type CommentarySource } from "./commentary/sources";

type CommentaryDB = Record<string, Record<string, CommentaryItem[]>>;

const BASE_URL = "https://www.sermonindex.net/commentary";
const USER_AGENT =
  "BibleLens-build/1.0 (app personal de lectura bíblica; +https://github.com/)";
const DELAY_MS = 1_200;
const MAX_IN_FLIGHT = 3;
const FETCH_TIMEOUT_MS = 45_000;
const MIN_CHAPTERS = Number(process.env.COMMENTARY_MIN_CHAPTERS ?? 1_000);

type Args = { check: boolean; only: string[] };

function parseArgs(argv: string[]): Args {
  const check = argv.includes("--check");
  const index = argv.indexOf("--only");
  let only: string[] = [];
  if (index >= 0) {
    only = argv.slice(index + 1).filter((arg) => !arg.startsWith("--"));
  }
  return { check, only };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchChapter(
  source: CommentarySource,
  bookId: string,
  chapter: number
): Promise<string | null> {
  const url = `${BASE_URL}/${source.id}/${bookId}/${chapter}`;
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await sleep(2_000 * attempt);
    }
  }
  throw new Error(`${source.id} ${bookId} ${chapter}: ${lastError}`);
}

async function buildSource(
  source: CommentarySource,
  books: typeof BOOKS,
  check: boolean
): Promise<{ chapters: number; entries: number; chars: number; bytes: number } | null> {
  const db: CommentaryDB = {};
  let chapters = 0;
  let entries = 0;
  let chars = 0;
  const total = books.reduce((sum, book) => sum + book.chapters, 0);
  let done = 0;

  // Las peticiones arrancan espaciadas DELAY_MS (cortesía con el servidor) pero
  // hasta MAX_IN_FLIGHT quedan en vuelo: así no se paga un RTT completo por capítulo.
  const inFlight = new Set<Promise<void>>();
  const waitForSlot = async () => {
    while (inFlight.size >= MAX_IN_FLIGHT) {
      await Promise.race(inFlight);
    }
  };

  for (const book of books) {
    for (let chapter = 1; chapter <= book.chapters; chapter++) {
      await waitForSlot();
      const claimedAt = Date.now();
      const task = (async () => {
        const html = await fetchChapter(source, book.id, chapter);
        done++;
        if (done % 100 === 0 || done === total) {
          process.stdout.write(`\r  ${source.id}: ${done}/${total} capítulos`);
        }
        if (!html) return;

        const items = tidyCommentary(parseCommentaryChapter(html, book.id, chapter));
        if (items.length === 0) return;

        db[book.id] ??= {};
        db[book.id][String(chapter)] = items;
        chapters++;
        entries += items.length;
        for (const item of items) chars += item.t.length;
      })();
      const tracked = task.finally(() => inFlight.delete(tracked));
      inFlight.add(tracked);
      if (!check) {
        await sleep(Math.max(0, claimedAt + DELAY_MS - Date.now()));
      }
    }
  }
  await Promise.all(inFlight);
  process.stdout.write("\n");

  const json = JSON.stringify(db);
  const bytes = Buffer.byteLength(json);

  if (check) {
    const manifest = readManifest();
    const current = manifest.find((meta) => meta.id === source.id);
    const chaptersChanged = current ? current.chapters !== chapters : true;
    console.log(
      `  ${source.id}: local=${current?.chapters ?? 0} capítulos ` +
        `(${current ? formatMb(current.sizeBytes) : "sin manifiesto"}), ` +
        `remoto=${chapters} capítulos (${formatMb(bytes)})` +
        (chaptersChanged ? " [CAMBIÓ]" : " [igual]")
    );
    return null;
  }

  if (chapters < MIN_CHAPTERS) {
    throw new Error(
      `${source.id}: solo ${chapters} capítulos con contenido; se esperaban más de ${MIN_CHAPTERS}`
    );
  }

  const outputDir = path.join(process.cwd(), "assets", "commentary");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, `${source.id}.json`), `${json}\n`);
  console.log(
    `  ${source.id}: ${chapters} capítulos, ${entries} entradas, ` +
      `${chars.toLocaleString("es")} caracteres, ${formatMb(bytes)}`
  );
  return { chapters, entries, chars, bytes };
}

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

type Meta = {
  id: string;
  abbr: string;
  name: string;
  lang: string;
  license: "public-domain";
  sourceUrl: string;
  chapters: number;
  sizeBytes: number;
};

const MANIFEST_PATH = () =>
  path.join(
    process.cwd(),
    "src",
    "services",
    "commentary",
    "commentaryMetadata.generated.ts"
  );

function readManifest(): Meta[] {
  const file = MANIFEST_PATH();
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, "utf8");
  // El manifiesto es TypeScript: se toma solo el literal de array tras "= ".
  const match = /^export const GENERATED_COMMENTARIES[^\n]*?=\s*(\[)/m.exec(text);
  const arrayStart = match ? match.index + match[0].lastIndexOf("[") : -1;
  const end = text.lastIndexOf("]");
  if (arrayStart < 0 || end < arrayStart) return [];
  // Los manifiestos antiguos declaraban `license: 'public-domain'` con comillas
  // simples: JSON.parse no las acepta.
  const array = text.slice(arrayStart, end + 1);
  return JSON.parse(array.replace(/'/g, '"')) as Meta[];
}

function writeManifest(metas: Meta[]): void {
  const file = MANIFEST_PATH();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const ordered = COMMENTARY_SOURCES.map((source) => metas.find((m) => m.id === source.id))
    .filter((meta): meta is Meta => Boolean(meta));
  const generated = [
    "// Generado por scripts/build-commentary.ts. No editar a mano.",
    'import type { CommentaryModuleMeta } from "./types";',
    "",
    `export const GENERATED_COMMENTARIES: CommentaryModuleMeta[] = ${JSON.stringify(ordered, null, 2)};`,
    "",
  ].join("\n");
  fs.writeFileSync(file, generated);
}

async function main(): Promise<void> {
  if (!fs.existsSync(path.join(process.cwd(), "package.json"))) {
    throw new Error("Ejecutá el script desde el directorio bible-lens/");
  }
  const { check, only } = parseArgs(process.argv.slice(2));

  const moduleIds = only.filter((arg) => COMMENTARY_SOURCES.some((s) => s.id === arg));
  const bookIds = only.filter((arg) => !moduleIds.includes(arg)).map((arg) => arg.toUpperCase());
  const modules = moduleIds.length
    ? COMMENTARY_SOURCES.filter((source) => moduleIds.includes(source.id))
    : COMMENTARY_SOURCES;
  const books = bookIds.length
    ? BOOKS.filter((book) => bookIds.includes(book.id))
    : BOOKS;

  if (bookIds.length && bookIds.some((id) => !BOOKS.some((book) => book.id === id))) {
    throw new Error(`Libro desconocido en --only: ${bookIds.join(", ")}`);
  }

  console.log(
    `${check ? "Comprobando" : "Generando"} ${modules.map((m) => m.id).join(", ")}` +
      ` · ${books.length} libros` + (check ? "" : ` · pausa ${DELAY_MS} ms`)
  );

  if (check) {
    for (const source of modules) await buildSource(source, books, true);
    return;
  }

  const metas: Meta[] = readManifest();
  for (const source of modules) {
    const result = await buildSource(source, books, false);
    if (!result) continue;
    const meta: Meta = {
      id: source.id,
      abbr: source.abbr,
      name: source.name,
      lang: source.lang,
      license: "public-domain",
      sourceUrl: source.sourceUrl,
      chapters: result.chapters,
      sizeBytes: result.bytes,
    };
    const index = metas.findIndex((m) => m.id === source.id);
    if (index >= 0) metas[index] = meta;
    else metas.push(meta);
  }
  writeManifest(metas);
  console.log(`\nManifiesto generado: ${MANIFEST_PATH()}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
