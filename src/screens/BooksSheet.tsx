import React, { useCallback, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { resolveBookQuery } from "../services/bible/bibleService";
import { BOOKS, type BookInfo } from "../services/parser/books";
import { colors, radii } from "../theme";

type Props = {
  visible: boolean;
  activeBookId: string;
  /** Capítulo actual, usado para resolver variantes cortas ("Jn 3:16"). */
  currentChapter: number;
  onSelect: (bookId: string, chapter?: number) => void;
  onClose: () => void;
};

const OLD_TESTAMENT_COUNT = 39;

type BookListItem =
  | { key: string; kind: "section"; label: string }
  | { key: string; kind: "book"; book: BookInfo };

const ITEMS: BookListItem[] = [
  { key: "header-at", kind: "section", label: "Antiguo Testamento" },
  ...BOOKS.slice(0, OLD_TESTAMENT_COUNT).map(toItem),
  { key: "header-nt", kind: "section", label: "Nuevo Testamento" },
  ...BOOKS.slice(OLD_TESTAMENT_COUNT).map(toItem),
];

function toItem(book: BookInfo): BookListItem {
  return { key: book.id, kind: "book", book };
}

function filterText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .trim();
}

export default function BooksSheet({
  visible,
  activeBookId,
  currentChapter,
  onSelect,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState(false);

  const close = useCallback(() => {
    setQuery("");
    setError(false);
    onClose();
  }, [onClose]);

  const items = useMemo<BookListItem[]>(() => {
    const needle = filterText(query);
    if (!needle) return ITEMS;
    const matches = (book: BookInfo): boolean =>
      filterText(book.displayES).includes(needle) ||
      book.names.some((name) => name.startsWith(needle));
    if (!BOOKS.some(matches)) return ITEMS;
    const result: BookListItem[] = [];
    let section: BookListItem | null = null;
    for (const item of ITEMS) {
      if (item.kind === "section") section = item;
      else if (matches(item.book)) {
        if (section) result.push(section);
        section = null;
        result.push(item);
      }
    }
    return result;
  }, [query]);

  const handleSubmit = useCallback(() => {
    const match = resolveBookQuery(query, currentChapter);
    if (!match) {
      setError(true);
      return;
    }
    setQuery("");
    setError(false);
    onSelect(match.bookId, match.chapter);
    onClose();
  }, [currentChapter, onClose, onSelect, query]);

  const handleSelectBook = useCallback(
    (bookId: string) => {
      onSelect(bookId);
      onClose();
    },
    [onClose, onSelect]
  );

  const renderItem = useCallback(
    ({ item }: { item: BookListItem }) =>
      item.kind === "section" ? (
        <Text style={styles.sectionLabel}>{item.label}</Text>
      ) : (
        <Pressable
          style={[styles.row, item.book.id === activeBookId && styles.rowActive]}
          onPress={() => handleSelectBook(item.book.id)}
          accessibilityRole="button"
          accessibilityLabel={`Abrir ${item.book.displayES}`}
        >
          <Text
            style={[styles.name, item.book.id === activeBookId && styles.activeText]}
          >
            {item.book.displayES}
          </Text>
          <Text style={styles.meta}>{item.book.chapters} cap.</Text>
        </Pressable>
      ),
    [activeBookId, handleSelectBook]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Cerrar biblioteca"
        />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.title}>Todos los libros</Text>
            <Pressable
              style={styles.closeBtn}
              onPress={close}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            >
              <Text style={styles.closeText}>Cerrar</Text>
            </Pressable>
          </View>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={(value) => {
                setQuery(value);
                setError(false);
              }}
              onSubmitEditing={handleSubmit}
              placeholder="Buscar: «Jn 3:16», «Salmos 23», «1 Cor»"
              placeholderTextColor={colors.faint}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            <Pressable
              style={styles.searchBtn}
              onPress={handleSubmit}
              accessibilityRole="button"
              accessibilityLabel="Buscar"
            >
              <Text style={styles.searchBtnText}>Ir</Text>
            </Pressable>
          </View>
          {error ? (
            <Text style={styles.searchError}>
              No se reconoce ese libro. Prueba «Juan», «Sal 23» o «Jn 3:16».
            </Text>
          ) : null}
          <FlashList
            data={items}
            renderItem={renderItem}
            keyExtractor={(item: BookListItem) => item.key}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: 16,
    paddingTop: 10,
    // Edge-to-edge: deja libre la barra de navegación de Android.
    paddingBottom: 48,
    height: "88%",
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: "center",
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: { fontSize: 19, fontWeight: "800", color: colors.ink },
  closeBtn: {
    backgroundColor: colors.shareBg,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  closeText: { fontSize: 11, fontWeight: "700", color: colors.navy },
  searchRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
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
  searchBtnText: { color: colors.onDark, fontWeight: "700", fontSize: 13 },
  searchError: { fontSize: 11, color: colors.danger, marginBottom: 8 },
  list: { paddingBottom: 16 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 16,
    marginBottom: 6,
  },
  row: {
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
  rowActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  name: { fontSize: 14, fontWeight: "600", color: colors.ink },
  activeText: { fontWeight: "800", color: colors.accent },
  meta: { fontSize: 11, color: colors.faint },
});
