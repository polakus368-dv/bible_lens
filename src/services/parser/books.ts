/**
 * Diccionario bilingüe de libros bíblicos.
 * Fuente única de verdad para el parser.
 * Cada libro tiene id OSIS (ej: GEN, JHN, 1CO) y variantes ES/EN + abreviaturas.
 * Normalización: lower, sin acentos, sin puntos.
 */

export type BookInfo = {
  id: string; // OSIS id
  names: string[]; // variantes normalizadas
  displayES: string;
  displayEN: string;
  chapters: number;
};

function n(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .trim();
}

const rawBooks: Array<{
  id: string;
  displayES: string;
  displayEN: string;
  chapters: number;
  variants: string[];
}> = [
  { id: "GEN", displayES: "Génesis", displayEN: "Genesis", chapters: 50, variants: ["génesis", "genesis", "gen", "gn", "ge"] },
  { id: "EXO", displayES: "Éxodo", displayEN: "Exodus", chapters: 40, variants: ["éxodo", "exodo", "ex", "exo"] },
  { id: "LEV", displayES: "Levítico", displayEN: "Leviticus", chapters: 27, variants: ["levítico", "levitico", "lev", "lv", "le"] },
  { id: "NUM", displayES: "Números", displayEN: "Numbers", chapters: 36, variants: ["números", "numeros", "num", "nm", "nu"] },
  { id: "DEU", displayES: "Deuteronomio", displayEN: "Deuteronomy", chapters: 34, variants: ["deuteronomio", "deut", "deu", "dt"] },
  { id: "JOS", displayES: "Josué", displayEN: "Joshua", chapters: 24, variants: ["josué", "josue", "jos"] },
  { id: "JDG", displayES: "Jueces", displayEN: "Judges", chapters: 21, variants: ["jueces", "jue", "jdg", "jg"] },
  { id: "RUT", displayES: "Rut", displayEN: "Ruth", chapters: 4, variants: ["rut", "ruth", "rt", "ru"] },
  { id: "1SA", displayES: "1 Samuel", displayEN: "1 Samuel", chapters: 31, variants: ["1 samuel", "1samuel", "1 sam", "1sam", "1 sa", "1sa", "1 s"] },
  { id: "2SA", displayES: "2 Samuel", displayEN: "2 Samuel", chapters: 24, variants: ["2 samuel", "2samuel", "2 sam", "2sam", "2 sa", "2sa"] },
  { id: "1KI", displayES: "1 Reyes", displayEN: "1 Kings", chapters: 22, variants: ["1 reyes", "1 re", "1reyes", "1 kings", "1kings", "1 ki", "1ki", "1 r"] },
  { id: "2KI", displayES: "2 Reyes", displayEN: "2 Kings", chapters: 25, variants: ["2 reyes", "2 re", "2reyes", "2 kings", "2kings", "2 ki", "2ki"] },
  { id: "1CH", displayES: "1 Crónicas", displayEN: "1 Chronicles", chapters: 29, variants: ["1 crónicas", "1 cronicas", "1 cron", "1cron", "1 ch", "1ch", "1 cro"] },
  { id: "2CH", displayES: "2 Crónicas", displayEN: "2 Chronicles", chapters: 36, variants: ["2 crónicas", "2 cronicas", "2 cron", "2cron", "2 ch", "2ch"] },
  { id: "EZR", displayES: "Esdras", displayEN: "Ezra", chapters: 10, variants: ["esdras", "esd", "ezr"] },
  { id: "NEH", displayES: "Nehemías", displayEN: "Nehemiah", chapters: 13, variants: ["nehemías", "nehemias", "neh", "ne"] },
  { id: "EST", displayES: "Ester", displayEN: "Esther", chapters: 10, variants: ["ester", "esther", "est", "es"] },
  { id: "JOB", displayES: "Job", displayEN: "Job", chapters: 42, variants: ["job"] },
  { id: "PSA", displayES: "Salmos", displayEN: "Psalms", chapters: 150, variants: ["salmos", "salmo", "sal", "psalms", "psalm", "ps", "psa", "sl"] },
  { id: "PRO", displayES: "Proverbios", displayEN: "Proverbs", chapters: 31, variants: ["proverbios", "proverbio", "prov", "pro", "pr", "pv"] },
  { id: "ECC", displayES: "Eclesiastés", displayEN: "Ecclesiastes", chapters: 12, variants: ["eclesiastés", "eclesiastes", "eclesiast", "ecc", "ec", "ecl"] },
  { id: "SNG", displayES: "Cantares", displayEN: "Song of Solomon", chapters: 8, variants: ["cantares", "cantar", "cnt", "song", "sng", "cant"] },
  { id: "ISA", displayES: "Isaías", displayEN: "Isaiah", chapters: 66, variants: ["isaías", "isaias", "isa", "is", "isai"] },
  { id: "JER", displayES: "Jeremías", displayEN: "Jeremiah", chapters: 52, variants: ["jeremías", "jeremias", "jer", "je", "jr"] },
  { id: "LAM", displayES: "Lamentaciones", displayEN: "Lamentations", chapters: 5, variants: ["lamentaciones", "lam", "lm"] },
  { id: "EZK", displayES: "Ezequiel", displayEN: "Ezekiel", chapters: 48, variants: ["ezequiel", "eze", "ezk", "ezq", "ez"] },
  { id: "DAN", displayES: "Daniel", displayEN: "Daniel", chapters: 12, variants: ["daniel", "dan", "dn"] },
  { id: "HOS", displayES: "Oseas", displayEN: "Hosea", chapters: 14, variants: ["oseas", "hos", "os"] },
  { id: "JOL", displayES: "Joel", displayEN: "Joel", chapters: 3, variants: ["joel", "jl", "jol"] },
  { id: "AMO", displayES: "Amós", displayEN: "Amos", chapters: 9, variants: ["amós", "amos", "am", "amo"] },
  { id: "OBA", displayES: "Abdías", displayEN: "Obadiah", chapters: 1, variants: ["abdías", "abdias", "abd", "oba", "ab"] },
  { id: "JON", displayES: "Jonás", displayEN: "Jonah", chapters: 4, variants: ["jonás", "jonas", "jon", "jonah"] },
  { id: "MIC", displayES: "Miqueas", displayEN: "Micah", chapters: 7, variants: ["miqueas", "miq", "mic", "mq"] },
  { id: "NAM", displayES: "Nahúm", displayEN: "Nahum", chapters: 3, variants: ["nahúm", "nahum", "nah", "nam", "na"] },
  { id: "HAB", displayES: "Habacuc", displayEN: "Habakkuk", chapters: 3, variants: ["habacuc", "habakkuk", "hab", "ha"] },
  { id: "ZEP", displayES: "Sofonías", displayEN: "Zephaniah", chapters: 3, variants: ["sofonías", "sofonias", "sof", "zep", "so"] },
  { id: "HAG", displayES: "Hageo", displayEN: "Haggai", chapters: 2, variants: ["hageo", "hag", "ag", "haggai"] },
  { id: "ZEC", displayES: "Zacarías", displayEN: "Zechariah", chapters: 14, variants: ["zacarías", "zacarias", "zac", "zec", "za"] },
  { id: "MAL", displayES: "Malaquías", displayEN: "Malachi", chapters: 4, variants: ["malaquías", "malaquias", "mal", "ml"] },
  // NT
  { id: "MAT", displayES: "Mateo", displayEN: "Matthew", chapters: 28, variants: ["mateo", "matthew", "mt", "mat", "matt"] },
  { id: "MRK", displayES: "Marcos", displayEN: "Mark", chapters: 16, variants: ["marcos", "mark", "mc", "mrk", "mar", "mk"] },
  { id: "LUK", displayES: "Lucas", displayEN: "Luke", chapters: 24, variants: ["lucas", "luke", "lc", "luk", "luc"] },
  { id: "JHN", displayES: "Juan", displayEN: "John", chapters: 21, variants: ["juan", "john", "jn", "jhn"] },
  { id: "ACT", displayES: "Hechos", displayEN: "Acts", chapters: 28, variants: ["hechos", "acts", "hch", "act", "hech"] },
  { id: "ROM", displayES: "Romanos", displayEN: "Romans", chapters: 16, variants: ["romanos", "romans", "rom", "ro", "rm"] },
  { id: "1CO", displayES: "1 Corintios", displayEN: "1 Corinthians", chapters: 16, variants: ["1 corintios", "1corintios", "1 cor", "1cor", "1 co", "1co", "1 corinthians", "1corinthians"] },
  { id: "2CO", displayES: "2 Corintios", displayEN: "2 Corinthians", chapters: 13, variants: ["2 corintios", "2corintios", "2 cor", "2cor", "2 co", "2co", "2 corinthians"] },
  { id: "GAL", displayES: "Gálatas", displayEN: "Galatians", chapters: 6, variants: ["gálatas", "galatas", "galatians", "gal", "ga", "gl"] },
  { id: "EPH", displayES: "Efesios", displayEN: "Ephesians", chapters: 6, variants: ["efesios", "ephesians", "ef", "efe", "efes", "eph"] },
  { id: "PHP", displayES: "Filipenses", displayEN: "Philippians", chapters: 4, variants: ["filipenses", "philippians", "fil", "php", "filip", "phil"] },
  { id: "COL", displayES: "Colosenses", displayEN: "Colossians", chapters: 4, variants: ["colosenses", "colossians", "col", "co"] },
  { id: "1TH", displayES: "1 Tesalonicenses", displayEN: "1 Thessalonians", chapters: 5, variants: ["1 tesalonicenses", "1 tes", "1tes", "1 th", "1th", "1 thessalonians", "1thessalonians", "1 ts"] },
  { id: "2TH", displayES: "2 Tesalonicenses", displayEN: "2 Thessalonians", chapters: 3, variants: ["2 tesalonicenses", "2 tes", "2tes", "2 th", "2th", "2 thessalonians"] },
  { id: "1TI", displayES: "1 Timoteo", displayEN: "1 Timothy", chapters: 6, variants: ["1 timoteo", "1timoteo", "1 tim", "1tim", "1 ti", "1ti", "1 timothy"] },
  { id: "2TI", displayES: "2 Timoteo", displayEN: "2 Timothy", chapters: 4, variants: ["2 timoteo", "2timoteo", "2 tim", "2tim", "2 ti", "2ti", "2 timothy"] },
  { id: "TIT", displayES: "Tito", displayEN: "Titus", chapters: 3, variants: ["tito", "titus", "tit", "ti"] },
  { id: "PHM", displayES: "Filemón", displayEN: "Philemon", chapters: 1, variants: ["filemón", "filemon", "philemon", "flm", "phm", "fm"] },
  { id: "HEB", displayES: "Hebreos", displayEN: "Hebrews", chapters: 13, variants: ["hebreos", "hebrews", "heb", "he", "hb"] },
  { id: "JAS", displayES: "Santiago", displayEN: "James", chapters: 5, variants: ["santiago", "james", "stg", "sant", "jas", "jm", "sg"] },
  { id: "1PE", displayES: "1 Pedro", displayEN: "1 Peter", chapters: 5, variants: ["1 pedro", "1pedro", "1 pe", "1pe", "1 p", "1pe", "1 peter", "1pet", "1 pet"] },
  { id: "2PE", displayES: "2 Pedro", displayEN: "2 Peter", chapters: 3, variants: ["2 pedro", "2pedro", "2 pe", "2pe", "2 peter", "2pet"] },
  { id: "1JN", displayES: "1 Juan", displayEN: "1 John", chapters: 5, variants: ["1 juan", "1juan", "1 jn", "1jn", "1 jhn", "1jhn", "1 john", "1john", "1 ju"] },
  { id: "2JN", displayES: "2 Juan", displayEN: "2 John", chapters: 1, variants: ["2 juan", "2juan", "2 jn", "2jn", "2 john", "2john"] },
  { id: "3JN", displayES: "3 Juan", displayEN: "3 John", chapters: 1, variants: ["3 juan", "3juan", "3 jn", "3jn", "3 john", "3john"] },
  { id: "JUD", displayES: "Judas", displayEN: "Jude", chapters: 1, variants: ["judas", "jude", "jud", "jd"] },
  { id: "REV", displayES: "Apocalipsis", displayEN: "Revelation", chapters: 22, variants: ["apocalipsis", "revelation", "apoc", "ap", "rev", "apo", "revelations"] },
];

export const BOOKS: BookInfo[] = rawBooks.map((b) => ({
  id: b.id,
  displayES: b.displayES,
  displayEN: b.displayEN,
  chapters: b.chapters,
  names: b.variants.map(n),
}));

// Mapa normalizado -> BookInfo (para lookup O(1))
// Guardamos tanto forma normalizada (sin acentos) como forma original con acentos en lower, para regex accent-insensitive
export const BOOK_MAP = new Map<string, BookInfo>();
for (let i = 0; i < rawBooks.length; i++) {
  const raw = rawBooks[i];
  const book = BOOKS[i];
  for (const variant of raw.variants) {
    const norm = n(variant);
    if (!BOOK_MAP.has(norm)) BOOK_MAP.set(norm, book);
    const withAccent = variant.toLowerCase().replace(/\./g, "").trim();
    if (!BOOK_MAP.has(withAccent)) BOOK_MAP.set(withAccent, book);
  }
  BOOK_MAP.set(book.id.toLowerCase(), book);
}

// Para ordenar por longitud desc (evitar que "jn" matchee antes que "1 jn")
export const BOOK_VARIANTS_SORTED = Array.from(BOOK_MAP.keys()).sort((a, b) => b.length - a.length);

export function normalizeBookName(raw: string): BookInfo | undefined {
  const key = n(raw);
  return BOOK_MAP.get(key);
}

// Escape regex
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
