/**
 * Descargas de comentarios: clásicos de dominio público (Clarke, Henry, JFB,
 * Gill) y notas en español de unfoldingWord (CC BY-SA 4.0).
 *
 * Los clásicos pesan decenas de MB cada uno y no caben en el APK: se obtienen
 * de sermonindex.net y quedan en Paths.document/commentary/. Las notas en
 * español van en el bundle de assets y se «descargan» copiándose al mismo
 * directorio, para que la app funcione sin red.
 *
 * Toda descarga se escribe en un archivo temporal y solo se mueve al destino
 * cuando es JSON válido, igual que un downloader atómico.
 */

import { Directory, File, Paths } from "expo-file-system";
import { GENERATED_COMMENTARIES } from "./commentaryMetadata.generated";
import type { CommentaryEntry } from "./commentaryService";

export type DownloadableModule = {
  id: string;
  name: string;
  abbr: string;
  lang: string;
  license: string;
  sourceUrl: string;
  sizeBytes: number;
};

const RAW_BASE = "https://raw.githubusercontent.com";
const FETCH_TIMEOUT_MS = 120_000;
// El texto se aloja en el repositorio del proyecto, fuera del APK (licencias y
// tamaño). Cambiar ambos valores si el repo se mueve.
const REPO_PATH = "polakus368-dv/bible_lens";
const REPO_BRANCH = "main";

type RawDB = Record<string, Record<string, Array<{ v: number; e?: number; t: string }>>>;

export type DownloadInfo = {
  module: DownloadableModule;
  downloaded: boolean;
  sizeBytes: number;
};

function commentaryDir(): Directory {
  return new Directory(Paths.document, "commentary");
}

function moduleFile(id: string): File {
  return new File(commentaryDir(), `${id}.json`);
}

type RemoteModule = DownloadableModule & { file: string };

const UW_ES_TN: DownloadableModule = {
  id: "uW-es_tn",
  name: "Notas en español (unfoldingWord)",
  abbr: "uW",
  lang: "es",
  license: "CC BY-SA 4.0",
  sourceUrl: "https://git.door43.org/uW/es_tn",
  sizeBytes: 0,
};

/**
 * Nada de comentarios va en el APK: el build deja los JSON en
 * `assets/commentary/<id>.json` del proyecto y la app los pide del repositorio
 * (rama `main`) la primera vez que se usan.
 */
const REMOTE: RemoteModule[] = [
  ...GENERATED_COMMENTARIES.map((meta) => ({
    id: meta.id,
    name: meta.name,
    abbr: meta.abbr,
    lang: meta.lang,
    license: meta.license === "cc-by-sa" ? "CC BY-SA 4.0" : "Dominio público",
    sourceUrl: meta.sourceUrl,
    sizeBytes: meta.sizeBytes,
    file: `assets/commentary/${meta.id}.json`,
  })),
  { ...UW_ES_TN, file: `assets/commentary/${UW_ES_TN.id}.json` },
];

export function isDownloadable(id: string): boolean {
  return REMOTE.some((module) => module.id === id);
}

export function isDownloaded(id: string): boolean {
  return moduleFile(id).exists;
}

function validate(raw: unknown): RawDB {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("El archivo descargado no tiene el formato de comentario");
  }
  const db = raw as RawDB;
  for (const book of Object.values(db)) {
    if (!book || typeof book !== "object") throw new Error("Libro inválido en la descarga");
    for (const chapter of Object.values(book)) {
      if (!Array.isArray(chapter)) throw new Error("Capítulo inválido en la descarga");
      for (const item of chapter) {
        if (!item || typeof item.v !== "number" || typeof item.t !== "string") {
          throw new Error("Entrada inválida en la descarga");
        }
      }
    }
  }
  return db;
}

async function fetchRemote(module: RemoteModule): Promise<RawDB> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = `${RAW_BASE}/${REPO_PATH}/${REPO_BRANCH}/${module.file}`;
    const response = await fetch(url, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return validate(await response.json());
  } finally {
    clearTimeout(timer);
  }
}

/** Descarga el JSON a document/commentary con validación antes de moverlo. */
export async function downloadModule(id: string): Promise<DownloadInfo> {
  const remote = REMOTE.find((module) => module.id === id);
  if (!remote) throw new Error(`Módulo no descargable: ${id}`);

  const dir = commentaryDir();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });

  const target = moduleFile(id);
  const temp = new File(dir, `${id}.json.part`);
  if (temp.exists) temp.delete();

  const db = await fetchRemote(remote);
  temp.create();
  temp.write(JSON.stringify(db));
  await temp.move(target, { overwrite: true });

  return {
    module: moduleMetadata(id),
    downloaded: true,
    sizeBytes: isPhysicalFile(id) ? moduleFile(id).size : 0,
  };
}

/** El archivo vive en document/commentary (no en el bundle del APK). */
function isPhysicalFile(id: string): boolean {
  return moduleFile(id).exists;
}

export function removeModule(id: string): void {
  const file = moduleFile(id);
  if (file.exists) file.delete();
}

/** Lee el capítulo descargado; null si no está descargado o no se pudo leer. */
export function readDownloadedChapter(
  id: string,
  bookId: string,
  chapter: number
): CommentaryEntry[] | null {
  const file = moduleFile(id);
  if (!file.exists) return null;
  try {
    const db = JSON.parse(file.textSync()) as RawDB;
    const items = db[bookId]?.[String(chapter)] ?? [];
    return items.map((item) => ({
      author: id,
      verseStart: item.v,
      verseEnd: item.e ?? item.v,
      text: item.t,
    }));
  } catch {
    return null;
  }
}

export function downloadedBytes(): number {
  const dir = commentaryDir();
  if (!dir.exists) return 0;
  return dir.list().reduce((sum, entry) => sum + ((entry as File).size ?? 0), 0);
}

function moduleMetadata(id: string): DownloadableModule {
  const module = REMOTE.find((entry) => entry.id === id);
  if (!module) throw new Error(`Módulo desconocido: ${id}`);
  return module;
}

/** Descargas en el orden de la UI: español primero, luego los clásicos. */
export function listDownloads(): DownloadInfo[] {
  return [...REMOTE]
    .sort((a, b) => Number(b.lang === "es") - Number(a.lang === "es"))
    .map((module) => ({
    module,
    downloaded: isDownloaded(module.id),
    sizeBytes: isDownloaded(module.id) ? moduleFile(module.id).size : 0,
  }));
}
