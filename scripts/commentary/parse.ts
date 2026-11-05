/**
 * Parser del HTML de sermonindex.net (/commentary/<módulo>/<LIBRO>/<cap>).
 * Cada comentario está dentro de <div class="bch-content comm-content"> y va
 * precedido por un encabezado con id "<libro>-<cap><v[-vFin]>" (ej. john-316).
 * Lo que sigue hasta el próximo encabezado es el texto de ese versículo o rango.
 * El slug del id es el nombre inglés con guiones ("1-corinthians", "song-of-solomon"),
 * no el id OSIS de la URL.
 */

import { BOOKS } from "../../src/services/parser/books";

export type CommentaryItem = {
  /** Versículo inicial. */
  v: number;
  /** Versículo final; se omite cuando es un solo versículo. */
  e?: number;
  /** Texto plano con párrafos separados por una línea en blanco. */
  t: string;
};

export type CommentaryBook = Record<string, Record<string, CommentaryItem[]>>;

const HEADING_RE = /<h([3-5])[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gi;

/**
 * Devuelve solo el bloque de comentario (<div class="comm-content">). Se corta
 * en la barra lateral porque el contenido incluye divs anidados y un regex no
 * puede emparejar el cierre del contenedor.
 */
export function extractContent(html: string): string | null {
  const start = html.search(/<div[^>]*class="[^"]*\bcomm-content\b[^"]*"[^>]*>/);
  if (start < 0) return null;
  const bodyStart = html.indexOf(">", start) + 1;
  const sidebar = html.indexOf("bch-sidebar", bodyStart);
  const footer = html.indexOf("<footer", bodyStart);
  const end = Math.min(
    ...([sidebar, footer, html.length].filter((value) => value > bodyStart))
  );
  return html.slice(bodyStart, end);
}

/** "Song of Solomon" → "song-of-solomon"; "Psalms" → "psalms". */
export function bookSlug(displayEN: string): string {
  return displayEN
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const BOOK_SLUGS = BOOKS.map((book) => ({ id: book.id, slug: bookSlug(book.displayEN) }));

/**
 * Convierte el id de un encabezado en un rango de versículos del capítulo.
 * Ejemplos: "john-316" con cap 3 → v16; "john-31-36" → 1..36; "psalms-231" cap 23 → v1.
 * Devuelve null si el id no corresponde al libro/capítulo pedidos.
 */
export function parseHeadingId(
  id: string,
  bookId: string,
  chapter: number
): { v: number; e?: number } | null {
  const lower = id.toLowerCase();
  const own = BOOK_SLUGS.find((book) => book.id === bookId)?.slug;
  if (!own) return null;
  // El número del libro lleva guion ("1-corinthians-11"), así que el slug propio
  // puede contener guiones: se compara como prefijo completo.
  if (!lower.startsWith(`${own}-`)) return null;

  // "1-corinthians-11" → "11"; "1-corinthians-131-36" → "131-36".
  const m = /^(\d+)(?:-(\d+))?$/.exec(lower.slice(own.length + 1));
  if (!m) return null;
  const [, first, second] = m;

  const capText = String(chapter);
  if (!first.startsWith(capText)) return null;

  const rest = first.slice(capText.length);
  const start = rest ? Number(rest) : 1;
  let end = second ? Number(second) : undefined;

  // Un rango con fin menor que el inicio no tiene sentido: se descarta el fin.
  if (end !== undefined && end < start) end = undefined;

  return end === undefined ? { v: start } : { v: start, e: end };
}

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return HTML_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/** HTML del comentario → texto plano con párrafos y viñetas simples. */
export function htmlToText(html: string): string {
  let out = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<sup[\s\S]*?<\/sup>/gi, "")
    .replace(/<ol[^>]*>/gi, "\n")
    .replace(/<\/ol>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|h[1-6]|div|ul|blockquote|pre)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  out = decodeEntities(out)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n");

  return out.trim();
}

export function parseCommentaryChapter(
  html: string,
  bookId: string,
  chapter: number
): CommentaryItem[] {
  const content = extractContent(html);
  if (!content) return [];

  type Heading = {
    index: number;
    length: number;
    range: { v: number; e?: number } | null;
  };
  const headings: Heading[] = [];
  HEADING_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = HEADING_RE.exec(content)) !== null) {
    headings.push({
      index: match.index,
      length: match[0].length,
      range: parseHeadingId(match[2], bookId, chapter),
    });
  }

  if (headings.length === 0) {
    // Algunos módulos (Matthew Henry) no dividen por versículo: todo el
    // capítulo queda como una entrada de v1 a v1.
    const preamble = htmlToText(content);
    return preamble ? [{ v: 1, t: preamble }] : [];
  }

  // Texto previo al primer encabezado (introducción del capítulo): se adjunta
  // a la primera entrada real del capítulo.
  const intro = htmlToText(content.slice(0, headings[0].index));

  const items: CommentaryItem[] = [];
  let pendingIntro = intro;
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const nextIndex =
      i + 1 < headings.length ? headings[i + 1].index : content.length;
    let t = htmlToText(content.slice(heading.index + heading.length, nextIndex));
    if (!heading.range) continue; // encabezado de otro capítulo o ajeno
    if (pendingIntro) {
      t = t ? `${pendingIntro}

${t}` : pendingIntro;
      pendingIntro = "";
    }
    if (!t) continue;
    items.push(
      heading.range.e === undefined
        ? { v: heading.range.v, t }
        : { v: heading.range.v, e: heading.range.e, t }
    );
  }
  return items;
}

/**
 * Sustituye enlaces internos por texto legible y quita el prefijo redundante
 * "Verse 16." que muchos comentarios repiten al inicio.
 */
export function tidyCommentary(items: CommentaryItem[]): CommentaryItem[] {
  return items
    .map((item) => {
      const t = item.t
        .replace(/^Verse (?:s )?\d+(?:[-–]\d+)?\.\s*/i, "")
        // Los enlaces a pasajes paralelos ya se ven como texto tras htmlToText.
        .trim();
      return { ...item, t };
    })
    .filter((item) => item.t.length > 0);
}
