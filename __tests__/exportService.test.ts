import { parseReferences } from "../src/services/parser/bibleParser";
import type { VerseResult } from "../src/services/bible/bibleService";
import { getBibleVersion } from "../src/services/bible/versions";
import {
  NOT_FOUND_MARKER,
  buildMarkdownExport,
  buildPlainExport,
  buildTxtExport,
  missingVerseMarker,
} from "../src/services/export/exportService";

const VERSION = getBibleVersion("RVR1960");
const DATE = new Date(2026, 9, 29, 17, 5);

function result(
  citation: string,
  verses: Array<{ number: number; text: string }>
): VerseResult {
  const [ref] = parseReferences(citation);
  return {
    ref,
    lang: "es",
    displayRef: `${ref.bookDisplayES} ${ref.chapter}:${citation.split(":")[1]}`,
    verses,
    notFound: verses.length === 0,
  };
}

const RESULTS: VerseResult[] = [
  result("Gén 1:1-3", [
    { number: 1, text: "En el principio." },
    { number: 3, text: "Sea la luz." },
  ]),
  result("Jn 3:99", []),
];

describe("exportService", () => {
  test("texto plano incluye todas las citas, versículos, faltantes y copyright", () => {
    const text = buildPlainExport(RESULTS, VERSION);
    expect(text).toContain("Bible Lens · RVR1960");
    expect(text).toContain(VERSION.name);
    expect(text).toContain("Génesis 1:1-3");
    expect(text).toContain("1 En el principio.");
    expect(text).toContain("3 Sea la luz.");
    expect(text).toContain(missingVerseMarker(2));
    expect(text).toContain("Juan 3:99");
    expect(text).toContain(NOT_FOUND_MARKER);
    expect(text).toContain(VERSION.copyright);
  });

  test("txt agrega la fecha y mantiene el contenido completo", () => {
    const text = buildTxtExport(RESULTS, VERSION, DATE);
    expect(text).toContain("29/10/2026 17:05");
    expect(text).toContain("3 Sea la luz.");
    expect(text).toContain(NOT_FOUND_MARKER);
    expect(text).toContain(VERSION.copyright);
  });

  test("markdown usa títulos y citas en bloque", () => {
    const text = buildMarkdownExport(RESULTS, VERSION, DATE);
    expect(text).toContain("# Bible Lens · RVR1960");
    expect(text).toContain("## Génesis 1:1-3");
    expect(text).toContain("> **1** En el principio.");
    expect(text).toContain(`> _${missingVerseMarker(2)}_`);
    expect(text).toContain("## Juan 3:99");
    expect(text).toContain(`> _${NOT_FOUND_MARKER}_`);
    expect(text).toContain(VERSION.copyright);
  });
});
