import { parseReferences } from "../src/services/parser/bibleParser";
import { getVerses } from "../src/services/bible/bibleService";

describe("versiones bíblicas", () => {
  test("RVR1960, NVI y LBLA devuelven textos distintos para Jn 3:16", async () => {
    const refs = parseReferences("Jn 3:16");
    const [rvr1960] = await getVerses(refs, "es", "RVR1960");
    const [nvi] = await getVerses(refs, "es", "NVI");
    const [lbla] = await getVerses(refs, "es", "LBLA");

    expect(rvr1960.verses[0].text).toContain("amó Dios al mundo");
    expect(nvi.verses[0].text).toContain("tanto amó Dios al mundo");
    expect(lbla.verses[0].text).toContain("amó Dios al mundo");
    expect(nvi.verses[0].text).not.toBe(rvr1960.verses[0].text);
  });

  test("sin versionId usa RVR1909 (compatibilidad)", async () => {
    const refs = parseReferences("Jn 3:16");
    const [byDefault] = await getVerses(refs, "es");
    const [explicit] = await getVerses(refs, "es", "RVR1909");
    expect(byDefault.verses[0].text).toBe(explicit.verses[0].text);
  });

  test("cambiar de versión conserva el orden y los rangos", async () => {
    const refs = parseReferences("Juan 3:16-18 y Salmo 23:1");
    const results = await getVerses(refs, "es", "NVI");
    expect(results.map((result) => result.displayRef)).toEqual([
      "Juan 3:16-18",
      "Salmos 23:1",
    ]);
    expect(results[0].verses.map((verse) => verse.number)).toEqual([16, 17, 18]);
    expect(results.every((result) => !result.notFound)).toBe(true);
  });
});
