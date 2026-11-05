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
import { BIBLE_VERSIONS, getBibleVersion } from "../services/bible/versions";
import {
  allAuthors,
  COMMENTARIES,
  DEFAULT_COMMENTARY_IDS,
} from "../services/commentary/commentaryService";
import {
  downloadModule,
  listDownloads,
  removeModule,
  type DownloadInfo,
} from "../services/commentary/downloads";
import { colors, radii } from "../theme";

type Props = {
  visible: boolean;
  versionId: string;
  onSelectVersion: (id: string) => void;
  commentaryAuthors: string[];
  onChangeAuthors: (ids: string[]) => void;
  onClose: () => void;
};

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function SettingsScreen({
  visible,
  versionId,
  onSelectVersion,
  commentaryAuthors,
  onChangeAuthors,
  onClose,
}: Props) {
  const [authors, setAuthors] = useState<string[]>(commentaryAuthors);
  const [downloads, setDownloads] = useState<DownloadInfo[]>([]);
  const [busyDownload, setBusyDownload] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => setAuthors(commentaryAuthors), [commentaryAuthors]);

  const refreshDownloads = () => {
    try {
      setDownloads(listDownloads());
    } catch {
      setDownloads([]);
    }
  };

  useEffect(() => {
    if (visible) refreshDownloads();
  }, [visible]);

  const handleDownload = async (id: string) => {
    setBusyDownload(id);
    setDownloadError(null);
    try {
      await downloadModule(id);
    } catch (error) {
      setDownloadError(
        error instanceof Error && /HTTP \d+/.test(error.message)
          ? `El servidor respondió ${error.message}. Inténtalo más tarde.`
          : "No se pudo descargar. Revisa la conexión e inténtalo de nuevo."
      );
    } finally {
      setBusyDownload(null);
      refreshDownloads();
    }
  };

  const handleRemove = (id: string) => {
    removeModule(id);
    refreshDownloads();
  };

  const toggleAuthor = (id: string) => {
    const next = authors.includes(id)
      ? authors.filter((entry) => entry !== id)
      : [...authors, id];
    setAuthors(next);
    onChangeAuthors(next);
  };

  const resetAuthors = () => {
    setAuthors([...DEFAULT_COMMENTARY_IDS]);
    onChangeAuthors([...DEFAULT_COMMENTARY_IDS]);
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
          accessibilityLabel="Cerrar ajustes"
        />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.title}>Ajustes</Text>
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

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.section}>Versión de la Biblia</Text>
            {BIBLE_VERSIONS.map((version) => {
              const selected = version.id === versionId;
              return (
                <Pressable
                  key={version.id}
                  style={[styles.row, selected && styles.rowActive]}
                  onPress={() => onSelectVersion(version.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={version.name}
                >
                  <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, selected && styles.activeText]}>
                      {version.name}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {version.abbr}
                      {version.isPublicDomain ? " · Dominio público" : " · © Uso personal"}
                    </Text>
                  </View>
                  <Text style={[styles.check, selected && styles.activeText]}>
                    {selected ? "✓" : ""}
                  </Text>
                </Pressable>
              );
            })}
            <Text style={styles.note}>
              {getBibleVersion(versionId).isPublicDomain
                ? "Esta versión es de dominio público y puede compartirse libremente."
                : "Esta versión tiene derechos de autor de terceros: uso personal únicamente. No redistribuir el APK que la incluye."}
            </Text>

            <Text style={styles.section}>Comentarios en el capítulo</Text>
            {allAuthors().map((module) => {
              const selected = authors.includes(module.id);
              return (
                <Pressable
                  key={module.id}
                  style={[styles.row, selected && styles.rowActive]}
                  onPress={() => toggleAuthor(module.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={module.name}
                >
                  <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, selected && styles.activeText]}>
                      {module.name}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {module.chapters
                        ? `${module.chapters} capítulos · ${formatMb(module.sizeBytes)}`
                        : "Descarga opcional"}{" "}
                      · {module.lang === "es" ? "español" : "inglés"}
                    </Text>
                  </View>
                  <Text style={[styles.check, selected && styles.activeText]}>
                    {selected ? "✓" : ""}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable style={styles.linkBtn} onPress={resetAuthors}>
              <Text style={styles.linkText}>Restablecer la selección</Text>
            </Pressable>

            <Text style={styles.section}>Descargas</Text>
            {downloads.map((info) => (
              <View key={info.module.id} style={styles.downloadCard}>
                <Text style={styles.rowTitle}>{info.module.name}</Text>
                <Text style={styles.rowMeta}>
                  {info.module.license}
                  {info.module.sizeBytes
                    ? ` · ${formatMb(info.module.sizeBytes)}`
                    : ""}{" "}
                  ·{" "}
                  {info.downloaded
                    ? `descargado (${formatMb(info.sizeBytes)})`
                    : "sin descargar"}
                </Text>
                <View style={styles.downloadActions}>
                  {info.downloaded ? (
                    <>
                      <Pressable
                        style={[styles.smallBtn, busyDownload === info.module.id && styles.disabled]}
                        onPress={() => handleDownload(info.module.id)}
                        disabled={busyDownload !== null}
                      >
                        <Text style={styles.smallBtnText}>
                          {busyDownload === info.module.id ? "Descargando…" : "Rehacer"}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.smallBtn, styles.dangerBtn]}
                        onPress={() => handleRemove(info.module.id)}
                        disabled={busyDownload !== null}
                      >
                        <Text style={[styles.smallBtnText, styles.dangerText]}>Eliminar</Text>
                      </Pressable>
                    </>
                  ) : (
                    <Pressable
                      style={[styles.smallBtn, busyDownload === info.module.id && styles.disabled]}
                      onPress={() => handleDownload(info.module.id)}
                      disabled={busyDownload !== null}
                    >
                      <Text style={styles.smallBtnText}>
                        {busyDownload === info.module.id ? "Descargando…" : "Descargar"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
            {downloadError ? (
              <Text style={styles.errorText}>{downloadError}</Text>
            ) : null}
            <Text style={styles.note}>
              Los clásicos se descargan del repositorio del proyecto (una sola vez
              por autor); las notas en español vienen incluidas en la app y aquí
              solo se activan para uso offline. Las notas de unfoldingWord están
              bajo CC BY-SA 4.0: se puede citar la fuente y el derivado mantiene la
              misma licencia.
            </Text>

            <Text style={styles.section}>Créditos y licencias</Text>
            <Text style={styles.credits}>
              Biblia: RVR1909 (dominio público / CC0). RVR1960, NVI y LBLA © sus
              respectivos titulares, incluidas solo para uso personal.
            </Text>
            <Text style={styles.credits}>
              Comentarios clásicos de {COMMENTARIES.map((m) => m.name).join(", ")}:
              dominio público, obtenidos de sermonindex.net.
            </Text>
            <Pressable
              onPress={() => Linking.openURL("https://sermonindex.net/md/copying-permissions/")}
              accessibilityRole="link"
            >
              <Text style={styles.linkText}>Permisos de sermonindex.net</Text>
            </Pressable>
          </ScrollView>
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
    maxHeight: "88%",
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
    marginBottom: 8,
  },
  title: { fontSize: 19, fontWeight: "800", color: colors.ink },
  closeBtn: {
    backgroundColor: colors.shareBg,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  closeText: { fontSize: 11, fontWeight: "700", color: colors.navy },
  section: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 18,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 6,
  },
  rowActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  rowText: { flex: 1, paddingRight: 8 },
  rowTitle: { fontSize: 14, fontWeight: "700", color: colors.ink },
  rowMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  activeText: { color: colors.accent },
  check: { fontSize: 14, fontWeight: "800", color: colors.ink, width: 16, textAlign: "center" },
  note: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
    marginTop: 6,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
  },
  downloadCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 6,
  },
  downloadActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  smallBtn: {
    backgroundColor: colors.navy,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  smallBtnText: { fontSize: 11, fontWeight: "700", color: colors.onDark },
  dangerBtn: { backgroundColor: colors.dangerBg },
  dangerText: { color: colors.danger },
  disabled: { opacity: 0.5 },
  linkBtn: { paddingVertical: 8, alignSelf: "flex-start" },
  linkText: { fontSize: 12, fontWeight: "700", color: colors.blue },
  credits: { fontSize: 11, lineHeight: 17, color: colors.muted, marginBottom: 8 },
});
