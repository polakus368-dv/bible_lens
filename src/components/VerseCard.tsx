import React, { memo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { VerseResult } from "../services/bible/bibleService";
import type { ParsedReference } from "../services/parser/bibleParser";
import { colors, radii } from "../theme";

type Props = {
  item: VerseResult;
  onOpenContext: (ref: ParsedReference) => void;
};

const VerseCard = memo(function VerseCard({ item, onOpenContext }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.ref}>{item.displayRef}</Text>
        <Pressable
          style={styles.contextBtn}
          onPress={() => onOpenContext(item.ref)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Ver ${item.displayRef} en contexto`}
        >
          <Text style={styles.contextText}>Contexto</Text>
        </Pressable>
      </View>
      <Text style={styles.raw} numberOfLines={1}>
        Detectado: “{item.ref.raw}”
      </Text>
      {item.verses.map((v) => (
        <Text key={v.number} style={styles.verse}>
          <Text style={styles.verseNum}>{v.number} </Text>
          {v.text}
        </Text>
      ))}
      {item.notFound ? (
        <Text style={styles.notFound}>
          No se encontró el texto para esta cita en esta versión.
        </Text>
      ) : null}
    </View>
  );
});

export default VerseCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginVertical: 5,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  ref: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  contextBtn: {
    backgroundColor: colors.shareBg,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  contextText: { fontSize: 11, fontWeight: "700", color: colors.navy },
  raw: {
    fontSize: 11,
    color: colors.faint,
    marginTop: 3,
    marginBottom: 8,
    fontStyle: "italic",
  },
  verse: {
    fontFamily: "serif",
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink,
    marginTop: 8,
  },
  verseNum: { fontWeight: "700", color: colors.navy },
  notFound: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    padding: 10,
    borderRadius: radii.sm,
    marginTop: 10,
  },
});
