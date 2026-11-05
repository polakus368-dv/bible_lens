import fs from "node:fs";
import path from "node:path";
import { BOOKS } from "../src/services/parser/books";

type AquiferVerse = {
  index_reference: string;
  content: string;
};

type BibleDB = Record<string, Record<string, Record<string, string>>>;

function stripHtml(content: string): string {
  return content
    .replace(/<sup>[\s\S]*?<\/sup>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function build(inputDir: string, outputFile: string): void {
  const files = fs
    .readdirSync(inputDir)
    .filter((name) => name.endsWith(".content.json"))
    .sort();

  if (files.length !== 66) {
    throw new Error(`Se esperaban 66 libros, se encontraron ${files.length}`);
  }

  const db: BibleDB = {};
  let total = 0;

  for (const file of files) {
    const verses = JSON.parse(
      fs.readFileSync(path.join(inputDir, file), "utf8")
    ) as AquiferVerse[];

    for (const verse of verses) {
      const reference = verse.index_reference;
      const bookNumber = parseInt(reference.slice(0, 2), 10);
      const chapter = parseInt(reference.slice(2, 5), 10);
      const number = parseInt(reference.slice(5), 10);
      const book = BOOKS[bookNumber - 1];

      if (!book || !chapter || !number) {
        throw new Error(`Referencia inválida: ${reference} (${file})`);
      }

      const text = stripHtml(verse.content);
      if (!text) continue;

      db[book.id] ??= {};
      db[book.id][String(chapter)] ??= {};
      db[book.id][String(chapter)][String(number)] = text;
      total++;
    }
  }

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(db)}\n`);
  console.log(`RVR1909: ${files.length} libros, ${total} versículos -> ${outputFile}`);
}

const [inputDir, outputFile] = process.argv.slice(2);

if (!inputDir || !outputFile) {
  console.error("Uso: npx tsx scripts/build-rvr1909.ts <json-dir> <salida.json>");
  process.exit(1);
}

build(inputDir, outputFile);
