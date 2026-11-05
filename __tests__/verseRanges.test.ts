import {
  expandVerseRanges,
  filterVersesByRanges,
} from "../src/services/bible/verseRanges";

describe("verseRanges", () => {
  test("expande rangos y versículos sueltos", () => {
    expect(
      Array.from(expandVerseRanges([{ start: 16 }, { start: 18, end: 20 }]))
    ).toEqual([16, 18, 19, 20]);
  });

  test("filtra los versículos de una ocurrencia dentro de un capítulo mergeado", () => {
    const verses = [
      { number: 16, text: "16" },
      { number: 17, text: "17" },
      { number: 18, text: "18" },
      { number: 20, text: "20" },
    ];

    expect(filterVersesByRanges(verses, [{ start: 16 }])).toEqual([
      { number: 16, text: "16" },
    ]);
    expect(
      filterVersesByRanges(verses, [{ start: 16, end: 17 }, { start: 20 }])
    ).toEqual([
      { number: 16, text: "16" },
      { number: 17, text: "17" },
      { number: 20, text: "20" },
    ]);
  });

  test("devuelve vacío si ningún versículo del rango está presente", () => {
    expect(
      filterVersesByRanges([{ number: 1, text: "1" }], [{ start: 16 }])
    ).toEqual([]);
  });
});
