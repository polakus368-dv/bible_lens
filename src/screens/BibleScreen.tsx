import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import {
  loadChapter,
  type Chapter,
} from "../services/bible/bibleService";
import {
  BIBLE_VERSIONS,
  DEFAULT_VERSION_ID,
  getBibleVersion,
} from "../services/bible/versions";
import { BOOKS, type BookInfo } from "../services/parser/books";
import { loadSettings, saveSettings } from "../services/settings/settingsService";
import { colors, radii } from "../theme";
import VersionChip from "../components/VersionChip";
import VersionPickerModal from "../components/VersionPickerModal";
import ChapterCommentsBar from "../components/ChapterCommentsBar";
import CommentarySheet from "../components/CommentarySheet";
import {
  COMMENTARIES,
  DEFAULT_COMMENTARY_IDS,
  getChapterCommentaryAny,
  type CommentaryModule,
} from "../services/commentary/commentaryService";
import { isDownloaded } from "../services/commentary/downloads";
import BooksSheet from "./BooksSheet";
import SettingsScreen from "./SettingsScreen";
import SermonsSheet from "./SermonsSheet";

export type BibleTarget = {
  bookId: string;
  chapter: number;
  verse?: number;
};

/** Destino pedido desde el escáner; `key` remonta la vista con cada salto. */
export type BibleJump = { target: BibleTarget; key: number };

type Props = {
  jump: BibleJump | null;
  onOpenScanner: () => void;
};

type ReaderView =
  | { kind: "books" }
  | { kind: "chapters"; bookId: string }
  | { kind: "reading" };

/** Comentario abierto; sin `verses` se muestra el capítulo completo. */
type CommentarySelection = {
  module: CommentaryModule;
  verses?: number[];
};

const EMPTY_SET: ReadonlySet<number> = new Set();

/** Autor cuyo comentario abre el botón ◎ junto a cada versículo. */
const PRIMARY_AUTHOR = "adamclarke";

const CHAPTER_COLUMNS = 5;
const CHAPTER_GRID_PADDING = 12;

export default function BibleScreen({ jump, onOpenScanner }: Props) {
  const [versionId, setVersionId] = useState(DEFAULT_VERSION_ID);
  const [versionPickerOpen, setVersionPickerOpen] = useState(false);
  const [bookId, setBookId] = useState(jump?.target.bookId ?? "GEN");
  const [chapterNumber, setChapterNumber] = useState(jump?.target.chapter ?? 1);
  const [view, setView] = useState<ReaderView>(
    jump ? { kind: "reading" } : { kind: "books" }
  );
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [booksOpen, setBooksOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commentaryAuthors, setCommentaryAuthors] = useState(DEFAULT_COMMENTARY_IDS);
  const [commentary, setCommentary] = useState<CommentarySelection | null>(null);
  const [sermonVerse, setSermonVerse] = useState<number | null>(null);
  const [commentedVerses, setCommentedVerses] = useState<ReadonlySet<number>>(EMPTY_SET);
  const { width } = useWindowDimensions();

  const version = getBibleVersion(versionId);
  const cellSize = Math.floor(
    (width - CHAPTER_GRID_PADDING * 2) / CHAPTER_COLUMNS
  );

  const book = getBook(bookId);
  const versionTouchedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    loadSettings().then((settings) => {
      if (!mounted) return;
      setCommentaryAuthors(settings.commentaryAuthors);
      if (!versionTouchedRef.current) setVersionId(settings.versionId);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadChapter(bookId, chapterNumber, versionId).then((result) => {
      if (!active) return;
      setChapter(result);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [bookId, chapterNumber, versionId]);

  // Marcar los versículos con comentario de Clarke: es el autor del indicador ◎.
  useEffect(() => {
    if (view.kind !== "reading") return;
    let active = true;
    const timer = setTimeout(() => {
      if (!active) return;
      if (!isDownloaded(PRIMARY_AUTHOR)) {
        setCommentedVerses(EMPTY_SET);
        return;
      }
      const { entries } = getChapterCommentaryAny(PRIMARY_AUTHOR, bookId, chapterNumber);
      const verses = new Set<number>();
      for (const entry of entries) {
        for (let v = entry.verseStart; v <= entry.verseEnd; v++) verses.add(v);
      }
      setCommentedVerses(verses);
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [view.kind, bookId, chapterNumber, commentaryAuthors]);

  const openChapter = useCallback((nextBookId: string, nextChapter: number) => {
    const nextBook = getBook(nextBookId);
    const clamped = Math.min(Math.max(1, nextChapter), nextBook?.chapters ?? 1);
    setBookId(nextBookId);
    setChapterNumber(clamped);
    setView({ kind: "reading" });
  }, []);

  useEffect(() => {
    if (jump) openChapter(jump.target.bookId, jump.target.chapter);
  }, [jump, openChapter]);

  // Back recorre la jerarquía del lector: lectura → capítulos → libros.
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (sermonVerse !== null) {
          setSermonVerse(null);
          return true;
        }
        if (commentary) {
          setCommentary(null);
          return true;
        }
        if (versionPickerOpen) {
          setVersionPickerOpen(false);
          return true;
        }
        if (booksOpen) {
          setBooksOpen(false);
          return true;
        }
        if (settingsOpen) {
          setSettingsOpen(false);
          return true;
        }
        if (view.kind === "reading") {
          setView({ kind: "chapters", bookId });
          return true;
        }
        if (view.kind === "chapters") {
          setView({ kind: "books" });
          return true;
        }
        return false;
      }
    );
    return () => subscription.remove();
  }, [bookId, booksOpen, commentary, sermonVerse, settingsOpen, versionPickerOpen, view]);

  const openBooks = useCallback(() => setView({ kind: "books" }), []);

  const openChapters = useCallback(() => {
    setView({ kind: "chapters", bookId });
  }, [bookId]);

  const selectBook = useCallback((nextBookId: string) => {
    setView({ kind: "chapters", bookId: nextBookId });
  }, []);

  const selectChapter = useCallback(
    (nextChapter: number) => openChapter(bookId, nextChapter),
    [bookId, openChapter]
  );

  // Desde el buscador de la biblioteca: con capítulo abre la lectura; sin él,
  // muestra la grilla de capítulos del libro.
  const handlePickFromSheet = useCallback(
    (nextBookId: string, nextChapter?: number) => {
      if (nextChapter) openChapter(nextBookId, nextChapter);
      else selectBook(nextBookId);
    },
    [openChapter, selectBook]
  );

  const goToChapter = useCallback(
    (delta: number) => {
      if (!book) return;
      const next = chapterNumber + delta;
      if (next < 1 || next > book.chapters) return;
      setChapterNumber(next);
    },
    [book, chapterNumber]
  );

  const handleSelectVersion = useCallback(
    (id: string) => {
      setVersionPickerOpen(false);
      if (id === versionId) return;
      versionTouchedRef.current = true;
      setVersionId(id);
      saveSettings({ versionId: id, commentaryAuthors });
    },
    [commentaryAuthors, versionId]
  );

  const handleChangeAuthors = useCallback(
    (ids: string[]) => {
      setCommentaryAuthors(ids);
      saveSettings({ versionId, commentaryAuthors: ids });
    },
    [versionId]
  );

  const openVerseCommentary = useCallback(
    (verse: number) => {
      const module = COMMENTARIES.find((entry) => entry.id === PRIMARY_AUTHOR);
      if (module) setCommentary({ module, verses: [verse] });
    },
    []
  );

  const openVerseSermons = useCallback((verse: number) => setSermonVerse(verse), []);

  const renderVerse = useCallback(
    ({ item }: { item: Chapter["verses"][number] }) => (
      <VerseLine
        number={item.number}
        text={item.text}
        hasCommentary={commentedVerses.has(item.number)}
        onOpenCommentary={openVerseCommentary}
        onOpenSermons={openVerseSermons}
      />
    ),
    [commentedVerses, openVerseCommentary, openVerseSermons]
  );

  const keyExtractor = useCallback(
    (item: Chapter["verses"][number]) => String(item.number),
    []
  );

  const activeChapterBookId = view.kind === "chapters" ? view.bookId : bookId;
  const chapterCount = getBook(activeChapterBookId)?.chapters ?? 1;

  const renderChapterCell = useCallback(
    ({ item }: { item: ListItem }) => (
      <ChapterCell
        chapter={item as number}
        active={activeChapterBookId === bookId && item === chapterNumber}
        size={cellSize}
        onPress={selectChapter}
      />
    ),
    [activeChapterBookId, bookId, cellSize, chapterNumber, selectChapter]
  );

  const chapterKey = useCallback((item: ListItem) => `ch${item}`, []);

  const header = (
    <Header
      title={headerTitle(view, book, chapterNumber)}
      onBack={view.kind === "books" ? undefined : openBooks}
      onScan={view.kind === "books" ? undefined : onOpenScanner}
      versionAbbr={version.abbr}
      onPickVersion={() => setVersionPickerOpen(true)}
      onOpenBooks={() => setBooksOpen(true)}
      onOpenSettings={() => setSettingsOpen(true)}
    />
  );

  return (
    <View style={styles.container}>
      {header}
      {view.kind === "books" ? (
        <View style={styles.loading}>
          <Text style={styles.welcomeTitle}>Bible Lens</Text>
          <Text style={styles.empty}>Elige un libro con ☰, busca una cita o escanea una página con ⊞.</Text>
          <Pressable
            style={styles.welcomeBtn}
            onPress={() => setBooksOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Abrir todos los libros"
          >
            <Text style={styles.welcomeBtnText}>Todos los libros</Text>
          </Pressable>
        </View>
      ) : view.kind === "chapters" ? (
        <>
          <Pressable
            style={styles.crumb}
            onPress={openBooks}
            accessibilityRole="button"
            accessibilityLabel="Volver a todos los libros"
          >
            <Text style={styles.crumbText}>‹ Todos los libros</Text>
          </Pressable>
          <FlashList
            data={range(chapterCount)}
            renderItem={renderChapterCell}
            keyExtractor={chapterKey}
            numColumns={CHAPTER_COLUMNS}
            contentContainerStyle={styles.chapterGrid}
          />
        </>
      ) : (
        <>
          <ReadingNav
            onChapters={openChapters}
            onPrev={() => goToChapter(-1)}
            onNext={() => goToChapter(1)}
            canPrev={chapterNumber > 1}
            canNext={chapterNumber < (book?.chapters ?? 1)}
          />
          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.navy} />
            </View>
          ) : chapter && chapter.verses.length > 0 ? (
            <>
              <View style={styles.readingBody}>
                <FlashList
                  data={chapter.verses}
                  renderItem={renderVerse}
                  keyExtractor={keyExtractor}
                  contentContainerStyle={styles.versesList}
                />
              </View>
              <ChapterCommentsBar
                bookId={bookId}
                chapter={chapterNumber}
                authorIds={commentaryAuthors}
                onOpenAuthor={(module) =>
                  isDownloaded(module.id)
                    ? setCommentary({ module })
                    : setSettingsOpen(true)
                }
              />
            </>
          ) : (
            <Text style={styles.empty}>
              No hay texto de este capítulo en {version.abbr}.
            </Text>
          )}
        </>
      )}
      <Text style={styles.copyright}>
        {version.name}
        {version.isPublicDomain ? " · Dominio público" : " · © Uso personal"}
      </Text>
      <CommentarySheet
        visible={commentary !== null}
        module={commentary?.module ?? null}
        bookId={bookId}
        bookName={book?.displayES ?? ""}
        chapter={chapterNumber}
        verses={commentary?.verses?.length === 1 ? commentary.verses : undefined}
        onClose={() => setCommentary(null)}
        onShowChapter={
          commentary?.module
            ? () => setCommentary({ module: commentary.module })
            : undefined
        }
      />
      <VersionPickerModal
        visible={versionPickerOpen}
        versions={BIBLE_VERSIONS}
        selectedId={versionId}
        onSelect={handleSelectVersion}
        onClose={() => setVersionPickerOpen(false)}
      />
      <SermonsSheet
        visible={sermonVerse !== null}
        bookId={bookId}
        bookName={book?.displayES ?? ""}
        chapter={chapterNumber}
        verse={sermonVerse}
        onClose={() => setSermonVerse(null)}
      />
      <BooksSheet
        visible={booksOpen}
        activeBookId={bookId}
        currentChapter={chapterNumber}
        onSelect={handlePickFromSheet}
        onClose={() => setBooksOpen(false)}
      />
      <SettingsScreen
        visible={settingsOpen}
        versionId={versionId}
        onSelectVersion={handleSelectVersion}
        commentaryAuthors={commentaryAuthors}
        onChangeAuthors={handleChangeAuthors}
        onClose={() => setSettingsOpen(false)}
      />
    </View>
  );
}

type ListItem = number;

function getBook(bookId: string): BookInfo | undefined {
  return BOOKS.find((item) => item.id === bookId);
}

function range(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index + 1);
}

function headerTitle(
  view: ReaderView,
  book: BookInfo | undefined,
  chapter: number
): string {
  if (view.kind === "books") return "Biblia";
  if (view.kind === "chapters") {
    return getBook(view.bookId)?.displayES ?? "Biblia";
  }
  return `${book?.displayES ?? ""} ${chapter}`.trim();
}

function Header({
  title,
  onBack,
  onScan,
  versionAbbr,
  onPickVersion,
  onOpenBooks,
  onOpenSettings,
}: {
  title: string;
  onBack?: () => void;
  onScan?: () => void;
  versionAbbr: string;
  onPickVersion: () => void;
  onOpenBooks: () => void;
  onOpenSettings: () => void;
}) {
  const topPadding = Math.max(RNStatusBar.currentHeight ?? 0, 24) + 14;

  return (
    <View style={[styles.topBar, { paddingTop: topPadding }]}>
      {onBack ? (
        <Pressable
          style={styles.topBtn}
          onPress={onBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Volver a la biblioteca"
        >
          <Text style={styles.topBtnText}>‹</Text>
        </Pressable>
      ) : (
        <View style={styles.topBtnSpacer} />
      )}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <VersionChip abbr={versionAbbr} onPress={onPickVersion} />
      {onScan ? (
        <Pressable
          style={styles.topBtn}
          onPress={onScan}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Escanear una cita"
        >
          <Text style={styles.topBtnText}>⊞</Text>
        </Pressable>
      ) : null}
      <Pressable
        style={styles.topBtn}
        onPress={onOpenBooks}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Todos los libros"
      >
        <Text style={styles.topBtnText}>☰</Text>
      </Pressable>
      <Pressable
        style={styles.topBtn}
        onPress={onOpenSettings}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Ajustes"
      >
        <Text style={styles.topBtnText}>⚙</Text>
      </Pressable>
    </View>
  );
}

function ChapterCell({
  chapter,
  active,
  size,
  onPress,
}: {
  chapter: number;
  active: boolean;
  size: number;
  onPress: (chapter: number) => void;
}) {
  return (
    <Pressable
      style={[
        styles.chapterCell,
        { width: size, height: size },
        active && styles.chapterCellActive,
      ]}
      onPress={() => onPress(chapter)}
      accessibilityRole="button"
      accessibilityLabel={`Capítulo ${chapter}`}
    >
      <Text style={[styles.chapterText, active && styles.activeText]}>
        {chapter}
      </Text>
    </Pressable>
  );
}

function ReadingNav({
  onChapters,
  onPrev,
  onNext,
  canPrev,
  canNext,
}: {
  onChapters: () => void;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}) {
  return (
    <View style={styles.readingNav}>
      <NavButton label="Capítulos" onPress={onChapters} />
      <NavButton label="‹ Anterior" onPress={onPrev} disabled={!canPrev} />
      <NavButton label="Siguiente ›" onPress={onNext} disabled={!canNext} />
    </View>
  );
}

function NavButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.navBtn, disabled && styles.navBtnDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.navBtnText}>{label}</Text>
    </Pressable>
  );
}

const VerseLine = React.memo(function VerseLine({
  number,
  text,
  hasCommentary,
  onOpenCommentary,
  onOpenSermons,
}: {
  number: number;
  text: string;
  hasCommentary: boolean;
  onOpenCommentary: (verse: number) => void;
  onOpenSermons: (verse: number) => void;
}) {
  return (
    <View style={styles.verseWrap}>
      <Text style={styles.verse}>
        <Text style={styles.verseNum}>{number} </Text>
        {text}
      </Text>
      <View style={styles.verseActions}>
        {hasCommentary ? (
          <Pressable
            style={styles.commentBtn}
            onPress={() => onOpenCommentary(number)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Comentario del versículo ${number}`}
          >
            <Text style={styles.commentBtnText}>◎</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={styles.commentBtn}
          onPress={() => onOpenSermons(number)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Sermones del versículo ${number}`}
        >
          <Text style={[styles.commentBtnText, styles.sermonBtnText]}>▤</Text>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    // La app dibuja edge-to-edge: deja libre la barra de navegación de Android.
    paddingBottom: 48,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 8,
  },
  topBtn: {
    backgroundColor: colors.shareBg,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 40,
    alignItems: "center",
  },
  topBtnText: { fontSize: 14, fontWeight: "700", color: colors.navy },
  topBtnSpacer: { minWidth: 40 },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    color: colors.ink,
  },
  searchRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    height: 44,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.ink,
  },
  searchBtn: {
    backgroundColor: colors.navy,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  searchBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  searchError: {
    paddingHorizontal: 14,
    marginBottom: 8,
    fontSize: 11,
    color: colors.danger,
  },
  crumb: {
    alignSelf: "flex-start",
    marginHorizontal: 14,
    marginBottom: 8,
    paddingVertical: 6,
  },
  crumbText: { fontSize: 12, fontWeight: "700", color: colors.blue },
  booksList: { paddingBottom: 32, paddingHorizontal: 14 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 16,
    marginBottom: 6,
  },
  bookRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 6,
  },
  bookRowActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  bookName: { fontSize: 14, fontWeight: "600", color: colors.ink },
  bookMeta: { fontSize: 11, color: colors.faint },
  activeText: { fontWeight: "800", color: colors.accent },
  chapterGrid: {
    paddingHorizontal: CHAPTER_GRID_PADDING,
    paddingBottom: 32,
  },
  chapterCell: {
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  chapterCellActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  chapterText: { fontSize: 15, fontWeight: "700", color: colors.ink },
  readingNav: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  navBtn: {
    flex: 1,
    backgroundColor: colors.shareBg,
    borderRadius: radii.sm,
    paddingVertical: 9,
    alignItems: "center",
  },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: { fontSize: 11, fontWeight: "700", color: colors.navy },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  welcomeTitle: { fontSize: 24, fontWeight: "800", color: colors.navy, marginBottom: 6 },
  welcomeBtn: {
    marginTop: 18,
    backgroundColor: colors.navy,
    borderRadius: radii.sm,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  welcomeBtnText: { fontSize: 13, fontWeight: "700", color: colors.onDark },
  versesList: { paddingHorizontal: 16, paddingBottom: 16 },
  readingBody: { flex: 1 },
  verseWrap: { paddingVertical: 4, paddingHorizontal: 4, borderRadius: radii.sm },
  verseActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 2,
  },
  commentBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  commentBtnText: { fontSize: 13, color: colors.accent },
  sermonBtnText: { color: colors.sermon },
  verse: {
    fontFamily: "serif",
    fontSize: 16,
    lineHeight: 26,
    color: colors.ink,
  },
  verseNum: { fontWeight: "700", color: colors.navy, fontSize: 12 },
  empty: {
    flex: 1,
    textAlign: "center",
    color: colors.faint,
    marginTop: 24,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 24,
  },
  copyright: {
    textAlign: "center",
    fontSize: 10,
    color: colors.faint,
    paddingHorizontal: 16,
    paddingTop: 6,
  },
});
