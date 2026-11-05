/**
 * Sermones de sermonindex.net consultados en runtime.
 *
 * La API v2 no pagina: un versículo popular devuelve ~6,5 MB (y el capítulo
 * ~11 MB). Nunca se persiste la respuesta cruda: se mapea a un resumen mínimo,
 * se corta a MAX_HITS y solo eso se guarda en Paths.document/sermons.
 *
 * Licencia: uso personal y ministerial, no comercial, sin empaquetar en el
 * APK (https://sermonindex.net/md/copying-permissions/).
 */

import { Directory, File, Paths } from "expo-file-system";

const API_BASE = "https://api.sermonindex.net/v2";
export const MAX_HITS = 100;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 20_000;

export type SermonHit = {
  id: string;
  title: string;
  speaker: string;
  duration: string;
  hasTranscript: boolean;
  summary: string;
  url: string;
  txtUrl: string;
  audioUrl: string;
};

export type SermonVerseResult = {
  bookId: string;
  chapter: number;
  verse: number;
  reference: string;
  /** Total de sermones relacionados en sermonindex (puede superar `sermons`). */
  total: number;
  sermons: SermonHit[];
  /** true si se sirvió desde la caché (sin red). */
  cached: boolean;
  /** Epoch ms de la última descarga. */
  fetchedAt: number;
  /** Vigencia con la que se sirvió: TTL si es fresca, 0 si está vencida. */
  fetchedAtMs: number;
  stale: boolean;
};

type ApiSermon = Record<string, string | undefined>;

type ApiResponse = {
  bookId?: string;
  chapter?: number;
  verse?: number;
  reference?: string;
  sermonCount?: number;
  sermons?: ApiSermon[];
};

type CacheFile = {
  fetchedAt: number;
  reference: string;
  total: number;
  sermons: SermonHit[];
};

function toHit(raw: ApiSermon): SermonHit | null {
  if (!raw.id || !raw.title) return null;
  return {
    id: raw.id,
    title: raw.title,
    speaker: raw.speaker ?? "SermonIndex",
    duration: raw.duration ?? "",
    hasTranscript: raw.hasTranscript === "True",
    summary: raw.summary ?? raw.description ?? "",
    url: raw.url ?? "",
    txtUrl: raw.txtUrl ?? "",
    audioUrl: raw.cdnMp3Url || raw.mp3Url || "",
  };
}

function cacheFile(bookId: string, chapter: number, verse: number): File {
  return new File(new Directory(Paths.document, "sermons", bookId, String(chapter)), `${verse}.json`);
}

export function readCache(
  bookId: string,
  chapter: number,
  verse: number,
  now = Date.now()
): { data: CacheFile; stale: boolean } | null {
  try {
    const file = cacheFile(bookId, chapter, verse);
    if (!file.exists) return null;
    const data = JSON.parse(file.textSync()) as CacheFile;
    if (!Array.isArray(data.sermons)) return null;
    return { data, stale: now - data.fetchedAt > CACHE_TTL_MS };
  } catch {
    return null;
  }
}

function writeCache(bookId: string, chapter: number, verse: number, data: CacheFile): void {
  try {
    const file = cacheFile(bookId, chapter, verse);
    const dir = file.parentDirectory;
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    file.write(JSON.stringify(data));
  } catch (error) {
    console.warn("No se pudo guardar la caché de sermones", error);
  }
}

const inFlight = new Map<string, Promise<SermonVerseResult>>();

async function fetchVerse(
  bookId: string,
  chapter: number,
  verse: number
): Promise<{ total: number; sermons: SermonHit[] }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE}/scripture/${bookId}/${chapter}/${verse}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = (await response.json()) as ApiResponse;
    const sermons = (body.sermons ?? [])
      .map(toHit)
      .filter((hit): hit is SermonHit => hit !== null)
      .slice(0, MAX_HITS);
    return { total: body.sermonCount ?? sermons.length, sermons };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sermones de un versículo. Usa la caché si es fresca; si la red falla
 * devuelve la caché vieja marcada como `stale`; si no hay caché, propaga el error.
 */
export function searchByVerse(
  bookId: string,
  chapter: number,
  verse: number,
  options: { forceRefresh?: boolean } = {}
): Promise<SermonVerseResult> {
  const key = `${bookId}/${chapter}/${verse}`;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const task = (async (): Promise<SermonVerseResult> => {
    const cached = readCache(bookId, chapter, verse);
    if (cached && !cached.stale && !options.forceRefresh) {
      return {
        bookId,
        chapter,
        verse,
        reference: cached.data.reference,
        total: cached.data.total,
        sermons: cached.data.sermons,
        cached: true,
        fetchedAt: cached.data.fetchedAt,
        fetchedAtMs: CACHE_TTL_MS,
        stale: false,
      };
    }

    try {
      const { total, sermons } = await fetchVerse(bookId, chapter, verse);
      const data: CacheFile = {
        fetchedAt: Date.now(),
        reference: `${bookId} ${chapter}:${verse}`,
        total,
        sermons,
      };
      writeCache(bookId, chapter, verse, data);
      return {
        bookId,
        chapter,
        verse,
        reference: data.reference,
        total,
        sermons,
        cached: false,
        fetchedAt: data.fetchedAt,
        fetchedAtMs: CACHE_TTL_MS,
        stale: false,
      };
    } catch (error) {
      if (cached) {
        return {
          bookId,
          chapter,
          verse,
          reference: cached.data.reference,
          total: cached.data.total,
          sermons: cached.data.sermons,
          cached: true,
          fetchedAt: cached.data.fetchedAt,
          fetchedAtMs: 0,
          stale: true,
        };
      }
      throw error;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, task);
  return task;
}

/** Cantidad de sermones por capítulo (respuesta ligera en `verses`). */
export async function getChapterSermonCount(
  bookId: string,
  chapter: number
): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE}/scripture/${bookId}/${chapter}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { sermonCount?: number };
    return typeof body.sermonCount === "number" ? body.sermonCount : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
