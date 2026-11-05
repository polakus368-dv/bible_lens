/**
 * Preferencias locales de la app en Paths.document/settings.json.
 * Si el archivo no existe o está corrupto se usan los valores por defecto.
 */

import { File, Paths } from "expo-file-system";
import { DEFAULT_VERSION_ID, isBibleVersionId } from "../bible/versions";
import { DEFAULT_COMMENTARY_IDS } from "../commentary/commentaryService";

export type AppSettings = {
  versionId: string;
  /** Autores de comentarios mostrados en el carrusel del capítulo. */
  commentaryAuthors: string[];
};

const SETTINGS_FILE = "settings.json";

function defaultSettings(): AppSettings {
  return { versionId: DEFAULT_VERSION_ID, commentaryAuthors: [...DEFAULT_COMMENTARY_IDS] };
}

function settingsFile(): File {
  return new File(Paths.document, SETTINGS_FILE);
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const file = settingsFile();
    if (!file.exists) return defaultSettings();
    const parsed = JSON.parse(await file.text()) as Partial<AppSettings>;
    return {
      versionId: isBibleVersionId(parsed.versionId)
        ? parsed.versionId
        : DEFAULT_VERSION_ID,
      commentaryAuthors: Array.isArray(parsed.commentaryAuthors)
        ? parsed.commentaryAuthors.filter((id) => typeof id === "string")
        : [...DEFAULT_COMMENTARY_IDS],
    };
  } catch {
    return defaultSettings();
  }
}

/** Combina los cambios con lo guardado (por ejemplo, cambiar solo la versión). */
export async function saveSettings(patch: Partial<AppSettings>): Promise<void> {
  const settings = { ...(await loadSettings()), ...patch };
  try {
    const file = settingsFile();
    if (!file.exists) file.create({ intermediates: true });
    file.write(JSON.stringify(settings, null, 2));
  } catch (error) {
    console.warn("No se pudo guardar settings.json", error);
  }
}
