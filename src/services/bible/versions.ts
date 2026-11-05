/**
 * Catálogo de versiones bíblicas disponibles offline.
 *
 * Los metadatos (nombre, copyright, archivo) se generan con
 * scripts/build-versions.ts. Acá se agrega el loader lazy de cada JSON:
 * Metro solo evalúa el require cuando el usuario elige esa versión.
 */

import type { BibleDB, BibleVersionMeta } from "./types";
import { GENERATED_VERSIONS } from "./versionMetadata.generated";

export type BibleVersion = BibleVersionMeta & {
  /** Carga el JSON compacto de esta versión. */
  load: () => BibleDB;
};

type LoaderMap = Partial<Record<string, () => BibleDB>>;

function loadJson(module: unknown): BibleDB {
  const mod = module as { default?: BibleDB } | BibleDB;
  return (mod as { default?: BibleDB }).default ?? (mod as BibleDB);
}

const LOADERS: LoaderMap = {
  RVR1909: () => {
    // @ts-ignore Metro resuelve el require estático al bundlear.
    return loadJson(require("../../../assets/bible/es-rvr1909.json"));
  },
  RVR1960: () => {
    // @ts-ignore
    return loadJson(require("../../../assets/bible/es-rvr1960.json"));
  },
  NVI: () => {
    // @ts-ignore
    return loadJson(require("../../../assets/bible/es-nvi.json"));
  },
  LBLA: () => {
    // @ts-ignore
    return loadJson(require("../../../assets/bible/es-lbla.json"));
  },
};

export const BIBLE_VERSIONS: BibleVersion[] = GENERATED_VERSIONS.flatMap(
  (meta) => {
    const load = LOADERS[meta.id];
    return load ? [{ ...meta, load }] : [];
  }
);

export const DEFAULT_VERSION_ID = "RVR1909";

export function isBibleVersionId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    BIBLE_VERSIONS.some((version) => version.id === value)
  );
}

export function getBibleVersion(id?: string): BibleVersion {
  return (
    BIBLE_VERSIONS.find((version) => version.id === id) ??
    BIBLE_VERSIONS.find((version) => version.id === DEFAULT_VERSION_ID) ??
    BIBLE_VERSIONS[0]
  );
}
