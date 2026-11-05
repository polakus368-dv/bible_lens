import React, { memo, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  formatReference,
  type CitationSpan,
} from "../services/parser/bibleParser";
import { colors, radii } from "../theme";

type Props = {
  text: string;
  spans: CitationSpan[];
  resultsCount: number;
  editing: boolean;
  expanded: boolean;
  loading: boolean;
  hint: string;
  height: number;
  /** En edición el panel ocupa todo el alto disponible. */
  fill?: boolean;
  onChangeText: (text: string) => void;
  onToggleEdit: () => void;
  onCancelEdit: () => void;
  onToggleExpand: () => void;
  onAnalyze: () => void;
  onSelectSpan: (span: CitationSpan) => void;
};

const HighlightedText = memo(function HighlightedText({
  text,
  spans,
  onSelectSpan,
}: {
  text: string;
  spans: CitationSpan[];
  onSelectSpan: (span: CitationSpan) => void;
}) {
  const parts = useMemo(() => {
    const ordered = [...spans].sort((a, b) => a.start - b.start);
    const nodes: React.ReactNode[] = [];
    let cursor = 0;

    for (const span of ordered) {
      if (
        span.start < cursor ||
        span.end > text.length ||
        span.start >= span.end
      ) {
        continue;
      }

      if (span.start > cursor) {
        nodes.push(
          <Text key={`plain-${cursor}`}>{text.slice(cursor, span.start)}</Text>
        );
      }

      const label = formatReference(span.ref, "es");
      nodes.push(
        <Text
          key={`citation-${span.start}-${span.end}`}
          style={styles.citation}
          onPress={() => onSelectSpan(span)}
          accessibilityRole="button"
          accessibilityLabel={`Ver ${label}`}
        >
          {text.slice(span.start, span.end)}
        </Text>
      );
      cursor = span.end;
    }

    if (cursor < text.length) {
      nodes.push(<Text key={`plain-${cursor}`}>{text.slice(cursor)}</Text>);
    }

    return nodes;
  }, [text, spans, onSelectSpan]);

  return <Text style={styles.bodyText}>{parts}</Text>;
});

export default function RecognizedTextPanel({
  text,
  spans,
  resultsCount,
  editing,
  expanded,
  loading,
  hint,
  height,
  fill = false,
  onChangeText,
  onToggleEdit,
  onCancelEdit,
  onToggleExpand,
  onAnalyze,
  onSelectSpan,
}: Props) {
  const showLoading = loading && !text.trim();
  const canAnalyze = text.trim().length > 0 && !loading;

  return (
    <View style={[styles.panel, fill ? styles.fill : { height }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Texto reconocido</Text>
          {!editing && loading ? (
            <ActivityIndicator size="small" color={colors.muted} />
          ) : !editing && resultsCount > 0 ? (
            <View style={styles.countPill}>
              <Text style={styles.countText}>
                {resultsCount} {resultsCount === 1 ? "cita" : "citas"}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.headerActions}>
          {editing ? (
            <Pressable
              onPress={onCancelEdit}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Cancelar edición"
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                onPress={onToggleEdit}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Editar texto reconocido"
              >
                <Text style={styles.editText}>Editar</Text>
              </Pressable>
              <Pressable
                onPress={onToggleExpand}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={
                  expanded ? "Contraer panel de texto" : "Expandir panel de texto"
                }
              >
                <Text style={styles.expandText}>
                  {expanded ? "Contraer" : "Expandir"}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      {editing ? (
        <TextInput
          style={styles.input}
          multiline
          autoFocus
          value={text}
          onChangeText={onChangeText}
          placeholder="Pega aquí el texto o usa el escáner…"
          placeholderTextColor={colors.faint}
          textAlignVertical="top"
          selectionColor={colors.accent}
          scrollEnabled
        />
      ) : showLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.navy} />
          <Text style={styles.loadingText}>Leyendo la imagen…</Text>
        </View>
      ) : text.trim() ? (
        <>
          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            <HighlightedText
              text={text}
              spans={spans}
              onSelectSpan={onSelectSpan}
            />
          </ScrollView>
          {spans.length > 0 ? (
            <View style={styles.captionRow}>
              <View style={styles.captionDot} />
              <Text style={styles.caption}>
                Toca una cita resaltada para ver su texto.
              </Text>
            </View>
          ) : null}
        </>
      ) : (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>
            Escanea una página o pega una cita
          </Text>
          <Text style={styles.emptyText}>
            Ej. Jn 3:16 · Gén 1:1 · 1 Cor 13:4-7
          </Text>
        </View>
      )}

      {editing ? (
        <View style={styles.footer}>
          <Pressable
            style={[styles.analyzeBtn, !canAnalyze && styles.disabled]}
            onPress={onAnalyze}
            disabled={!canAnalyze}
            accessibilityRole="button"
            accessibilityLabel="Analizar texto"
          >
            {loading ? (
              <View style={styles.analyzeBusy}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.analyzeText}>Analizando…</Text>
              </View>
            ) : (
              <Text style={styles.analyzeText}>Analizar texto</Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 12,
    overflow: "hidden",
  },
  fill: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  title: { fontSize: 13, fontWeight: "700", color: colors.ink },
  countPill: {
    backgroundColor: colors.shareBg,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  countText: { fontSize: 10, fontWeight: "700", color: colors.blue },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  editText: { fontSize: 12, fontWeight: "700", color: colors.accent },
  expandText: { fontSize: 12, fontWeight: "600", color: colors.muted },
  cancelText: { fontSize: 12, fontWeight: "700", color: colors.muted },
  hint: {
    backgroundColor: colors.warningBg,
    color: colors.warningText,
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: radii.sm,
  },
  bodyScroll: { flex: 1 },
  bodyContent: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 },
  bodyText: {
    fontFamily: "serif",
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink,
  },
  citation: {
    backgroundColor: colors.highlight,
    color: colors.highlightText,
    fontWeight: "600",
  },
  captionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 10,
    paddingTop: 2,
  },
  captionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#f2c94c",
  },
  caption: { fontSize: 11, color: colors.muted, flexShrink: 1 },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: { fontSize: 12, color: colors.muted },
  emptyBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 4,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
    textAlign: "center",
  },
  emptyText: { fontSize: 11, color: colors.faint, textAlign: "center" },
  footer: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  analyzeBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  analyzeBusy: { flexDirection: "row", alignItems: "center", gap: 8 },
  analyzeText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  disabled: { opacity: 0.5 },
});
