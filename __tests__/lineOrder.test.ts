import { MlKitBlock, MlKitLine, orderLinesByPosition } from "../src/services/ocr/lineOrder";

const line = (text: string, top: number, left: number, height = 20, width = 200): MlKitLine => ({
  text,
  frame: { top, left, width, height },
});

function block(lines: MlKitLine[]): MlKitBlock {
  return { lines };
}

describe("orderLinesByPosition", () => {
  test("reordena bloques desordenados por posición visual", () => {
    const blocks = [
      // Bloque 1 tal como lo devolvió ML Kit: encabezado + fragmento desplazado.
      block([
        line("EL EVANGELISMO PERSONAL EN OPERACION", 100, 40),
        line("(Continuación)", 140, 40),
        line("V EL QUE SE EXCUSA", 180, 40),
        line("14-24).", 300, 50),
      ]),
      block([
        line("Este se parece mucho al objetante. Sus excusas son superficales", 220, 40),
        line("y muy antiguas. Enséñele que las excusas no son nuevas (Lucas", 260, 40),
      ]),
      block([
        line("Lección No. 12", 95, 460),
        line("PERSONAL I EN OPERACION", 340, 40),
        line('1. "Yo soy tan bueno como cualquier miembro de una', 380, 40),
      ]),
    ];

    expect(orderLinesByPosition(blocks)).toBe(
      [
        "EL EVANGELISMO PERSONAL EN OPERACION Lección No. 12",
        "(Continuación)",
        "V EL QUE SE EXCUSA",
        "Este se parece mucho al objetante. Sus excusas son superficales",
        "y muy antiguas. Enséñele que las excusas no son nuevas (Lucas",
        "14-24).",
        "PERSONAL I EN OPERACION",
        '1. "Yo soy tan bueno como cualquier miembro de una',
      ].join("\n")
    );
  });

  test("usa cornerPoints si falta el frame", () => {
    const blocks = [
      {
        lines: [
          {
            text: "segunda",
            cornerPoints: [
              { x: 10, y: 50 },
              { x: 110, y: 50 },
              { x: 110, y: 70 },
              { x: 10, y: 70 },
            ],
          },
          {
            text: "primera",
            cornerPoints: [
              { x: 10, y: 10 },
              { x: 110, y: 10 },
              { x: 110, y: 30 },
              { x: 10, y: 30 },
            ],
          },
        ],
      },
    ];

    expect(orderLinesByPosition(blocks)).toBe("primera\nsegunda");
  });

  test("devuelve vacío si alguna línea no tiene geometría", () => {
    const blocks = [block([line("Texto", 10, 10), { text: "Sin frame" }])];
    expect(orderLinesByPosition(blocks)).toBe("");
  });

  test("devuelve vacío sin bloques", () => {
    expect(orderLinesByPosition(undefined)).toBe("");
    expect(orderLinesByPosition([])).toBe("");
  });

  test("geometría real: página curvada no mezcla párrafos y ubica el fragmento", () => {
    // Coordenadas reales devueltas por ML Kit para la foto de prueba. Los
    // frame son rectángulos axis-aligned de líneas inclinadas (hasta 280 px
    // de alto para texto de ~100 px), por eso el orden debe usar cornerPoints.
    const p = (x: number, y: number) => ({ x, y });
    const blocks: MlKitBlock[] = [
      block([
        {
          text: "EL EVANGELISMO",
          cornerPoints: [p(289, 229), p(1007, 134), p(1019, 226), p(301, 321)],
        },
        {
          text: "(Continuación)",
          cornerPoints: [p(252, 356), p(796, 269), p(810, 357), p(266, 444)],
        },
      ]),
      block([
        {
          text: "V EL QUE SE EXCUSA",
          cornerPoints: [p(288, 505), p(995, 441), p(1002, 522), p(295, 586)],
        },
      ]),
      block([
        {
          text: "14-24).",
          cornerPoints: [p(230, 861), p(372, 848), p(377, 917), p(235, 930)],
        },
      ]),
      block([
        {
          text: "Este se parece mucho al objetante. Sus excusas son superficales",
          cornerPoints: [p(368, 597), p(2313, 711), p(2303, 878), p(358, 764)],
        },
        {
          text: "y muy antiguas. Enséñele que las excusas no son nuevas (Lucas",
          cornerPoints: [p(270, 696), p(2297, 792), p(2289, 954), p(262, 858)],
        },
      ]),
      block([
        {
          text: "Lección No. 12",
          cornerPoints: [p(1808, 71), p(2301, 209), p(2276, 297), p(1783, 159)],
        },
      ]),
      block([
        {
          text: "PERSONAL I EN OPERACION",
          cornerPoints: [p(1122, 124), p(2276, 311), p(2252, 458), p(1098, 271)],
        },
      ]),
      block([
        {
          text: '1. "Yo soy tan bueno como cualquier miembro de una',
          cornerPoints: [p(342, 911), p(2287, 1017), p(2278, 1164), p(333, 1058)],
        },
      ]),
    ];

    expect(orderLinesByPosition(blocks)).toBe(
      [
        "Lección No. 12",
        "EL EVANGELISMO PERSONAL I EN OPERACION",
        "(Continuación)",
        "V EL QUE SE EXCUSA",
        "Este se parece mucho al objetante. Sus excusas son superficales",
        "y muy antiguas. Enséñele que las excusas no son nuevas (Lucas",
        "14-24).",
        '1. "Yo soy tan bueno como cualquier miembro de una',
      ].join("\n")
    );
  });
});
