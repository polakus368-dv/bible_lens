import { parseReferences } from "../src/services/parser/bibleParser";
import {
  getChapter,
  getVerses,
  loadChapter,
  lookupVerses,
  resolveBookQuery,
} from "../src/services/bible/bibleService";

const DB = {
  GEN: {
    "1": {
      "1": "En el principio.",
      "2": "Y la tierra estaba desordenada.",
      "3": "Y dijo Dios: Sea la luz.",
    },
  },
};

describe("bibleService", () => {
  test("carga la RVR1909 offline", async () => {
    const refs = parseReferences("Jn 3:16");
    const [result] = await getVerses(refs, "es");
    expect(result.verses[0].text).toContain("amó Dios al mundo");
  });

  test("integra parser + RVR1909 con varias citas", async () => {
    const refs = parseReferences(
      "Como dice Juan 3:16-18, 1 Corintios 13,4-7 y Salmo 23:1"
    );
    const results = await getVerses(refs, "es");
    expect(results.map((result) => result.displayRef)).toEqual([
      "Juan 3:16-18",
      "1 Corintios 13:4-7",
      "Salmos 23:1",
    ]);
    expect(results.map((result) => result.verses.length)).toEqual([3, 4, 1]);
    expect(results.every((result) => !result.notFound)).toBe(true);
  });

  test("devuelve un rango completo", () => {
    const refs = parseReferences("Gen 1:1-2");
    const [result] = lookupVerses(DB, refs, "es");
    expect(result.verses.map((verse) => verse.number)).toEqual([1, 2]);
    expect(result.notFound).toBe(false);
  });

  test("devuelve una lista de versículos", () => {
    const refs = parseReferences("Gen 1:1,3");
    const [result] = lookupVerses(DB, refs, "es");
    expect(result.verses.map((verse) => verse.number)).toEqual([1, 3]);
    expect(result.notFound).toBe(false);
  });

  test("devuelve una lista de rangos", () => {
    const refs = parseReferences("Gen 1:1-2,4");
    const [result] = lookupVerses(DB, refs, "es");
    expect(result.verses.map((verse) => verse.number)).toEqual([1, 2]);
    expect(result.notFound).toBe(false);
  });

  test("marca notFound cuando no hay texto", () => {
    const refs = parseReferences("Gen 1:9");
    const [result] = lookupVerses(DB, refs, "es");
    expect(result.verses).toEqual([]);
    expect(result.notFound).toBe(true);
  });

  test("getChapter devuelve el capítulo completo ordenado", () => {
    const chapter = getChapter(DB, "GEN", 1);
    expect(chapter?.verses.map((verse) => verse.number)).toEqual([1, 2, 3]);
    expect(getChapter(DB, "GEN", 2)).toBeNull();
    expect(getChapter(DB, "JHN", 1)).toBeNull();
  });

  test("loadChapter lee del JSON de la versión", async () => {
    const chapter = await loadChapter("JHN", 3, "RVR1909");
    expect(chapter?.verses.length).toBe(36);
    expect(chapter?.verses[15].text).toContain("amó Dios al mundo");
  });
});

describe("resolveBookQuery", () => {
  test("acepta una referencia completa", () => {
    expect(resolveBookQuery("Jn 3:16")).toEqual({
      bookId: "JHN",
      chapter: 3,
      verse: 16,
    });
  });

  test("acepta libro y capítulo", () => {
    expect(resolveBookQuery("Sal 23")).toEqual({ bookId: "PSA", chapter: 23 });
    expect(resolveBookQuery("1co13")).toEqual({ bookId: "1CO", chapter: 13 });
  });

  test("solo un nombre de libro hereda el capítulo abierto", () => {
    expect(resolveBookQuery("juan", 4)).toEqual({ bookId: "JHN", chapter: 4 });
    expect(resolveBookQuery("Juan")).toEqual({ bookId: "JHN", chapter: 1 });
  });

  test("limita el capítulo heredado al último del libro", () => {
    expect(resolveBookQuery("Judas", 9)).toEqual({ bookId: "JUD", chapter: 1 });
  });

  test("acepta nombres parciales", () => {
    expect(resolveBookQuery("1 cron", 1)?.bookId).toBe("1CH");
    expect(resolveBookQuery("isai", 1)?.bookId).toBe("ISA");
    expect(resolveBookQuery("gene", 2)?.bookId).toBe("GEN");
  });

  test("ignora texto que no es un libro", () => {
    expect(resolveBookQuery("hola", 1)).toBeNull();
    expect(resolveBookQuery("   ")).toBeNull();
  });
});
