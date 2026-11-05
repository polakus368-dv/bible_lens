import {
  parseReferences,
  parseReferenceSpans,
} from "../src/services/parser/bibleParser";

function spanTexts(text: string): string[] {
  return parseReferenceSpans(text).map((span) =>
    text.slice(span.start, span.end)
  );
}

describe("parseReferenceSpans", () => {
  test("devuelve el texto exacto de una cita simple", () => {
    expect(spanTexts("Ver Jn 3:16.")).toEqual(["Jn 3:16"]);
  });

  test("conserva acentos en el span y en el raw", () => {
    const [span] = parseReferenceSpans("Génesis 1:1");
    expect(spanTexts("Génesis 1:1")).toEqual(["Génesis 1:1"]);
    expect(span.ref.raw).toBe("Génesis 1:1");
    expect(span.key).toBe("GEN 1");
  });

  test("devuelve una ocurrencia por cada aparición, aunque parseReferences dedupee", () => {
    const text = "Jn 3:16 y otra vez Jn 3:16";
    expect(spanTexts(text)).toEqual(["Jn 3:16", "Jn 3:16"]);
    expect(parseReferences(text)).toHaveLength(1);
  });

  test("soporta rangos y listas", () => {
    expect(spanTexts("1 Cor 13,4-7")).toEqual(["1 Cor 13,4-7"]);
    expect(spanTexts("Juan 3:16-18,20")).toEqual(["Juan 3:16-18,20"]);
    expect(spanTexts("Juan 3:16 al 18")).toEqual(["Juan 3:16 al 18"]);
  });

  test("repara errores OCR y conserva el texto original resaltado", () => {
    const cases = [
      { text: "l Corintios 13:4", key: "1CO 13" },
      { text: "5al 23:1", key: "PSA 23" },
      { text: "R0manos 8:28", key: "ROM 8" },
      { text: "Sa1mos 23:1", key: "PSA 23" },
      { text: "1ª Corintios 13:4", key: "1CO 13" },
      { text: "primera de Corintios 13:4", key: "1CO 13" },
    ];

    for (const item of cases) {
      const [span] = parseReferenceSpans(item.text);
      expect(span).toBeDefined();
      expect(item.text.slice(span.start, span.end)).toBe(item.text);
      expect(span.key).toBe(item.key);
    }
  });

  test("maneja varias líneas y espacios múltiples sin desalinear índices", () => {
    const multiline = "Enséñele que las excusas no son nuevas (Lucas\n14:24)";
    expect(spanTexts(multiline)).toEqual(["Lucas\n14:24"]);

    const spaced = "1   Corintios 13:4";
    expect(spanTexts(spaced)).toEqual([spaced]);
  });

  test("la clave coincide con la referencia parseada del span", () => {
    const text = "Ver 1 Cor 13:4-7 y Jn 3:16";
    for (const span of parseReferenceSpans(text)) {
      const parsed = parseReferences(text.slice(span.start, span.end));
      expect(parsed).toHaveLength(1);
      expect(`${parsed[0].bookId} ${parsed[0].chapter}`).toBe(span.key);
    }
  });

  test("no inventa spans sin cita", () => {
    expect(parseReferenceSpans("Hola mundo sin citas 123")).toEqual([]);
    expect(parseReferenceSpans("")).toEqual([]);
  });
});
