/**
 * Módulos de comentarios de dominio público publicados por sermonindex.net.
 * La app los lee desde assets/commentary/<id>.json (generados por
 * scripts/build-commentary.ts). Solo se listan fuentes PD: nada con copyright.
 */

export type CommentarySource = {
  /** Nombre del archivo y del módulo en sermonindex. */
  id: string;
  abbr: string;
  name: string;
  lang: "en";
  /** "verse": un encabezado por versículo o bloque de versículos. */
  granularity: "verse";
  sourceUrl: string;
};

const SI = "https://www.sermonindex.net/commentary";

export const COMMENTARY_SOURCES: CommentarySource[] = [
  {
    id: "adamclarke",
    abbr: "Clarke",
    name: "Adam Clarke",
    lang: "en",
    granularity: "verse",
    sourceUrl: `${SI}/adamclarke`,
  },
  {
    id: "matthewhenry",
    abbr: "Henry",
    name: "Matthew Henry",
    lang: "en",
    granularity: "verse",
    sourceUrl: `${SI}/matthewhenry`,
  },
  {
    id: "jfb-u",
    abbr: "JFB",
    name: "Jamieson, Fausset & Brown",
    lang: "en",
    granularity: "verse",
    sourceUrl: `${SI}/jfb-u`,
  },
  {
    id: "gill",
    abbr: "Gill",
    name: "John Gill",
    lang: "en",
    granularity: "verse",
    sourceUrl: `${SI}/gill`,
  },
];
