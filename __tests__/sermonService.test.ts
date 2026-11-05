/**
 * El servicio usa expo-file-system y fetch global. Se mockean ambos con un
 * sistema de archivos en memoria para probar el mapeo, el corte a MAX_HITS,
 * el TTL de caché y el fallback offline sin red.
 */

type MemFile = { content: string; exists: boolean };

const files = new Map<string, MemFile>();

function pathKey(directory: MockDirectory, name: string): string {
  return `${directory.path}/${name}`;
}

class MockFile {
  path: string;
  constructor(directory: MockDirectory | undefined, name: string) {
    this.path = directory ? pathKey(directory, name) : name;
  }
  get exists() {
    return files.get(this.path)?.exists ?? false;
  }
  get size() {
    return files.get(this.path)?.content.length ?? 0;
  }
  get parentDirectory() {
    const parts = this.path.split("/");
    return new MockDirectory(parts.slice(0, -1).join("/"));
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
}

class MockDirectory {
  path: string;
  constructor(_root: string | MockDirectory, ...parts: string[]) {
    this.path = [String(_root), ...parts].join("/");
  }
  get exists() {
    return true;
  }
  create() {}
}

jest.mock("expo-file-system", () => ({
  Paths: { document: "/doc" },
  File: MockFile,
  Directory: MockDirectory,
}));

function sermon(index: number) {
  return {
    id: `s${index}`,
    title: `Sermón ${index}`,
    speaker: "Predicador",
    duration: "30:00",
    hasTranscript: "True",
    summary: "resumen",
    url: `https://www.sermonindex.net/s/${index}`,
    txtUrl: "",
    mp3Url: "https://example.com/a.mp3",
    description: "descripción larga",
  };
}

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

function apiResponse(count: number) {
  return {
    ok: true,
    json: async () => ({
      bookId: "JHN",
      chapter: 3,
      verse: 16,
      reference: "John 3:16",
      sermonCount: 2504,
      sermons: Array.from({ length: count }, (_, i) => sermon(i)),
    }),
  };
}

// El servicio guarda el estado en módulo: se recarga en cada test.
async function loadService() {
  jest.resetModules();
  return import("../src/services/sermons/sermonService");
}

beforeEach(() => {
  files.clear();
  fetchMock.mockReset();
});

test("mapea la respuesta a un resumen mínimo y corta en MAX_HITS", async () => {
  const { searchByVerse, MAX_HITS } = await loadService();
  fetchMock.mockResolvedValue(apiResponse(150));

  const result = await searchByVerse("JHN", 3, 16);
  expect(result.sermons).toHaveLength(MAX_HITS);
  expect(result.total).toBe(2504);
  expect(result.cached).toBe(false);
  expect(result.sermons[0]).toEqual({
    id: "s0",
    title: "Sermón 0",
    speaker: "Predicador",
    duration: "30:00",
    hasTranscript: true,
    summary: "resumen",
    url: "https://www.sermonindex.net/s/0",
    txtUrl: "",
    audioUrl: "https://example.com/a.mp3",
  });
});

test("nunca guarda la respuesta cruda: la caché solo tiene los hits mapeados", async () => {
  const { searchByVerse } = await loadService();
  fetchMock.mockResolvedValue(apiResponse(5));
  await searchByVerse("JHN", 3, 16);

  const raw = files.get("/doc/sermons/JHN/3/16.json")?.content ?? "";
  expect(raw).toContain("Sermón 0");
  expect(raw).not.toContain("descripción larga");
  expect(raw).not.toContain("sermonCount");
});

test("sirve la caché dentro del TTL y no vuelve a llamar a la red", async () => {
  const { searchByVerse } = await loadService();
  fetchMock.mockResolvedValue(apiResponse(3));
  const first = await searchByVerse("JHN", 3, 16);
  const second = await searchByVerse("JHN", 3, 16);

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(second.cached).toBe(true);
  expect(second.fetchedAt).toBe(first.fetchedAt);
});

test("con forceRefresh vuelve a pedir aunque la caché sea fresca", async () => {
  const { searchByVerse } = await loadService();
  fetchMock.mockResolvedValue(apiResponse(3));
  await searchByVerse("JHN", 3, 16);
  await searchByVerse("JHN", 3, 16, { forceRefresh: true });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("cuando la caché está vencida y falla la red, la sirve marcada stale", async () => {
  const { searchByVerse } = await loadService();
  fetchMock.mockResolvedValue(apiResponse(2));
  await searchByVerse("JHN", 3, 16);

  const cacheKey = "/doc/sermons/JHN/3/16.json";
  const cached = JSON.parse(files.get(cacheKey)!.content);
  cached.fetchedAt = Date.now() - 30 * 24 * 60 * 60 * 1000;
  files.set(cacheKey, { content: JSON.stringify(cached), exists: true });

  fetchMock.mockRejectedValue(new Error("offline"));
  const result = await searchByVerse("JHN", 3, 16);
  expect(result.stale).toBe(true);
  expect(result.cached).toBe(true);
  expect(result.sermons).toHaveLength(2);
});

test("sin caché y sin red propaga el error", async () => {
  const { searchByVerse } = await loadService();
  fetchMock.mockRejectedValue(new Error("offline"));
  await expect(searchByVerse("JHN", 3, 16)).rejects.toThrow("offline");
});

test("una caché corrupta se ignora", async () => {
  const { searchByVerse } = await loadService();
  files.set("/doc/sermons/JHN/3/16.json", { content: "{no json", exists: true });
  fetchMock.mockResolvedValue(apiResponse(1));
  const result = await searchByVerse("JHN", 3, 16);
  expect(result.cached).toBe(false);
  expect(result.sermons).toHaveLength(1);
});
