import {
  bookSlug,
  htmlToText,
  parseCommentaryChapter,
  parseHeadingId,
  tidyCommentary,
} from "../../scripts/commentary/parse";

const FIXTURE = `
<html><body>
<div class="bch-sidebar">Sidebar John 3:1 que no es comentario</div>
<div class="bch-content comm-content">
  <h3 id="john-31">John 3:1</h3>
  <p>Intro del capítulo.</p>
  <p>There was a man of the Pharisees.</p>
  <h3 id="john-31-3">John 3:1-3</h3>
  <p>The same.</p>
  <h3 id="john-316">John 3:16</h3>
  <p>For God so loved the world.</p>
  <p>&nbsp;</p>
  <h3 id="john-424">John 4:24</h3>
  <p>Fuera de este capítulo.</p>
  <h3>Cite / Share This Page</h3>
</div>
<footer>pie</footer>
</body></html>`;

describe("parseHeadingId", () => {
  test("un solo versículo", () => {
    expect(parseHeadingId("john-316", "JHN", 3)).toEqual({ v: 16 });
    expect(parseHeadingId("john-31", "JHN", 3)).toEqual({ v: 1 });
  });

  test("rangos", () => {
    expect(parseHeadingId("john-31-36", "JHN", 3)).toEqual({ v: 1, e: 36 });
    expect(parseHeadingId("genesis-14-5", "GEN", 1)).toEqual({ v: 4, e: 5 });
  });

  test("libros con nombre compuesto o número", () => {
    expect(parseHeadingId("1-corinthians-131", "1CO", 13)).toEqual({ v: 1 });
    expect(parseHeadingId("1-corinthians-131-3", "1CO", 13)).toEqual({ v: 1, e: 3 });
    expect(parseHeadingId("song-of-solomon-11", "SNG", 1)).toEqual({ v: 1 });
    expect(parseHeadingId("psalms-231", "PSA", 23)).toEqual({ v: 1 });
    expect(parseHeadingId("revelation-211", "REV", 21)).toEqual({ v: 1 });
  });

  test("descarta ids de otro capítulo u otro libro", () => {
    expect(parseHeadingId("john-116", "JHN", 3)).toBeNull();
    expect(parseHeadingId("matthew-31", "JHN", 3)).toBeNull();
    expect(parseHeadingId("john-4-24", "JHN", 3)).toBeNull();
    expect(parseHeadingId("cite-share", "JHN", 3)).toBeNull();
  });

  test("un fin anterior al inicio se descarta", () => {
    expect(parseHeadingId("john-35-2", "JHN", 3)).toEqual({ v: 5 });
  });
});

test("bookSlug genera el slug usado por sermonindex", () => {
  expect(bookSlug("Song of Solomon")).toBe("song-of-solomon");
  expect(bookSlug("1 Corinthians")).toBe("1-corinthians");
  expect(bookSlug("Psalms")).toBe("psalms");
});

test("htmlToText decodifica entidades y separa párrafos", () => {
  const text = htmlToText("<p>Uno &amp; dos</p><p>L&#8217;otro</p><sup>12</sup>");
  expect(text).toBe("Uno & dos\n\nL’otro");
});

describe("parseCommentaryChapter", () => {
  test("asigna texto a cada encabezado y adjunta la intro a la primera entrada", () => {
    const items = tidyCommentary(parseCommentaryChapter(FIXTURE, "JHN", 3));
    expect(items).toEqual([
      { v: 1, t: "Intro del capítulo.\n\nThere was a man of the Pharisees." },
      { v: 1, e: 3, t: "The same." },
      { v: 16, t: "For God so loved the world." },
    ]);
  });

  test("sin encabezados válidos devuelve el capítulo completo", () => {
    const html = '<div class="comm-content"><p>Todo el comentario.</p></div>';
    expect(parseCommentaryChapter(html, "JHN", 3)).toEqual([
      { v: 1, t: "Todo el comentario." },
    ]);
  });

  test("un rango de encabezado conserva v y e", () => {
    const items = parseCommentaryChapter(FIXTURE, "JHN", 3);
    expect(items[1]).toEqual({ v: 1, e: 3, t: "The same." });
  });

  test("sin contenedor devuelve lista vacía", () => {
    expect(parseCommentaryChapter("<html><body>nada</body></html>", "JHN", 3)).toEqual([]);
  });
});
