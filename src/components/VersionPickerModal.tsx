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

type Props = {
  visible: boolean;
  versions: BibleVersion[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
};

export default function VersionPickerModal({
  visible,
  versions,
  selectedId,
  onSelect,
  onClose,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Versión bíblica</Text>
          <ScrollView style={styles.list}>
            {versions.map((version) => {
              const selected = version.id === selectedId;
              return (
                <Pressable
                  key={version.id}
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() => onSelect(version.id)}
                >
                  <View style={styles.optionHead}>
                    <Text style={styles.abbr}>{version.abbr}</Text>
                    {selected ? <Text style={styles.check}>✓</Text> : null}
                  </View>
                  <Text style={styles.name}>{version.name}</Text>
                  <Text style={styles.license}>
                    {version.isPublicDomain
                      ? "Dominio público"
                      : "© Con copyright · uso personal"}
                  </Text>
                  <Text style={styles.copyright}>{version.copyright}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={styles.footer}>
            Las versiones con copyright se incluyen para uso personal; el aviso
            se muestra en el selector y en cada exportación.
          </Text>
          <Pressable style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>Cerrar</Text>
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
    justifyContent: "center",
    padding: 16,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 16,
    maxHeight: "88%",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: 12,
  },
  list: { flexGrow: 0 },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 10,
    backgroundColor: colors.surfaceMuted,
  },
  optionSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  optionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  abbr: { fontSize: 15, fontWeight: "800", color: colors.navy },
  check: { fontSize: 16, fontWeight: "800", color: colors.accent },
  name: { fontSize: 13, color: colors.ink, marginTop: 2 },
  license: { fontSize: 11, color: colors.muted, marginTop: 4 },
  copyright: {
    fontSize: 10,
    color: colors.faint,
    marginTop: 4,
    lineHeight: 14,
  },
  footer: { fontSize: 11, color: colors.muted, marginTop: 4, lineHeight: 15 },
  close: {
    marginTop: 12,
    backgroundColor: colors.navy,
    borderRadius: radii.md,
    padding: 12,
    alignItems: "center",
  },
  closeText: { color: colors.onDark, fontWeight: "700" },
});
