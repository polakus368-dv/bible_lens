import {
  COMMENTARIES,
  DEFAULT_COMMENTARY_IDS,
  PRIMARY_COMMENTARY_ID,
  allAuthors,
  getChapterCommentaryAny,
  listAuthorsForChapter,
  pickForVerses,
  type CommentaryEntry,
} from "../../src/services/commentary/commentaryService";

jest.mock("../../src/services/commentary/downloads", () => {
  const chapter: CommentaryEntry[] = [
    { author: "adamclarke", verseStart: 1, verseEnd: 3, text: "The same." },
    { author: "adamclarke", verseStart: 16, verseEnd: 16, text: "For God so loved…" },
  ];
  const downloaded = new Set(["adamclarke"]);
  return {
    isDownloaded: (id: string) => downloaded.has(id),
    readDownloadedChapter: (id: string, bookId: string, chapterNumber: number) =>
      downloaded.has(id) && bookId === "JHN" && chapterNumber === 3 ? chapter : null,
    listDownloads: () => [
      {
        module: {
          id: "uW-es_tn",
          name: "Notas en español (unfoldingWord)",
          abbr: "uW",
          lang: "es",
          license: "CC BY-SA 4.0",
          sourceUrl: "https://git.door43.org/uW/es_tn",
          sizeBytes: 0,
        },
        downloaded: false,
        sizeBytes: 0,
      },
    ],
  };
});

const entry = (verseStart: number, verseEnd: number, text = "texto"): CommentaryEntry => ({
  author: "adamclarke",
  verseStart,
  verseEnd,
  text,
});

describe("pickForVerses", () => {
  const entries = [entry(1, 1, "uno"), entry(2, 5, "dos a cinco"), entry(16, 17, "dieciséis")];

  test("incluye entradas que contienen el versículo", () => {
    expect(pickForVerses(entries, [3]).map((e) => e.text)).toEqual(["dos a cinco"]);
  });

  test("incluye entradas que intersectan un rango", () => {
    expect(pickForVerses(entries, [5, 6]).map((e) => e.text)).toEqual(["dos a cinco"]);
  });

  test("sin versículos devuelve todo", () => {
    expect(pickForVerses(entries, [])).toHaveLength(3);
  });

  test("sin coincidencias devuelve vacío", () => {
    expect(pickForVerses(entries, [7, 8, 99])).toEqual([]);
  });

  test("versículos fuera del capítulo no rompen el filtro", () => {
    expect(pickForVerses(entries, [0, -1])).toEqual([]);
  });
});

describe("comentarios descargados", () => {
  test("el manifiesto expone los clásicos generados", () => {
    expect(COMMENTARIES.length).toBeGreaterThan(0);
    for (const module of COMMENTARIES) {
      expect(module.license).toBe("public-domain");
      expect(module.chapters).toBeGreaterThan(1_000);
    }
  });

  test("allAuthors pone las notas en español primero", () => {
    const ids = allAuthors().map((module) => module.id);
    expect(ids[0]).toBe("uW-es_tn");
    expect(ids).toContain("adamclarke");
  });

  test("la selección por defecto es español y el indicador ◎ usa uW", () => {
    expect(DEFAULT_COMMENTARY_IDS).toEqual(["uW-es_tn"]);
    expect(PRIMARY_COMMENTARY_ID).toBe("uW-es_tn");
  });

  test("capítulo descargado devuelve entradas y downloaded", () => {
    const result = getChapterCommentaryAny("adamclarke", "JHN", 3);
    expect(result.downloaded).toBe(true);
    expect(pickForVerses(result.entries, [16])[0].text).toContain("loved");
  });

  test("autor sin descargar devuelve vacío y downloaded=false", () => {
    expect(getChapterCommentaryAny("gill", "JHN", 3)).toEqual({
      entries: [],
      downloaded: false,
    });
  });

  test("listAuthorsForChapter mezcla descargados y pendientes", () => {
    const authors = listAuthorsForChapter("JHN", 3, ["adamclarke", "gill", "uW-es_tn"]);
    const byId = Object.fromEntries(authors.map((author) => [author.module.id, author]));
    expect(byId.adamclarke.count).toBe(2);
    expect(byId.gill.missing).toBe(true);
    expect(byId["uW-es_tn"].missing).toBe(true);
  });
});
