import { parseReferences, formatReference } from "../src/services/parser/bibleParser";

describe("bibleParser", () => {
  test("ES: Jn 3,16", () => {
    const r = parseReferences("Porque como dice Jn 3,16 amó Dios al mundo");
    expect(r.length).toBe(1);
    expect(r[0].bookId).toBe("JHN");
    expect(r[0].chapter).toBe(3);
    expect(r[0].verseRanges).toEqual([{ start: 16 }]);
  });

  test("EN: John 3:16", () => {
    const r = parseReferences("John 3:16");
    expect(r[0].bookId).toBe("JHN");
    expect(r[0].normalized).toBe("JHN 3:16");
  });

  test("abreviaturas y acentos: Gén 1,1 y Gen 1:1", () => {
    const r1 = parseReferences("Gén 1,1");
    const r2 = parseReferences("Gen 1:1");
    expect(r1[0].bookId).toBe("GEN");
    expect(r2[0].bookId).toBe("GEN");
  });

  test("rango: 1 Cor 13,4-7", () => {
    const r = parseReferences("1 Cor 13,4-7");
    expect(r[0].bookId).toBe("1CO");
    expect(r[0].verseRanges).toEqual([{ start: 4, end: 7 }]);
  });

  test("rango con 'al': Juan 3:16 al 18", () => {
    const r = parseReferences("Juan 3:16 al 18");
    expect(r[0].bookId).toBe("JHN");
    expect(r[0].verseRanges).toEqual([{ start: 16, end: 18 }]);
  });

  test("lista de versículos: Juan 3:16,18", () => {
    const r = parseReferences("Juan 3:16,18");
    expect(r[0].verseRanges).toEqual([{ start: 16 }, { start: 18 }]);
  });

  test("lista de rangos: Juan 3:16-18,20", () => {
    const r = parseReferences("Juan 3:16-18,20");
    expect(r[0].verseRanges).toEqual([{ start: 16, end: 18 }, { start: 20 }]);
  });

  test("lista con 'y': 1 Cor 13:4, 6 y 8", () => {
    const r = parseReferences("1 Cor 13:4, 6 y 8");
    expect(r[0].verseRanges).toEqual([{ start: 4 }, { start: 6 }, { start: 8 }]);
  });

  test("ordinales: 1ª Corintios y 2da Timoteo", () => {
    const r1 = parseReferences("1ª Corintios 13:4");
    const r2 = parseReferences("2da Timoteo 3:16");
    expect(r1[0].bookId).toBe("1CO");
    expect(r2[0].bookId).toBe("2TI");
  });

  test("formato capítulo/versículo: Juan capítulo 3 versículo 16", () => {
    const r = parseReferences("Juan capítulo 3 versículo 16");
    expect(r[0].bookId).toBe("JHN");
    expect(r[0].chapter).toBe(3);
    expect(r[0].verseRanges).toEqual([{ start: 16 }]);
  });

  test("formato abreviado cap./ver.: Juan cap. 3 ver. 16", () => {
    const r = parseReferences("Juan cap. 3 ver. 16");
    expect(r[0].bookId).toBe("JHN");
    expect(r[0].verseRanges).toEqual([{ start: 16 }]);
  });

  test("múltiples citas separadas por coma/y sin perder el segundo libro", () => {
    const r = parseReferences("Como dice Juan 3:16-18, 1 Corintios 13,4-7 y Salmo 23:1");
    expect(r.map((x) => x.normalized)).toEqual(["JHN 3:16-18", "1CO 13:4-7", "PSA 23:1"]);
  });

  test("no confundir el versículo 1 con un libro ordinal", () => {
    const r = parseReferences("Juan 3:16, 1, 2");
    expect(r[0].verseRanges).toEqual([{ start: 16 }, { start: 1 }, { start: 2 }]);
  });

  test("no leer la S/l inicial de una palabra como dígito", () => {
    expect(parseReferences("Juan 3:16, si leemos")[0].verseRanges).toEqual([{ start: 16 }]);
    expect(parseReferences("Juan 3:16, la gracia")[0].verseRanges).toEqual([{ start: 16 }]);
  });

  test("múltiples citas", () => {
    const r = parseReferences("ver Mt 5,1-12; Lc 6,20 y Jn 14,6");
    expect(r.length).toBe(3);
    expect(r.map((x) => x.bookId)).toEqual(["MAT", "LUK", "JHN"]);
  });

  test("rango con guion largo", () => {
    const r = parseReferences("Rom 8:2–4");
    expect(r[0].bookId).toBe("ROM");
    expect(r[0].verseRanges).toEqual([{ start: 2, end: 4 }]);
  });

  test("Salmos 23,1 con abreviatura Sal", () => {
    const r = parseReferences("Sal 23,1");
    expect(r[0].bookId).toBe("PSA");
  });

  test("dedupe", () => {
    const r = parseReferences("Jn 3:16 y otra vez Juan 3,16");
    expect(r.length).toBe(1);
  });

  test("dedupe dentro de una lista a la misma referencia", () => {
    const r = parseReferences("Jn 3:16 y Jn 3:16,18");
    expect(r.length).toBe(1);
    expect(r[0].verseRanges).toEqual([{ start: 16 }, { start: 18 }]);
  });

  test("formatReference ES/EN", () => {
    const r = parseReferences("Mateo 5:9")[0];
    expect(formatReference(r, "es")).toBe("Mateo 5:9");
    expect(formatReference(r, "en")).toBe("Matthew 5:9");
  });

  test("formatReference con listas y rangos", () => {
    const r = parseReferences("Juan 3:16-18,20")[0];
    expect(formatReference(r, "es")).toBe("Juan 3:16-18,20");
  });

  test("abreviaturas ambiguas: Ez=Ezequiel, Esd=Esdras, Jos=Josué", () => {
    expect(parseReferences("Ez 1:1")[0].bookId).toBe("EZK");
    expect(parseReferences("Esd 1:1")[0].bookId).toBe("EZR");
    expect(parseReferences("Jos 1:1")[0].bookId).toBe("JOS");
    expect(parseReferences("Jo 3:16")).toHaveLength(0);
  });

  test("citas sin espacio entre libro y capítulo: Juan3:16 y Salmo100:1", () => {
    const r1 = parseReferences("Juan3:16");
    const r2 = parseReferences("Salmo100:1");
    expect(r1[0].bookId).toBe("JHN");
    expect(r1[0].chapter).toBe(3);
    expect(r2[0].bookId).toBe("PSA");
    expect(r2[0].chapter).toBe(100);
  });

  test("no falsos positivos", () => {
    const r = parseReferences("Hola mundo sin citas 123");
    expect(r.length).toBe(0);
  });

  test("libros con número: 1 Juan 1:9", () => {
    const r = parseReferences("1 Jn 1:9");
    expect(r[0].bookId).toBe("1JN");
  });

  test("Apocalipsis abreviado Ap 22,21", () => {
    const r = parseReferences("Ap 22,21");
    expect(r[0].bookId).toBe("REV");
  });

  describe("errores típicos de OCR", () => {
    test("l en lugar de 1 en el versículo: Jn 3:l6", () => {
      const r = parseReferences("Jn 3:l6");
      expect(r[0].bookId).toBe("JHN");
      expect(r[0].verseRanges).toEqual([{ start: 16 }]);
    });

    test("O en lugar de 0: Juan 3:O1", () => {
      const r = parseReferences("Juan 3:O1");
      expect(r[0].verseRanges).toEqual([{ start: 1 }]);
    });

    test("S en lugar de 5: Romanos 8:2S", () => {
      const r = parseReferences("Romanos 8:2S");
      expect(r[0].verseRanges).toEqual([{ start: 25 }]);
    });

    test("lO en lugar de 10: Juan 3:lO", () => {
      const r = parseReferences("Juan 3:lO");
      expect(r[0].verseRanges).toEqual([{ start: 10 }]);
    });

    test("sustituciones OCR en una lista: Juan 3:16, 2S", () => {
      const r = parseReferences("Juan 3:16, 2S");
      expect(r[0].verseRanges).toEqual([{ start: 16 }, { start: 25 }]);
    });

    test("l inicial en una lista: Juan 3:16, l8", () => {
      const r = parseReferences("Juan 3:16, l8");
      expect(r[0].verseRanges).toEqual([{ start: 16 }, { start: 18 }]);
    });

    test("l en lugar de 1 en ordinal: l Corintios 13:4", () => {
      const r = parseReferences("l Corintios 13:4");
      expect(r[0].bookId).toBe("1CO");
    });

    test("0 en lugar de o en el libro: R0manos 8:28", () => {
      const r = parseReferences("R0manos 8:28");
      expect(r[0].bookId).toBe("ROM");
    });

    test("5 en lugar de s en el libro: 5al 23:1", () => {
      const r = parseReferences("5al 23:1");
      expect(r[0].bookId).toBe("PSA");
    });

    test("1 en lugar de l en el libro: Sa1mos 23:1", () => {
      const r = parseReferences("Sa1mos 23:1");
      expect(r[0].bookId).toBe("PSA");
    });
  });

  describe("OCR: citas partidas por líneas", () => {
    test("libro y referencia en líneas consecutivas: Lucas\\n14:24", () => {
      const r = parseReferences("Enséñele que las excusas no son nuevas (Lucas\n14:24)");
      expect(r).toHaveLength(1);
      expect(r[0].normalized).toBe("LUK 14:24");
    });

    test("guión OCR en lugar de dos puntos: Lucas 14-24", () => {
      const r = parseReferences("(Lucas 14-24).");
      expect(r[0].bookId).toBe("LUK");
      expect(r[0].chapter).toBe(14);
      expect(r[0].verseRanges).toEqual([{ start: 24 }]);
    });

    test("guiones tipográficos OCR en lugar de dos puntos: 14–24 y 14—24", () => {
      expect(parseReferences("(Lucas 14–24).")[0].normalized).toBe("LUK 14:24");
      expect(parseReferences("(Lucas 14—24).")[0].normalized).toBe("LUK 14:24");
    });

    test("referencia huérfana separada del libro por otras líneas", () => {
      const text = [
        "EL EVANGELISMO",
        "(Continuación)",
        "V EL QUE SE EXCUSA",
        "14-24).",
        "Este se parece mucho al objetante. Sus excusas son",
        "superficiales",
        "y muy antiguas. Enséñele que las excusas no son nuevas",
        "(Lucas",
        "Lección No. 12",
      ].join("\n");
      const r = parseReferences(text);
      expect(r.map((x) => x.normalized)).toEqual(["LUK 14:24"]);
    });

    test("no unir fragmentos sin libro cercano", () => {
      expect(parseReferences("14-24).\nTexto normal sin libros")).toHaveLength(0);
    });

    test("no unir si hay más de un libro candidato (ambiguo)", () => {
      expect(parseReferences(["14-24).", "(Lucas", "texto", "(Juan"].join("\n"))).toHaveLength(0);
    });

    test("con 'cap.' el guión no se interpreta como capítulo:versículo", () => {
      expect(parseReferences("Lucas cap. 14-24")).toHaveLength(0);
    });

    test("texto real del dispositivo: libro al final de la línea, fragmento antes", () => {
      const text = [
        "EL EVANGELISMO",
        "(Continuación)",
        "V EL QUE SE EXCUSA",
        "14-24).",
        "Este se parece mucho al objetante. Sus excusas son superficales",
        "y muy antiguas. Enséñele que las excusas no son nuevas (Lucas",
        "Lección No. 12",
        "PERSONAL I EN OPERACION",
        '1. "Yo soy tan bueno como cualquier miembro de una',
        'iglesia". Contestación: : Eso no es decir mucho. Muchos',
        "miembros de iglesias no han nacido de nuevo y ése es el",
        "requisito señalado por Dios (Juan 3:3; Romanos 3:10-19).",
      ].join("\n");

      const r = parseReferences(text);
      const normalized = r.map((x) => x.normalized);
      expect(normalized).toContain("LUK 14:24");
      expect(normalized).toEqual(expect.arrayContaining(["JHN 3:3", "ROM 3:10-19"]));
    });

    test("las citas partidas por bloque de ML Kit siguen funcionando", () => {
      const r = parseReferences("salvar: Es hoy (2\nCorintios\n6:2; Hebreos 3:7-8).");
      expect(r.map((x) => x.normalized)).toEqual(["2CO 6:2", "HEB 3:7-8"]);
    });
  });
});
