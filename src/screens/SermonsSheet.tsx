import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  MAX_HITS,
  searchByVerse,
  type SermonVerseResult,
} from "../services/sermons/sermonService";
import { colors, radii } from "../theme";

type Props = {
  visible: boolean;
  bookId: string;
  bookName: string;
  chapter: number;
  verse: number | null;
  onClose: () => void;
};

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; result: SermonVerseResult }
  | { kind: "error" };

export default function SermonsSheet({
  visible,
  bookId,
  bookName,
  chapter,
  verse,
  onClose,
}: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });

  const load = useCallback(
    (forceRefresh: boolean) => {
      if (verse === null) return;
      setState({ kind: "loading" });
      searchByVerse(bookId, chapter, verse, { forceRefresh })
        .then((result) => setState({ kind: "ready", result }))
        .catch(() => setState({ kind: "error" }));
    },
    [bookId, chapter, verse]
  );

  useEffect(() => {
    if (visible) load(false);
    else setState({ kind: "idle" });
  }, [visible, load]);

  const openLink = (url: string) => {
    if (url) Linking.openURL(url);
  };

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
          accessibilityLabel="Cerrar sermones"
        />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>
                Sermones · {bookName} {chapter}
                {verse !== null ? `:${verse}` : ""}
              </Text>
              <Text style={styles.meta}>
                En inglés, cortesía de sermonindex.net · uso personal y ministerial
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

          {state.kind === "loading" ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.navy} />
              <Text style={styles.status}>Buscando sermones…</Text>
            </View>
          ) : state.kind === "error" ? (
            <View style={styles.center}>
              <Text style={styles.status}>
                No se pudieron cargar los sermones. Revisa la conexión.
              </Text>
              <Pressable style={styles.retryBtn} onPress={() => load(false)}>
                <Text style={styles.retryText}>Reintentar</Text>
              </Pressable>
            </View>
          ) : state.kind === "ready" ? (
            <ReadyBody result={state.result} onOpen={openLink} onRefresh={() => load(true)} />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function ReadyBody({
  result,
  onOpen,
  onRefresh,
}: {
  result: SermonVerseResult;
  onOpen: (url: string) => void;
  onRefresh: () => void;
}) {
  return (
    <>
      <View style={styles.summaryRow}>
        <Text style={styles.summary}>
          {result.total.toLocaleString("es")} sermones relacionados
          {result.total > MAX_HITS ? ` · se muestran los primeros ${MAX_HITS}` : ""}
        </Text>
        <Pressable onPress={onRefresh} hitSlop={8}>
          <Text style={styles.refresh}>
            {result.cached ? (result.stale ? "Caché vencida · actualizar" : "Desde caché") : "Actualizar"}
          </Text>
        </Pressable>
      </View>
      {result.sermons.length === 0 ? (
        <Text style={styles.status}>No hay sermones para este versículo.</Text>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {result.sermons.map((sermon) => (
            <View key={sermon.id} style={styles.card}>
              <Text style={styles.sermonTitle}>{sermon.title}</Text>
              <Text style={styles.sermonMeta}>
                {sermon.speaker}
                {sermon.duration ? ` · ${sermon.duration}` : ""}
                {sermon.hasTranscript ? " · con transcripción" : ""}
              </Text>
              {sermon.summary ? (
                <Text style={styles.sermonSummary} numberOfLines={3}>
                  {sermon.summary}
                </Text>
              ) : null}
              <View style={styles.actions}>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => onOpen(sermon.url)}
                  accessibilityRole="link"
                >
                  <Text style={styles.actionText}>Ver en sermonindex</Text>
                </Pressable>
                {sermon.audioUrl ? (
                  <Pressable
                    style={[styles.actionBtn, styles.audioBtn]}
                    onPress={() => onOpen(sermon.audioUrl)}
                    accessibilityRole="link"
                  >
                    <Text style={styles.actionText}>Escuchar</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </>
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
    height: "86%",
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: "center",
    marginBottom: 12,
  },
  header: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  headerText: { flex: 1 },
  title: { fontSize: 18, fontWeight: "800", color: colors.ink },
  meta: { fontSize: 11, color: colors.muted, marginTop: 3, lineHeight: 15 },
  closeBtn: {
    backgroundColor: colors.shareBg,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  closeText: { fontSize: 11, fontWeight: "700", color: colors.navy },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  status: { fontSize: 12, color: colors.muted, textAlign: "center", paddingHorizontal: 24 },
  retryBtn: {
    backgroundColor: colors.navy,
    borderRadius: radii.sm,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  retryText: { fontSize: 12, fontWeight: "700", color: colors.onDark },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 8,
    gap: 8,
  },
  summary: { flex: 1, fontSize: 11, color: colors.muted },
  refresh: { fontSize: 11, fontWeight: "700", color: colors.sermon },
  list: { flex: 1 },
  listContent: { paddingBottom: 16 },
  card: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
  },
  sermonTitle: { fontSize: 14, fontWeight: "700", color: colors.ink },
  sermonMeta: { fontSize: 11, color: colors.sermon, marginTop: 2 },
  sermonSummary: { fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 6 },
  actions: { flexDirection: "row", gap: 8, marginTop: 10 },
  actionBtn: {
    backgroundColor: colors.navy,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  audioBtn: { backgroundColor: colors.sermon },
  actionText: { fontSize: 11, fontWeight: "700", color: colors.onDark },
});
