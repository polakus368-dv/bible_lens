/**
 * Tipos compartidos por el servicio bíblico.
 * BibleDB mantiene el formato compacto ya usado por la app:
 * { "GEN": { "1": { "1": "En el principio..." } } }
 */

export type BibleDB = Record<string, Record<string, Record<string, string>>>;

export type BibleVersionMeta = {
  /** Identificador interno, por ejemplo RVR1960. */
  id: string;
  /** Abreviatura visible en la UI. */
  abbr: string;
  /** Nombre completo de la traducción. */
  name: string;
  /** Archivo JSON dentro de assets/bible. */
  file: string;
  /** Aviso de derechos de autor de la fuente. */
  copyright: string;
  /** true solo para textos de dominio público. */
  isPublicDomain: boolean;
  /** Página de origen del texto. */
  sourceUrl: string;
};
