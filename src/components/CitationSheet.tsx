import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { BibleVersion } from "../services/bible/versions";
import { colors, radii } from "../theme";

export type CitationPreview = {
  displayRef: string;
  raw: string;
  verses: Array<{ number: number; text: string }>;
  notFound: boolean;
};

type Props = {
  visible: boolean;
  citation: CitationPreview | null;
  version: BibleVersion;
  onClose: () => void;
  onOpenContext?: () => void;
};

export default function CitationSheet({
  visible,
  citation,
  version,
  onClose,
  onOpenContext,
}: Props) {
  if (!citation) return null;

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
          accessibilityLabel="Cerrar cita"
        />
        <View
          style={styles.sheet}
          accessibilityViewIsModal
          accessibilityLabel={`Cita ${citation.displayRef}`}
        >
          <View style={styles.grabber} />

          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.ref}>{citation.displayRef}</Text>
              <Text style={styles.meta}>
                {version.abbr} · {version.name}
                {version.isPublicDomain ? "" : " · © Uso personal"}
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

          {citation.raw.trim() &&
          citation.raw.trim() !== citation.displayRef ? (
            <Text style={styles.raw}>Detectado: “{citation.raw.trim()}”</Text>
          ) : null}

          {citation.notFound ? (
            <Text style={styles.notFound}>
              No se encontró el texto de esta cita en {version.abbr}.
            </Text>
          ) : (
            <ScrollView
              style={styles.verses}
              contentContainerStyle={styles.versesContent}
              showsVerticalScrollIndicator={false}
            >
              {citation.verses.map((verse) => (
                <Text key={verse.number} style={styles.verse}>
                  <Text style={styles.verseNum}>{verse.number} </Text>
                  {verse.text}
                </Text>
              ))}
            </ScrollView>
          )}

          {onOpenContext ? (
            <Pressable
              style={styles.contextBtn}
              onPress={onOpenContext}
              accessibilityRole="button"
              accessibilityLabel={`Ver ${citation.displayRef} en contexto`}
            >
              <Text style={styles.contextText}>Ver capítulo completo</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: 20,
    paddingTop: 10,
    // Igual que la pantalla principal, el modal dibuja bajo la barra de Android.
    paddingBottom: 48,
    maxHeight: "78%",
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
  ref: { fontSize: 19, fontWeight: "800", color: colors.ink },
  meta: { fontSize: 11, color: colors.muted, marginTop: 3, lineHeight: 16 },
  closeBtn: {
    backgroundColor: colors.shareBg,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  closeText: { fontSize: 11, fontWeight: "700", color: colors.navy },
  raw: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
    fontStyle: "italic",
    marginTop: 10,
  },
  verses: { flexShrink: 1, marginTop: 12 },
  versesContent: { paddingBottom: 4 },
  verse: {
    fontFamily: "serif",
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink,
    marginBottom: 10,
  },
  verseNum: { fontWeight: "700", color: colors.navy },
  contextBtn: {
    marginTop: 12,
    backgroundColor: colors.navy,
    borderRadius: radii.sm,
    paddingVertical: 11,
    alignItems: "center",
  },
  contextText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  notFound: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    padding: 12,
    borderRadius: radii.sm,
    marginTop: 14,
  },
});
