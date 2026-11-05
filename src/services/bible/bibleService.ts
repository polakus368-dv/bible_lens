/**
 * Bible Service - Offline first.
 * Carga la versión española elegida desde assets/bible y hace lookup local.
 * KJV/inglés es opcional (en-kjv.json no está incluido); si falta, usa MOCK_EN.
 * Estructura JSON: { "GEN": { "1": { "1": "En el principio...", ... } } }
 * Fallback: si no hay archivo, usa mocks embebidos para que la UI no quede vacía.
 */

import { BOOKS, normalizeBookName } from "../parser/books";
import {
  ParsedReference,
  formatReference,
  parseReferences,
} from "../parser/bibleParser";
import { DEFAULT_VERSION_ID, getBibleVersion } from "./versions";

// Mock mínimo embebido (para que parser/UI funcione aunque no haya JSON)
// Incluye versículos muy citados. El JSON completo offline los reemplaza.
const MOCK_ES: Record<string, Record<string, Record<string, string>>> = {
  JHN: { "3": { "16": "Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna." } },
  GEN: {
    "1": {
      "1": "En el principio creó Dios los cielos y la tierra.",
      "2": "Y la tierra estaba desordenada y vacía, y las tinieblas estaban sobre la faz del abismo, y el Espíritu de Dios se movía sobre la faz de las aguas.",
      "3": "Y dijo Dios: Sea la luz; y fue la luz.",
    },
  },
  PSA: { "23": { "1": "Jehová es mi pastor; nada me faltará.", "2": "En lugares de delicados pastos me hará descansar; Junto a aguas de reposo me pastoreará." } },
  MAT: { "5": { "1": "Viendo la multitud, subió al monte; y sentándose, vinieron a él sus discípulos.", "9": "Bienaventurados los pacificadores, porque ellos serán llamados hijos de Dios." } },
  "1CO": { "13": { "4": "El amor es sufrido, es benigno; el amor no tiene envidia, el amor no es jactancioso, no se envanece;", "7": "Todo lo sufre, todo lo cree, todo lo espera, todo lo soporta." } },
  ROM: { "8": { "28": "Y sabemos que a los que aman a Dios, todas las cosas les ayudan a bien, esto es, a los que conforme a su propósito son llamados." } },
  PHP: { "4": { "13": "Todo lo puedo en Cristo que me fortalece." } },
};

const MOCK_EN: Record<string, Record<string, Record<string, string>>> = {
  JHN: { "3": { "16": "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life." } },
  GEN: { "1": { "1": "In the beginning God created the heaven and the earth." } },
  PSA: { "23": { "1": "The LORD is my shepherd; I shall not want." } },
};

export type BibleDB = Record<string, Record<string, Record<string, string>>>;

let dbES: BibleDB | null = null;
let dbEN: BibleDB | null = null;
let activeVersionId: string | null = null;
let enLoaded = false;

async function loadSpanishDB(versionId: string): Promise<BibleDB> {
  if (dbES && activeVersionId === versionId) return dbES;
  try {
    dbES = getBibleVersion(versionId).load();
  } catch {
    dbES = MOCK_ES;
  }
  activeVersionId = versionId;
  return dbES;
}

async function loadEnglishDB(): Promise<void> {
  if (enLoaded) return;
  try {
    // @ts-ignore
    const en = require("../../../assets/bible/en-kjv.json");
    if (en) dbEN = en.default ?? en;
  } catch {}
  if (!dbEN) dbEN = MOCK_EN;
  enLoaded = true;
}

function collectVerses(
  chap: Record<string, string>,
  ranges: ParsedReference["verseRanges"]
): Array<{ number: number; text: string }> {
  const found = new Map<number, string>();

  for (const range of ranges) {
    const end = range.end ?? range.start;
    for (let verse = range.start; verse <= end; verse++) {
      const text = chap[String(verse)];
      if (text) found.set(verse, text);
    }
  }

  return Array.from(found.entries())
    .sort(([a], [b]) => a - b)
    .map(([number, text]) => ({ number, text }));
}

export type VerseResult = {
  ref: ParsedReference;
  lang: "es" | "en";
  displayRef: string;
  verses: Array<{ number: number; text: string }>;
  notFound: boolean;
};

export function lookupVerses(
  db: BibleDB,
  refs: ParsedReference[],
  lang: "es" | "en" = "es"
): VerseResult[] {
  return refs.map((ref) => {
    const displayRef = formatReference(ref, lang);
    const chap = db[ref.bookId]?.[String(ref.chapter)];

    if (!chap) {
      return { ref, lang, displayRef, verses: [], notFound: true };
    }

    const verses = collectVerses(chap, ref.verseRanges);
    return { ref, lang, displayRef, verses, notFound: verses.length === 0 };
  });
}

export async function getVerses(
  refs: ParsedReference[],
  lang: "es" | "en" = "es",
  versionId: string = DEFAULT_VERSION_ID
): Promise<VerseResult[]> {
  if (lang === "en") {
    await loadEnglishDB();
    return lookupVerses(dbEN!, refs, lang);
  }
  const db = await loadSpanishDB(versionId);
  return lookupVerses(db, refs, lang);
}

// Versión síncrona: usa los mocks si el JSON todavía no se cargó
export function getVersesSync(refs: ParsedReference[], lang: "es" | "en" = "es"): VerseResult[] {
  const db = lang === "en" ? dbEN ?? MOCK_EN : dbES ?? MOCK_ES;
  return lookupVerses(db, refs, lang);
}

export async function getVerseText(ref: ParsedReference, lang: "es" | "en" = "es"): Promise<string> {
  const [res] = await getVerses([ref], lang);
  return res.verses.map((v) => v.text).join(" ");
}

export type Chapter = {
  bookId: string;
  chapter: number;
  verses: Array<{ number: number; text: string }>;
};

export function getChapter(
  db: BibleDB,
  bookId: string,
  chapter: number
): Chapter | null {
  const chap = db[bookId]?.[String(chapter)];
  if (!chap) return null;

  return {
    bookId,
    chapter,
    verses: Object.keys(chap)
      .map(Number)
      .sort((a, b) => a - b)
      .map((number) => ({ number, text: chap[String(number)] })),
  };
}

export async function loadChapter(
  bookId: string,
  chapter: number,
  versionId: string = DEFAULT_VERSION_ID
): Promise<Chapter | null> {
  return getChapter(await loadSpanishDB(versionId), bookId, chapter);
}

export type BookQuery = {
  bookId: string;
  chapter?: number;
  verse?: number;
};

/**
 * Interpreta lo escrito en el buscador del lector: "Jn 3:16", "Sal 23",
 * "Juan", "juan 3", "1co13". Devuelve null si no reconoce el libro.
 * Sin número de capítulo hereda `fallbackChapter` (el capítulo abierto).
 */
export function resolveBookQuery(
  query: string,
  fallbackChapter?: number
): BookQuery | null {
  const text = query.trim();
  if (!text) return null;

  // El parser de citas exige al menos un versículo; el buscador también
  // necesita aceptar "Sal 23" o "Juan 3:16". Se agrega uno para el parseo.
  const [parsed] = parseReferences(hasVerseNumbers(text) ? text : `${text} 1`);
  if (parsed) {
    return {
      bookId: parsed.bookId,
      chapter: parsed.chapter,
      verse: hasVerseNumbers(text) ? parsed.verseRanges[0]?.start : undefined,
    };
  }

  const book = normalizeBookName(text) ?? findBookByNamePrefix(text);
  if (!book) return null;

  return {
    bookId: book.id,
    chapter: fallbackChapter
      ? Math.min(Math.max(1, fallbackChapter), book.chapters)
      : 1,
  };
}

function hasVerseNumbers(text: string): boolean {
  return /[:\-,]\s*\d|[0-9]\s*(?:-|al)\s*\d/i.test(text);
}

function findBookByNamePrefix(query: string): (typeof BOOKS)[number] | undefined {
  const needle = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .trim();
  if (needle.length < 2) return undefined;

  const matches = BOOKS.filter((book) => {
    const full = book.displayES
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return full.startsWith(needle) || book.names.some((name) => name.startsWith(needle));
  });

  // Con prefijo numérico se gana especificidad ("1 cro" -> 1 Crónicas); si no,
  // el nombre más corto ("gene" no queda ambiguo, "cron" sí).
  const numbered = matches.filter((book) => /\d|^[123]\s/.test(book.displayES));
  const pool = numbered.length > 0 && matches.length > 1 ? numbered : matches;

  return pool.sort((a, b) => a.displayES.length - b.displayES.length)[0];
}
