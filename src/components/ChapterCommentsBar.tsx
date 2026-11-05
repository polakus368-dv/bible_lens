import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  listAuthorsForChapter,
  type CommentaryModule,
} from "../services/commentary/commentaryService";
import { colors, radii } from "../theme";
import { textPreview } from "./CommentarySheet";

export type AuthorCard = {
  module: CommentaryModule;
  count: number;
  preview: string;
  missing: boolean;
};

type Props = {
  bookId: string;
  chapter: number;
  authorIds: string[];
  onOpenAuthor: (module: CommentaryModule) => void;
};

/**
 * Carrusel «Comentarios del capítulo» al pie de la lectura: una tarjeta por
 * autor con contenido en el capítulo.
 */
export default function ChapterCommentsBar({
  bookId,
  chapter,
  authorIds,
  onOpenAuthor,
}: Props) {
  const [cards, setCards] = useState<AuthorCard[] | null>(null);
  const authorKey = authorIds.join(",");

  useEffect(() => {
    setCards(null);
    // Cargar los módulos bundleados pesa: se difiere fuera del frame de scroll.
    const timer = setTimeout(
      () => setCards(listAuthorsForChapter(bookId, chapter, authorIds)),
      0
    );
    return () => clearTimeout(timer);
  }, [bookId, chapter, authorKey]);

  if (cards === null) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.heading}>Comentarios del capítulo</Text>
        <Text style={styles.status}>Cargando comentarios…</Text>
      </View>
    );
  }

  if (cards.length === 0) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.heading}>Comentarios del capítulo</Text>
        <Text style={styles.status}>No hay comentarios para este capítulo.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Comentarios del capítulo</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {cards.map((card) => (
          <Pressable
            key={card.module.id}
            style={styles.card}
            onPress={() => onOpenAuthor(card.module)}
            accessibilityRole="button"
            accessibilityLabel={`Comentario de ${card.module.name}`}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.abbr}>{card.module.abbr}</Text>
              <Text style={styles.count}>
                {card.missing
                  ? "sin descargar"
                  : `${card.count} ${card.count === 1 ? "nota" : "notas"}`}
              </Text>
            </View>
            <Text style={[styles.preview, card.missing && styles.missing]} numberOfLines={3}>
              {card.missing
                ? `Descarga «${card.module.name}» desde ⚙ Ajustes.`
                : textPreview(card.preview, 120)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingTop: 10,
    paddingBottom: 8,
  },
  heading: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  status: {
    fontSize: 11,
    color: colors.faint,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  row: { paddingHorizontal: 12, gap: 8 },
  card: {
    width: 210,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  abbr: { fontSize: 13, fontWeight: "800", color: colors.navy },
  count: { fontSize: 10, color: colors.faint },
  preview: {
    fontFamily: "serif",
    fontSize: 12,
    lineHeight: 17,
    color: colors.ink,
  },
  missing: { fontFamily: undefined, color: colors.muted, fontStyle: "italic" },
});
