/**
 * downloads.ts usa expo-file-system (API nueva) y el JSON de assets vía require.
 * Se mockean el sistema de archivos en memoria y el módulo de assets para
 * probar la validación y la copia sin tocar disco ni red.
 */

type MemFile = { content: string; exists: boolean };
const files = new Map<string, MemFile>();

class MockFile {
  path: string;
  constructor(directory: MockDirectory | undefined, name: string) {
    this.path = directory ? `${directory.path}/${name}` : name;
  }
  get exists() {
    return files.get(this.path)?.exists ?? false;
  }
  get size() {
    return files.get(this.path)?.content.length ?? 0;
  }
  create() {
    files.set(this.path, { content: "", exists: true });
  }
  write(content: string) {
    files.set(this.path, { content, exists: true });
  }
  textSync() {
    const file = files.get(this.path);
    if (!file?.exists) throw new Error("ENOENT");
    return file.content;
  }
  delete() {
    files.delete(this.path);
  }
  async move(destination: MockFile) {
    const content = this.textSync();
    files.delete(this.path);
    files.set(destination.path, { content, exists: true });
  }
}

class MockDirectory {
  path: string;
  constructor(root: string | MockDirectory, ...parts: string[]) {
    this.path = [String(root), ...parts].join("/");
  }
  get exists() {
    return true;
  }
  create() {}
  list() {
    return [...files.keys()]
      .filter((key) => key.startsWith(`${this.path}/`))
      .map((key) => Object.assign(new MockFile(undefined, key), { exists: true }));
  }
}

jest.mock("expo-file-system", () => ({
  Paths: { document: "/doc" },
  File: MockFile,
  Directory: MockDirectory,
}));

const DB = {
  JHN: { 3: [{ v: 16, t: "Nota de traducción" }] },
};

jest.mock("../../assets/commentary/uW-es_tn.json", () => ({ __esModule: true, default: DB }), {
  virtual: true,
});

beforeEach(() => files.clear());

async function load() {
  jest.resetModules();
  return import("../../src/services/commentary/downloads");
}

test("lista los módulos descargables sin descargar", async () => {
  const { listDownloads } = await load();
  const infos = listDownloads();
  expect(infos.map((info) => info.module.id)).toEqual([
    "adamclarke",
    "matthewhenry",
    "jfb-u",
    "gill",
    "uW-es_tn",
  ]);
  expect(infos.every((info) => !info.downloaded)).toBe(true);
});

test("descarga copia el JSON validado y lo deja en document/commentary", async () => {
  const { downloadModule, isDownloaded } = await load();
  const info = await downloadModule("uW-es_tn");
  expect(info.downloaded).toBe(true);
  expect(isDownloaded("uW-es_tn")).toBe(true);
  expect(files.has("/doc/commentary/uW-es_tn.json")).toBe(true);
  // El temporal .part no queda atrás tras el move.
  expect(files.has("/doc/commentary/uW-es_tn.json.part")).toBe(false);
});

test("lee el capítulo descargado y lo borra", async () => {
  const { downloadModule, readDownloadedChapter, removeModule } = await load();
  await downloadModule("uW-es_tn");

  const entries = readDownloadedChapter("uW-es_tn", "JHN", 3);
  expect(entries).toEqual([
    { author: "uW-es_tn", verseStart: 16, verseEnd: 16, text: "Nota de traducción" },
  ]);

  removeModule("uW-es_tn");
  expect(readDownloadedChapter("uW-es_tn", "JHN", 3)).toBeNull();
});

test("readDownloadedChapter sin descarga devuelve null", async () => {
  const { readDownloadedChapter } = await load();
  expect(readDownloadedChapter("uW-es_tn", "JHN", 3)).toBeNull();
});

test("un módulo desconocido no se puede descargar", async () => {
  const { downloadModule, isDownloadable } = await load();
  expect(isDownloadable("no-existe")).toBe(false);
  await expect(downloadModule("no-existe")).rejects.toThrow("no descargable");
});

test("un clásico se descarga del repositorio remoto", async () => {
  const fetchMock = jest.fn(async () => ({
    ok: true,
    json: async () => ({ JHN: { 3: [{ v: 16, t: "For God so loved" }] } }),
  }));
  const previous = global.fetch;
  (global as { fetch: unknown }).fetch = fetchMock;
  try {
    const { downloadModule, isDownloadable, listDownloads } = await load();
    expect(isDownloadable("adamclarke")).toBe(true);
    expect(listDownloads().some((info) => info.module.id === "adamclarke")).toBe(true);

    const info = await downloadModule("adamclarke");
    expect(info.module.license).toBe("Dominio público");
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain("polakus368-dv/bible_lens/main/assets/commentary/adamclarke.json");
    expect(files.has("/doc/commentary/adamclarke.json")).toBe(true);
  } finally {
    (global as { fetch: unknown }).fetch = previous;
  }
});

test("una descarga remota inválida no deja archivo", async () => {
  const previous = global.fetch;
  (global as { fetch: unknown }).fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ JHN: { 3: "no es una lista" } }),
  }));
  try {
    const { downloadModule, isDownloaded } = await load();
    await expect(downloadModule("gill")).rejects.toThrow("Capítulo inválido");
    expect(isDownloaded("gill")).toBe(false);
  } finally {
    (global as { fetch: unknown }).fetch = previous;
  }
});

test("un error HTTP también falla la descarga", async () => {
  const previous = global.fetch;
  (global as { fetch: unknown }).fetch = jest.fn(async () => ({
    ok: false,
    status: 404,
    json: async () => ({}),
  }));
  try {
    const { downloadModule } = await load();
    await expect(downloadModule("gill")).rejects.toThrow("HTTP 404");
  } finally {
    (global as { fetch: unknown }).fetch = previous;
  }
});
