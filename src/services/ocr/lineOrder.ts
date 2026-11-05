/**
 * ML Kit devuelve los bloques de texto en un orden que no siempre coincide
 * con la lectura visual (páginas curvadas, encabezados a la derecha, etc.).
 * Aquí reconstruimos el texto ordenando las líneas por su posición real.
 *
 * Importante: en fotos de páginas curvadas o inclinadas, `frame` es el
 * rectángulo axis-aligned de una línea rotada, así que puede ser mucho más
 * alto que el texto y solaparse con líneas vecinas. Por eso usamos el borde
 * izquierdo de `cornerPoints` (no el centro del rectángulo) como posición
 * vertical de cada línea.
 */

export type LineFrame = { top: number; left: number; width: number; height: number };
type Point = { x: number; y: number };

export type MlKitLine = {
  text?: string;
  frame?: LineFrame;
  cornerPoints?: ReadonlyArray<Point>;
};

export type MlKitBlock = { lines?: MlKitLine[] };

type PositionedLine = {
  text: string;
  leftY: number;
  minX: number;
  maxX: number;
};

function geometryFromCorners(
  points?: ReadonlyArray<Point>
): { leftY: number; minX: number; maxX: number } | null {
  if (!points || points.length < 4) return null;
  const topLeft = points[0];
  const bottomLeft = points[3];
  const xs = points.map((point) => point.x);
  const leftY = (topLeft.y + bottomLeft.y) / 2;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  if (![leftY, minX, maxX].every(Number.isFinite)) return null;
  return { leftY, minX, maxX };
}

function geometryFromFrame(
  frame?: LineFrame
): { leftY: number; minX: number; maxX: number } | null {
  if (!frame) return null;
  const leftY = frame.top + frame.height / 2;
  const minX = frame.left;
  const maxX = frame.left + Math.max(frame.width, 0);
  if (![leftY, minX, maxX].every(Number.isFinite)) return null;
  return { leftY, minX, maxX };
}

/**
 * Devuelve el texto en orden visual, o "" si alguna línea no trae geometría
 * (en ese caso conviene usar el texto original que devuelve ML Kit).
 */
export function orderLinesByPosition(
  blocks: ReadonlyArray<MlKitBlock> | undefined | null
): string {
  const lines: PositionedLine[] = [];

  for (const block of blocks ?? []) {
    for (const line of block.lines ?? []) {
      const text = (line.text ?? "").trim();
      if (!text) continue;
      const geometry =
        geometryFromCorners(line.cornerPoints) ?? geometryFromFrame(line.frame);
      if (!geometry) return "";
      lines.push({ text, ...geometry });
    }
  }

  if (lines.length === 0) return "";

  lines.sort((a, b) => a.leftY - b.leftY);

  // Separación vertical típica entre líneas: sirve para decidir cuándo dos
  // fragmentos pertenecen a la misma fila visual (p. ej. un encabezado
  // partido en dos bloques a izquierda y derecha).
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const gap = lines[i].leftY - lines[i - 1].leftY;
    if (gap > 1) gaps.push(gap);
  }
  gaps.sort((a, b) => a - b);
  const medianGap = gaps.length > 0 ? gaps[Math.floor(gaps.length / 2)] : 0;
  const rowTolerance = medianGap * 0.85;

  const rows: PositionedLine[][] = [];
  for (const line of lines) {
    const row = rows[rows.length - 1];
    if (row && rowTolerance > 0) {
      const anchor = row[0];
      const overlap =
        Math.min(anchor.maxX, line.maxX) - Math.max(anchor.minX, line.minX);
      const minWidth = Math.min(
        anchor.maxX - anchor.minX,
        line.maxX - line.minX
      );
      // Solo unimos fragmentos que están uno al lado del otro, no líneas
      // consecutivas del mismo párrafo (esas se solapan horizontalmente).
      const sideBySide = overlap <= minWidth * 0.25;
      if (sideBySide && line.leftY - anchor.leftY <= rowTolerance) {
        row.push(line);
        continue;
      }
    }
    rows.push([line]);
  }

  return rows
    .map((row) =>
      [...row]
        .sort((a, b) => a.minX - b.minX)
        .map((line) => line.text)
        .join(" ")
    )
    .join("\n");
}
