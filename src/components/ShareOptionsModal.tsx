import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { ExportFormat } from "../services/export/exportService";
import { colors, radii } from "../theme";

type Props = {
  visible: boolean;
  count: number;
  versionAbbr: string;
  busy: boolean;
  onSelect: (format: ExportFormat) => void;
  onClose: () => void;
};

const OPTIONS: Array<{ format: ExportFormat; label: string; detail: string }> = [
  {
    format: "plain",
    label: "Texto plano",
    detail: "Envía el mensaje al share sheet de Android.",
  },
  {
    format: "txt",
    label: "Archivo .txt",
    detail: "Texto estructurado con cabecera, versión y fecha.",
  },
  {
    format: "md",
    label: "Archivo .md",
    detail: "Markdown con títulos y citas en bloque.",
  },
];

export default function ShareOptionsModal({
  visible,
  count,
  versionAbbr,
  busy,
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
          <Text style={styles.title}>Compartir resultados</Text>
          <Text style={styles.subtitle}>
            {count} {count === 1 ? "cita" : "citas"} · {versionAbbr}
          </Text>
          {OPTIONS.map((option) => (
            <Pressable
              key={option.format}
              style={[styles.option, busy && styles.disabled]}
              disabled={busy}
              onPress={() => onSelect(option.format)}
            >
              <Text style={styles.label}>{option.label}</Text>
              <Text style={styles.detail}>{option.detail}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.close} onPress={onClose} disabled={busy}>
            <Text style={styles.closeText}>Cancelar</Text>
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
  },
  title: { fontSize: 18, fontWeight: "800", color: colors.ink },
  subtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
    marginBottom: 12,
  },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 10,
    backgroundColor: colors.surfaceMuted,
  },
  disabled: { opacity: 0.5 },
  label: { fontSize: 15, fontWeight: "700", color: colors.navy },
  detail: { fontSize: 12, color: colors.muted, marginTop: 2 },
  close: {
    marginTop: 4,
    backgroundColor: colors.navy,
    borderRadius: radii.md,
    padding: 12,
    alignItems: "center",
  },
  closeText: { color: colors.onDark, fontWeight: "700" },
});
