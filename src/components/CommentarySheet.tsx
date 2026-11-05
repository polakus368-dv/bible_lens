import React, { useEffect, useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  getChapterCommentaryAny,
  pickForVerses,
  type CommentaryEntry,
  type CommentaryModule,
} from "../services/commentary/commentaryService";
import { colors, radii } from "../theme";

type Props = {
  visible: boolean;
  module: CommentaryModule | null;
  bookId: string;
  bookName: string;
  chapter: number;
  /** Versículos a mostrar; sin valor se muestra el capítulo completo. */
  verses?: number[];
  onClose: () => void;
  /** Solo cuando se muestran versículos: permite ampliar a todo el capítulo. */
  onShowChapter?: () => void;
};

export function verseLabel(entry: CommentaryEntry): string {
  return entry.verseStart === entry.verseEnd
    ? `v. ${entry.verseStart}`
    : `v. ${entry.verseStart}–${entry.verseEnd}`;
}

export function textPreview(text: string, length = 150): string {
  const first = text.split("\n\n")[0].replace(/\s+/g, " ").trim();
  return first.length > length ? `${first.slice(0, length - 1).trimEnd()}…` : first;
}

/** Varias notas del mismo versículo (es_tn) se leen como un solo bloque. */
export function groupByVerse(entries: CommentaryEntry[]): CommentaryEntry[] {
  const merged: CommentaryEntry[] = [];
  for (const entry of entries) {
    const previous = merged[merged.length - 1];
    if (
      previous &&
      previous.verseStart === entry.verseStart &&
      previous.verseEnd === entry.verseEnd
    ) {
      merged[merged.length - 1] = { ...previous, text: `${previous.text}\n\n${entry.text}` };
    } else {
      merged.push(entry);
    }
  }
  return merged;
}

export default function CommentarySheet({
  visible,
  module,
  bookId,
  bookName,
  chapter,
  verses,
  onClose,
  onShowChapter,
}: Props) {
  const [state, setState] = useState<{
    entries: CommentaryEntry[];
    downloaded: boolean;
  } | null>(null);

  useEffect(() => {
    setState(null);
    if (!visible || !module) return;
    // Cargar el JSON de un módulo bloquea el hilo JS un momento: se difiere
    // al siguiente tick para que el modal aparezca con su animación.
    const timer = setTimeout(() => {
      const result = getChapterCommentaryAny(module.id, bookId, chapter);
      const selected = verses ? pickForVerses(result.entries, verses) : result.entries;
      setState({ entries: groupByVerse(selected), downloaded: result.downloaded });
    }, 0);
    return () => clearTimeout(timer);
  }, [visible, module, bookId, chapter, verses]);

  if (!module) return null;

  const onlyVerse = verses?.length === 1 ? verses[0] : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar comentario"
        />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>
                {bookName} {chapter}
                {onlyVerse ? `:${onlyVerse}` : ""}
              </Text>
              <Text style={styles.meta}>
                {module.name} · {module.abbr}
              </Text>
            </View>
            <Pressable
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            >
              <Text style={styles.closeText}>Cerrar</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {state === null ? (
              <Text style={styles.empty}>Cargando…</Text>
            ) : !state.downloaded ? (
              <Text style={styles.empty}>
                «{module.name}» todavía no está descargado. Ábrelo en ⚙ Ajustes →
                Descargas para leerlo sin conexión.
              </Text>
            ) : state.entries.length === 0 ? (
              <Text style={styles.empty}>
                {module.name} no comentó {onlyVerse ? "este versículo" : "este capítulo"}.
              </Text>
            ) : (
              state.entries.map((entry, index) => (
                <View key={`${entry.verseStart}-${index}`} style={styles.entry}>
                  <Text style={styles.verseTag}>{verseLabel(entry)}</Text>
                  <Text style={styles.text}>{entry.text}</Text>
                </View>
              ))
            )}
          </ScrollView>

          {onlyVerse && onShowChapter ? (
            <Pressable
              style={styles.chapterBtn}
              onPress={onShowChapter}
              accessibilityRole="button"
              accessibilityLabel="Ver todo el capítulo"
            >
              <Text style={styles.chapterBtnText}>Ver todo el capítulo</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => Linking.openURL(module.sourceUrl)}
            accessibilityRole="link"
            accessibilityLabel="Ver la fuente"
          >
            <Text style={styles.license}>
              {module.license === "cc-by-sa"
                ? "unfoldingWord · CC BY-SA 4.0"
                : "Dominio público · vía sermonindex.net"}
            </Text>
          </Pressable>
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
    paddingHorizontal: 20,
    paddingTop: 10,
    // Edge-to-edge: deja libre la barra de navegación de Android.
    paddingBottom: 48,
    maxHeight: "82%",
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
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerText: { flex: 1 },
  title: { fontSize: 19, fontWeight: "800", color: colors.ink },
  meta: { fontSize: 11, color: colors.muted, marginTop: 3 },
  closeBtn: {
    backgroundColor: colors.shareBg,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  closeText: { fontSize: 11, fontWeight: "700", color: colors.navy },
  body: { flexShrink: 1, marginTop: 12 },
  bodyContent: { paddingBottom: 8 },
  entry: { marginBottom: 16 },
  verseTag: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.accent,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  text: {
    fontFamily: "serif",
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink,
  },
  empty: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
    fontStyle: "italic",
    paddingVertical: 16,
  },
  chapterBtn: {
    marginTop: 10,
    backgroundColor: colors.navy,
    borderRadius: radii.sm,
    paddingVertical: 11,
    alignItems: "center",
  },
  chapterBtnText: { fontSize: 12, fontWeight: "700", color: colors.onDark },
  license: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 10,
    color: colors.faint,
  },
});
