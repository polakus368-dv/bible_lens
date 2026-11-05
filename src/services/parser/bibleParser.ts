/**
 * Parser de citas bíblicas bilingüe ES/EN.
 * - Soporta abreviaturas, con/sin acentos, con puntos.
 * - Separadores capítulo:versículo -> ":" "," "." " " y "-" (OCR)
 * - Rangos: "1-3", "1 al 3".
 * - Listas: "16,18", "16-18,20", "16, 18 y 20".
 * - Formatos "capítulo/versículo".
 * - Correcciones conservadoras de errores típicos de OCR.
 */

import { BOOK_MAP, BOOK_VARIANTS_SORTED, escapeRegex, normalizeBookName } from "./books";

export type VerseRange = {
  start: number;
  end?: number;
};

export type ParsedReference = {
  bookId: string; // OSIS e.g. JHN
  bookDisplayES: string;
  bookDisplayEN: string;
  chapter: number;
  verseRanges: VerseRange[];
  raw: string; // texto original matched
  normalized: string; // ej "JHN 3:16" o "1CO 13:4-7,9"
};

/**
 * Una cita concreta dentro del texto original. A diferencia de
 * `parseReferences`, que mergea por capítulo, cada span corresponde a una
 * ocurrencia y conserva sus propios rangos de versículos.
 */
export type CitationSpan = {
  /** Índice inicial en el texto original (incluido). */
  start: number;
  /** Índice final en el texto original (excluido). */
  end: number;
  /** Referencia de esta ocurrencia, sin mergear. */
  ref: ParsedReference;
  /** `${bookId} ${chapter}`, para relacionarla con un VerseResult. */
  key: string;
};

const OCR_DIGITS: Record<string, string> = {
  l: "1",
  I: "1",
  i: "1",
  O: "0",
  o: "0",
  S: "5",
  s: "5",
};

const ORDINAL_BASES =
  "samuel|reyes|cronicas|corintios|tesalonicenses|timoteo|pedro|juan";

function normalizeOcrChars(text: string): string {
  return text.replace(/[“”«»]/g, '"').replace(/[—–−]/g, "-");
}

function normalizeOcrText(text: string): string {
  return normalizeOcrChars(text).replace(/\s+/g, " ");
}

/**
 * Corrige confusiones frecuentes de OCR sin tocar el texto general:
 * - Ordinales: 1ª / 1ra / 1era / primera -> 1
 * - Libros: l Corintios -> 1 Corintios, R0manos -> Romanos, 5al -> Sal
 */
function repairCommonOcr(text: string): string {
  let repaired = text
    .replace(/\b(1|2|3)\s*(?:ª|a|ra|da|era|er|ro|do)(?![a-z0-9])\.?/gi, "$1")
    .replace(/\bprimera\b/gi, "1")
    .replace(/\bsegunda\b/gi, "2")
    .replace(/\btercera\b/gi, "3")
    .replace(/\b([123])\s+de\s+(?=(?:[a-z]+\b))/gi, "$1 ");

  repaired = repaired.replace(
    new RegExp(`\\b[lIi]\\s+(?=(?:${ORDINAL_BASES})\\b)`, "gi"),
    "1 "
  );

  return repaired.replace(/\b[A-Za-z0-9]*[A-Za-z][A-Za-z0-9]*\b/g, (token) => {
    if (/^[123]/.test(token)) return token;
    // No tocar "Juan1" / "Salmo100": el número final es capítulo, no OCR.
    if (/^[a-z]+[0-9]+$/i.test(token)) return token;
    return token.replace(/0/g, "o").replace(/5/g, "s").replace(/1/g, "l");
  });
}

function padReplacement(prefix: string, length: number): string {
  return prefix + " ".repeat(Math.max(0, length - prefix.length));
}

/**
 * Igual que `repairCommonOcr`, pero cada reemplazo conserva la longitud del
 * original. Los espacios sobrantes se colapsan después con un mapa de índices.
 * Así podemos reutilizar `parseCitation` y volver a coordenadas del texto real.
 */
function repairOcrPreservingLength(text: string): string {
  let repaired = text.replace(
    /\b(1|2|3)\s*(?:ª|a|ra|da|era|er|ro|do)(?![a-z0-9])\.?/gi,
    (match, digit: string) => padReplacement(digit, match.length)
  );

  repaired = repaired
    .replace(/\bprimera\b/gi, (match) => padReplacement("1", match.length))
    .replace(/\bsegunda\b/gi, (match) => padReplacement("2", match.length))
    .replace(/\btercera\b/gi, (match) => padReplacement("3", match.length))
    .replace(
      /\b([123])\s+de\s+(?=(?:[a-z]+\b))/gi,
      (match) => match[0] + " ".repeat(Math.max(0, match.length - 1))
    );

  repaired = repaired.replace(
    new RegExp(`\\b[lIi](?=\\s+(?:${ORDINAL_BASES})\\b)`, "gi"),
    "1"
  );

  return repaired.replace(/\b[A-Za-z0-9]*[A-Za-z][A-Za-z0-9]*\b/g, (token) => {
    if (/^[123]/.test(token)) return token;
    if (/^[a-z]+[0-9]+$/i.test(token)) return token;
    return token.replace(/0/g, "o").replace(/5/g, "s").replace(/1/g, "l");
  });
}

/**
 * Colapsa cada bloque de espacios (incluidos saltos de línea) en un solo
 * espacio. `map[i]` es el índice del primer carácter de ese bloque en el texto
 * de entrada.
 */
function collapseWhitespaceWithMap(text: string): {
  text: string;
  map: number[];
} {
  const out: string[] = [];
  const map: number[] = [];
  let index = 0;

  while (index < text.length) {
    if (/\s/.test(text[index])) {
      const start = index;
      while (index < text.length && /\s/.test(text[index])) index++;
      out.push(" ");
      map.push(start);
    } else {
      out.push(text[index]);
      map.push(index);
      index++;
    }
  }

  return { text: out.join(""), map };
}

/**
 * Quita diacríticos preservando un mapa hacia el texto de entrada. Los textos
 * en español son BMP, pero el mapa también funciona con pares surrogados.
 */
function stripAccentsWithMap(text: string): { text: string; map: number[] } {
  const out: string[] = [];
  const map: number[] = [];

  for (let index = 0; index < text.length; index++) {
    const stripped = text[index]
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    for (let offset = 0; offset < stripped.length; offset++) {
      out.push(stripped[offset]);
      map.push(index);
    }
  }

  return { text: out.join(""), map };
}

const BOOK_RE = new RegExp(
  `(^|[^a-z0-9])(${BOOK_VARIANTS_SORTED.map(escapeRegex).join("|")})(?![a-z])`,
  "gi"
);

// Al continuar una lista (coma, ";" o "y"), si lo que sigue empieza con un
// libro no hay que consumir ese número como versículo. También evita que la
// "S" de "Salmo" se lea como el dígito 5.
const BOOK_AT_START_RE = new RegExp(
  `^(?:${BOOK_VARIANTS_SORTED.map(escapeRegex).join("|")})(?![a-z])`,
  "i"
);

function startsBookReference(text: string, pos: number): boolean {
  return BOOK_AT_START_RE.test(text.slice(pos));
}

function startsListNumber(text: string, pos: number): boolean {
  const rest = text.slice(pos);
  return /^\d/.test(rest) || /^[lIiOoSs]\d/.test(rest);
}

function readNumber(text: string, start: number): { value: number; end: number } | null {
  let end = start;
  let digits = "";

  while (end < text.length && digits.length < 3) {
    const char = text[end];
    if (/[0-9]/.test(char)) {
      digits += char;
    } else if (OCR_DIGITS[char] !== undefined) {
      // Al inicio de un número, "S" de "Salmo" o "l" de "la" no son dígitos;
      // pero "lO" sí puede ser 10 (ambos son sustituciones de OCR).
      const nextChar = text[end + 1] ?? "";
      if (
        digits.length === 0 &&
        /[a-z]/i.test(nextChar) &&
        OCR_DIGITS[nextChar] === undefined
      ) {
        break;
      }
      digits += OCR_DIGITS[char];
    } else {
      break;
    }
    end++;
  }

  if (digits.length === 0) return null;
  return { value: parseInt(digits, 10), end };
}

function skipSpaces(text: string, start: number): number {
  let end = start;
  while (end < text.length && /\s/.test(text[end])) end++;
  return end;
}

function parseVerseExpression(
  text: string,
  start: number
): { ranges: VerseRange[]; end: number } | null {
  const ranges: VerseRange[] = [];
  let pos = start;
  let first = true;

  while (true) {
    pos = skipSpaces(text, pos);
    const number = readNumber(text, pos);
    if (!number) break;

    const range: VerseRange = { start: number.value };
    pos = number.end;

    const afterStart = skipSpaces(text, pos);
    let rangeEnd: number | null = null;
    let afterRange = afterStart;

    if (text[afterStart] === "-") {
      const endNumber = readNumber(text, skipSpaces(text, afterStart + 1));
      if (endNumber) {
        rangeEnd = endNumber.value;
        afterRange = endNumber.end;
      }
    } else {
      const al = /^al\b/i.exec(text.slice(afterStart));
      if (al) {
        const endNumber = readNumber(text, skipSpaces(text, afterStart + al[0].length));
        if (endNumber) {
          rangeEnd = endNumber.value;
          afterRange = endNumber.end;
        }
      }
    }

    if (rangeEnd !== null) {
      if (rangeEnd < range.start) return null;
      if (rangeEnd > range.start) range.end = rangeEnd;
      pos = afterRange;
    }

    ranges.push(range);
    first = false;

    const afterItem = skipSpaces(text, pos);
    const separator = text[afterItem];

    if (separator === "," || separator === ";") {
      const nextPos = skipSpaces(text, afterItem + 1);
      if (startsBookReference(text, nextPos) || !startsListNumber(text, nextPos)) {
        pos = afterItem;
        break;
      }
      const next = readNumber(text, nextPos);
      if (!next) {
        pos = afterItem;
        break;
      }
      pos = afterItem + 1;
      continue;
    }

    if (/^y\b/i.test(text.slice(afterItem))) {
      const nextPos = skipSpaces(text, afterItem + 1);
      if (startsBookReference(text, nextPos) || !startsListNumber(text, nextPos)) {
        pos = afterItem;
        break;
      }
      const next = readNumber(text, nextPos);
      if (!next) {
        pos = afterItem;
        break;
      }
      pos = afterItem + 1;
      continue;
    }

    pos = afterItem;
    break;
  }

  if (first || ranges.length === 0) return null;
  return { ranges, end: pos };
}

function parseCitation(
  text: string,
  book: NonNullable<ReturnType<typeof normalizeBookName>>,
  aliasEnd: number,
  bookStart: number
): { ref: ParsedReference; end: number } | null {
  let pos = skipSpaces(text, aliasEnd);

  if (text[pos] === ".") {
    pos = skipSpaces(text, pos + 1);
  }

  const rest = text.slice(pos);
  const chapterPrefix = /^cap(?:itulo)?\.?\s*/i.exec(rest);
  const hasChapterPrefix = Boolean(chapterPrefix);
  if (chapterPrefix) {
    pos += chapterPrefix[0].length;
  }

  const chapterNumber = readNumber(text, pos);
  if (!chapterNumber) return null;

  const chapter = chapterNumber.value;
  if (chapter < 1 || chapter > book.chapters) return null;

  pos = skipSpaces(text, chapterNumber.end);

  const versePrefix = /^(?:vers(?:iculo)?\.?|ver\.?|v\.?)\s*/i.exec(text.slice(pos));
  if (versePrefix) {
    pos += versePrefix[0].length;
  } else if (text[pos] === ":" || text[pos] === "," || text[pos] === ".") {
    pos = skipSpaces(text, pos + 1);
  } else if (text[pos] === "-" && !hasChapterPrefix) {
    // OCR a veces lee ":" como "-" ("Lucas 14-24"). Con "cap." explícito un
    // guión sería rango de capítulos, así que ahí no se interpreta.
    pos = skipSpaces(text, pos + 1);
  }

  const expression = parseVerseExpression(text, pos);
  if (!expression) return null;

  const ranges = expression.ranges.filter(
    (range) =>
      range.start >= 1 &&
      range.start <= 176 &&
      (range.end === undefined || (range.end >= range.start && range.end <= 176))
  );

  if (ranges.length !== expression.ranges.length || ranges.length === 0) return null;

  const normalized = `${book.id} ${chapter}:${formatVerseRanges(ranges)}`;

  return {
    ref: {
      bookId: book.id,
      bookDisplayES: book.displayES,
      bookDisplayEN: book.displayEN,
      chapter,
      verseRanges: ranges,
      raw: text.slice(bookStart, expression.end).trim(),
      normalized,
    },
    end: expression.end,
  };
}

function formatVerseRanges(ranges: VerseRange[]): string {
  return ranges
    .map((range) =>
      range.end !== undefined && range.end !== range.start
        ? `${range.start}-${range.end}`
        : `${range.start}`
    )
    .join(",");
}

function mergeRanges(existing: VerseRange[], incoming: VerseRange[]): VerseRange[] {
  const all = [...existing, ...incoming].sort(
    (a, b) => a.start - b.start || (a.end ?? a.start) - (b.end ?? b.start)
  );
  const merged: VerseRange[] = [];

  for (const range of all) {
    const last = merged[merged.length - 1];
    const lastEnd = last?.end ?? last?.start;
    if (last && range.start <= (lastEnd as number)) {
      const newEnd = Math.max(lastEnd as number, range.end ?? range.start);
      if (newEnd > last.start) last.end = newEnd;
    } else {
      merged.push({ ...range });
    }
  }

  return merged;
}

// ML Kit a veces parte una cita en bloques no contiguos: los números quedan
// en otra línea cercana ("14-24)."), incluso antes del libro. Si una línea
// contiene SOLO el fragmento numérico y hay un único candidato a libro cerca
// (línea con solo el libro, o línea que termina en el libro: "...nuevas
// (Lucas"), se mueve el fragmento junto al libro antes de parsear.
const ORPHAN_FRAGMENT_LINE_RE = /^\(*\s*\d{1,3}\s*[-:]\s*\d{1,3}\s*[).,;:]*$/;
const BARE_BOOK_LINE_RE = new RegExp(
  `^(?:${BOOK_VARIANTS_SORTED.map(escapeRegex).join("|")})[).,;:]*$`,
  "i"
);
const BOOK_AT_LINE_END_RE = new RegExp(
  `(?:^|\\s)(${BOOK_VARIANTS_SORTED.map(escapeRegex).join("|")})[).,;:]*$`,
  "i"
);
const BOOK_AFTER_PAREN_RE = new RegExp(
  `\\((?:${BOOK_VARIANTS_SORTED.map(escapeRegex).join("|")})[).,;:]*$`,
  "i"
);
const ORPHAN_JOIN_WINDOW = 5; // líneas hacia arriba y abajo

function isOrphanVerseLine(line: string): boolean {
  return ORPHAN_FRAGMENT_LINE_RE.test(line.trim());
}

function isBareBookLine(line: string): boolean {
  const cleaned = line
    .trim()
    .replace(/^[("'\s]+/, "")
    .replace(/[).,;:\s]+$/, "");
  if (!cleaned) return false;
  // La lista de libros está sin acentos; comparar igual.
  const ascii = cleaned.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return BARE_BOOK_LINE_RE.test(ascii);
}

function lineEndsWithBookName(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const ascii = trimmed.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // "...(Lucas" al final de un párrafo: el paréntesis ya delimita el libro.
  if (BOOK_AFTER_PAREN_RE.test(ascii)) return true;
  const match = BOOK_AT_LINE_END_RE.exec(ascii);
  if (!match) return false;
  // Alias de 2 letras al final de prosa ("lo que es", "os") confundirían.
  return (match[1] ?? "").length >= 3;
}

function joinOrphanCitationLines(rawText: string): string {
  // Normalizar guiones/comillas antes de mirar línea por línea: el fragmento
  // puede venir con guión tipográfico (en/em dash) y no debe perderse.
  const text = normalizeOcrChars(rawText);
  if (!text.includes("\n")) return text;

  const lines = text.split(/\r?\n/);
  const fragmentIndexes = lines
    .map((line, index) => (isOrphanVerseLine(line) ? index : -1))
    .filter((index) => index >= 0);

  if (fragmentIndexes.length === 0) return text;

  for (const fragmentIndex of fragmentIndexes) {
    const from = Math.max(0, fragmentIndex - ORPHAN_JOIN_WINDOW);
    const to = Math.min(lines.length - 1, fragmentIndex + ORPHAN_JOIN_WINDOW);
    const candidates: number[] = [];

    for (let i = from; i <= to; i++) {
      if (i === fragmentIndex) continue;
      if (isBareBookLine(lines[i]) || lineEndsWithBookName(lines[i])) {
        candidates.push(i);
      }
    }

    // Sin libro cercano o con más de uno (ambiguo): no arriesgar el emparejamiento.
    if (candidates.length !== 1) continue;

    const bookIndex = candidates[0];
    const fragment = lines[fragmentIndex].trim().replace(/^\(/, "").trim();
    if (!fragment) continue;

    lines[bookIndex] = `${lines[bookIndex].trimEnd()} ${fragment}`;
    lines[fragmentIndex] = "";
  }

  return lines.join("\n");
}

export function parseReferences(text: string): ParsedReference[] {
  if (!text || !text.trim()) return [];

  // La unión de líneas necesita los \n, así que ocurre antes de normalizar.
  const normalized = normalizeOcrText(joinOrphanCitationLines(text));
  const repaired = repairCommonOcr(normalized);
  // Matching accent-insensitive: Gen == Gén. La regex se construyó sin tildes.
  const searchText = repaired.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const byChapter = new Map<string, ParsedReference>();

  BOOK_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = BOOK_RE.exec(searchText)) !== null) {
    const book = normalizeBookName(match[2]);
    if (!book) continue;

    const bookStart = match.index + match[1].length;
    const parsed = parseCitation(searchText, book, match.index + match[0].length, bookStart);

    if (!parsed) {
      BOOK_RE.lastIndex = match.index + match[0].length;
      continue;
    }

    BOOK_RE.lastIndex = parsed.end;

    const key = `${parsed.ref.bookId} ${parsed.ref.chapter}`;
    const existing = byChapter.get(key);

    if (existing) {
      existing.verseRanges = mergeRanges(existing.verseRanges, parsed.ref.verseRanges);
      existing.normalized = `${parsed.ref.bookId} ${parsed.ref.chapter}:${formatVerseRanges(
        existing.verseRanges
      )}`;
    } else {
      byChapter.set(key, parsed.ref);
    }
  }

  return Array.from(byChapter.values());
}

/**
 * Devuelve las ocurrencias de citas con índices en el texto original, para
 * poder resaltarlas en la UI. Usa un pase propio que conserva los offsets
 * (reparaciones OCR 1:1, colapso de espacios con mapa y eliminación de
 * diacríticos con mapa) y reutiliza `parseCitation`.
 *
 * No modifica `parseReferences`. Las citas cuyos números quedaron en una línea
 * anterior al libro (join de líneas huérfanas) pueden no aparecer acá; siguen
 * apareciendo en los resultados.
 */
export function parseReferenceSpans(text: string): CitationSpan[] {
  if (!text || !text.trim()) return [];

  // `normalizeOcrChars` reemplaza carácter por carácter, así que los índices
  // siguen siendo válidos sobre el texto original.
  const chars = normalizeOcrChars(text);
  const repaired = repairOcrPreservingLength(chars);
  const collapsed = collapseWhitespaceWithMap(repaired);
  const stripped = stripAccentsWithMap(collapsed.text);
  const searchText = stripped.text;

  const toOriginal = (index: number): number => {
    const collapsedIndex = stripped.map[index];
    if (collapsedIndex === undefined) return -1;
    return collapsed.map[collapsedIndex] ?? -1;
  };

  const spans: CitationSpan[] = [];
  BOOK_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = BOOK_RE.exec(searchText)) !== null) {
    const book = normalizeBookName(match[2]);
    if (!book) continue;

    const bookStart = match.index + match[1].length;
    const parsed = parseCitation(
      searchText,
      book,
      match.index + match[0].length,
      bookStart
    );

    if (!parsed) {
      BOOK_RE.lastIndex = match.index + match[0].length;
      continue;
    }

    BOOK_RE.lastIndex = parsed.end;

    const originalStart = toOriginal(bookStart);
    const lastCharacter = toOriginal(parsed.end - 1);
    if (originalStart < 0 || lastCharacter < 0) continue;

    let originalEnd = lastCharacter + 1;
    while (originalEnd > originalStart && /\s/.test(chars[originalEnd - 1])) {
      originalEnd--;
    }
    if (originalEnd <= originalStart) continue;

    const raw = text.slice(originalStart, originalEnd);
    const ref: ParsedReference = { ...parsed.ref, raw };

    spans.push({
      start: originalStart,
      end: originalEnd,
      ref,
      key: `${ref.bookId} ${ref.chapter}`,
    });
  }

  return spans;
}

// Helper para UI: formatear referencia según idioma
export function formatReference(ref: ParsedReference, lang: "es" | "en" = "es"): string {
  const bookName = lang === "es" ? ref.bookDisplayES : ref.bookDisplayEN;
  return `${bookName} ${ref.chapter}:${formatVerseRanges(ref.verseRanges)}`;
}

// Para testing / debug: parsea y devuelve strings
export function parseReferencesAsStrings(text: string): string[] {
  return parseReferences(text).map((r) => r.normalized);
}
