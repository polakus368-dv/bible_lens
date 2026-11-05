/**
 * Genera las versiones bíblicas compactas desde los snapshots de
 * https://github.com/mrk214/bible-data-es-spa
 *
 * Uso (desde bible-lens/):
 *   npx tsx scripts/build-versions.ts
 *
 * Descarga los JSON originales, los convierte al formato
 * { "GEN": { "1": { "1": "texto" } } } y regenera el manifiesto
 * src/services/bible/versionMetadata.generated.ts.
 *
 * No se ejecuta en runtime: la app solo lee los archivos locales.
 */

import fs from "node:fs";
import path from "node:path";
import { BOOKS } from "../src/services/parser/books";
import type { BibleDB, BibleVersionMeta } from "../src/services/bible/types";

type SourceVerseItem = {
  type?: string;
  verse_numbers?: number[];
  lines?: string[];
};

type SourceChapter = {
  usfm?: string;
  items?: SourceVerseItem[];
};

type SourceBook = {
  usfm?: string;
  human?: string;
  chapters?: SourceChapter[];
};

type SourceBible = {
  local_abbreviation?: string;
  local_title?: string;
  copyright?: { html?: string; text?: string };
  books?: SourceBook[];
};

type VersionConfig = {
  id: string;
  file: string;
  displayName: string;
  snapshot: string;
  sourceUrl: string;
};

const REPO_URL = "https://github.com/mrk214/bible-data-es-spa";
const SNAPSHOT_BASE = "https://mrk214.github.io/snapshots/es___spa___spa";

const SOURCES: VersionConfig[] = [
  {
    id: "RVR1960",
    file: "es-rvr1960.json",
    displayName: "Reina Valera 1960",
    snapshot: "RVR1960_vid_149.json",
    sourceUrl: REPO_URL,
  },
  {
    id: "NVI",
    file: "es-nvi.json",
    displayName: "Nueva Versión Internacional",
    snapshot: "NVI_vid_128.json",
    sourceUrl: REPO_URL,
  },
  {
    id: "LBLA",
    file: "es-lbla.json",
    displayName: "La Biblia de las Américas",
    snapshot: "LBLA_vid_89.json",
    sourceUrl: REPO_URL,
  },
];

const RVR1909_META: BibleVersionMeta = {
  id: "RVR1909",
  abbr: "RVR1909",
  name: "Reina Valera 1909",
  file: "es-rvr1909.json",
  copyright: "Reina Valera 1909. Dominio público / CC0 1.0.",
  isPublicDomain: true,
  sourceUrl: "https://github.com/BibleAquifer/ReinaValera1909",
};

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  laquo: "«",
  raquo: "»",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
};

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(Number(dec))
    )
    .replace(/&([a-z]+);/gi, (match, name: string) => {
      return NAMED_ENTITIES[name.toLowerCase()] ?? match;
    });
}

function cleanText(value: string): string {
  const withoutNotes = value.replace(/<sup[\s\S]*?<\/sup>/gi, " ");
  const withoutTags = withoutNotes.replace(/<[^>]*>/g, " ");
  return decodeEntities(withoutTags)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function fetchSnapshot(config: VersionConfig): Promise<SourceBible> {
  const url = `${SNAPSHOT_BASE}/${config.snapshot}`;
  console.log(`Descargando ${config.id}: ${url}`);
  const response = await fetch(url, { signal: AbortSignal.timeout(180_000) });
  if (!response.ok) {
    throw new Error(
      `${config.id}: HTTP ${response.status} ${response.statusText} al descargar ${url}`
    );
  }
  return (await response.json()) as SourceBible;
}

function convert(config: VersionConfig, source: SourceBible): {
  db: BibleDB;
  verseCount: number;
  assignments: number;
  multiVerseItems: number;
  mergedDuplicates: number;
  exactDuplicates: number;
  emptyItems: number;
} {
  const sourceBooks = source.books ?? [];
  if (sourceBooks.length !== 66) {
    throw new Error(
      `${config.id}: se esperaban 66 libros, llegaron ${sourceBooks.length}`
    );
  }

  const knownBooks = new Set(BOOKS.map((book) => book.id));
  const db: BibleDB = {};
  let verseCount = 0;
  let assignments = 0;
  let multiVerseItems = 0;
  let mergedDuplicates = 0;
  let exactDuplicates = 0;
  let emptyItems = 0;

  for (const book of sourceBooks) {
    const bookId = String(book.usfm ?? "").toUpperCase();
    if (!knownBooks.has(bookId)) {
      throw new Error(
        `${config.id}: libro desconocido "${bookId}" (${book.human ?? "sin nombre"})`
      );
    }

    for (const chapter of book.chapters ?? []) {
      const chapterMatch = /(?:^|\.)(\d+)$/.exec(String(chapter.usfm ?? ""));
      const chapterNumber = chapterMatch ? Number(chapterMatch[1]) : NaN;
      if (!Number.isInteger(chapterNumber) || chapterNumber < 1) {
        throw new Error(
          `${config.id}: capítulo inválido "${chapter.usfm}" en ${bookId}`
        );
      }

      for (const item of chapter.items ?? []) {
        if (item.type !== "verse") continue;

        const numbers = (item.verse_numbers ?? [])
          .map(Number)
          .filter((number) => Number.isInteger(number) && number >= 0);
        if (numbers.length === 0) continue;
        if (numbers.length > 1) multiVerseItems++;

        const text = cleanText((item.lines ?? []).join(" "));
        if (!text) {
          emptyItems++;
          continue;
        }

        for (const number of numbers) {
          const chapterKey = String(chapterNumber);
          const verseKey = String(number);
          db[bookId] ??= {};
          db[bookId][chapterKey] ??= {};
          const existing = db[bookId][chapterKey][verseKey];
          assignments++;

          if (existing === undefined) {
            db[bookId][chapterKey][verseKey] = text;
            verseCount++;
          } else if (existing === text) {
            // La fuente repite el mismo capítulo/versículo (por ejemplo, Abdías).
            exactDuplicates++;
          } else {
            // El versículo viene partido en varios ítems: conservar ambos fragmentos.
            db[bookId][chapterKey][verseKey] =
              `${existing} ${text}`.replace(/\s+/g, " ").trim();
            mergedDuplicates++;
          }
        }
      }
    }
  }

  if (verseCount < 30_000) {
    throw new Error(
      `${config.id}: solo se generaron ${verseCount} versículos únicos; se esperaban más de 30.000`
    );
  }

  return {
    db,
    verseCount,
    assignments,
    multiVerseItems,
    mergedDuplicates,
    exactDuplicates,
    emptyItems,
  };
}

function buildMeta(config: VersionConfig, source: SourceBible): BibleVersionMeta {
  const copyright = cleanText(
    source.copyright?.text ?? source.copyright?.html ?? ""
  );
  if (!copyright) {
    throw new Error(`${config.id}: la fuente no trae texto de copyright`);
  }

  return {
    id: config.id,
    abbr: config.id,
    name: config.displayName,
    file: config.file,
    copyright,
    isPublicDomain: false,
    sourceUrl: config.sourceUrl,
  };
}

async function main(): Promise<void> {
  const projectRoot = process.cwd();
  if (!fs.existsSync(path.join(projectRoot, "package.json"))) {
    throw new Error("Ejecutá el script desde el directorio bible-lens/");
  }

  const bibleDir = path.join(projectRoot, "assets", "bible");
  fs.mkdirSync(bibleDir, { recursive: true });

  const metas: BibleVersionMeta[] = [];

  for (const config of SOURCES) {
    const source = await fetchSnapshot(config);
    const sourceLabel = source.local_abbreviation ?? config.id;
    if (sourceLabel !== config.id) {
      throw new Error(
        `${config.id}: la fuente se identifica como ${sourceLabel}`
      );
    }

    const converted = convert(config, source);
    const outputPath = path.join(bibleDir, config.file);
    const json = JSON.stringify(converted.db);
    fs.writeFileSync(outputPath, `${json}\n`);

    const sample = converted.db.JHN?.["3"]?.["16"] ?? "";
    console.log(
      `  ${config.id}: ${converted.verseCount} versículos únicos, ` +
        `${formatMb(Buffer.byteLength(json))}, ` +
        `${Object.keys(converted.db).length} libros`
    );
    console.log(
      `  asignaciones: ${converted.assignments}, ` +
        `fragmentos unidos: ${converted.mergedDuplicates}, ` +
        `duplicados exactos: ${converted.exactDuplicates}, ` +
        `multi-versículo: ${converted.multiVerseItems}, ` +
        `vacíos: ${converted.emptyItems}`
    );
    console.log(`  Jn 3:16: ${sample.slice(0, 90)}${sample ? "…" : ""}`);

    metas.push(buildMeta(config, source));
  }

  const generatedPath = path.join(
    projectRoot,
    "src",
    "services",
    "bible",
    "versionMetadata.generated.ts"
  );
  const generated = [
    "// Generado por scripts/build-versions.ts. No editar a mano.",
    'import type { BibleVersionMeta } from "./types";',
    "",
    "export const GENERATED_VERSIONS = [",
    ...JSON.stringify([RVR1909_META, ...metas], null, 2)
      .split("\n")
      .slice(1, -1)
      .map((line) => `  ${line}`),
    "] satisfies BibleVersionMeta[];",
    "",
  ].join("\n");
  fs.writeFileSync(generatedPath, generated);

  console.log(`\nManifiesto generado: ${generatedPath}`);
  console.log(`Versiones disponibles: ${[RVR1909_META, ...metas].map((m) => m.id).join(", ")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
