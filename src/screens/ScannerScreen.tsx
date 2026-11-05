import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { FlashList } from "@shopify/flash-list";
import CitationSheet, { type CitationPreview } from "../components/CitationSheet";
import RecognizedTextPanel from "../components/RecognizedTextPanel";
import ShareOptionsModal from "../components/ShareOptionsModal";
import VerseCard from "../components/VerseCard";
import VersionChip from "../components/VersionChip";
import VersionPickerModal from "../components/VersionPickerModal";
import type { BibleTarget } from "./BibleScreen";
import { getVerses, type VerseResult } from "../services/bible/bibleService";
import { filterVersesByRanges } from "../services/bible/verseRanges";
import {
  BIBLE_VERSIONS,
  DEFAULT_VERSION_ID,
  getBibleVersion,
} from "../services/bible/versions";
import type { ExportFormat } from "../services/export/exportService";
import { shareExportFile, sharePlainText } from "../services/export/shareExport";
import { isOcrAvailable, recognizeText } from "../services/ocr/ocrService";
import {
  formatReference,
  parseReferences,
  parseReferenceSpans,
  type CitationSpan,
  type ParsedReference,
} from "../services/parser/bibleParser";
import {
  isDocumentScannerAvailable,
  scanDocument,
} from "../services/scanner/documentScanner";
import { loadSettings, saveSettings } from "../services/settings/settingsService";
import { colors, radii } from "../theme";

type Props = {
  /** Vuelve al lector sin perder la foto, el OCR ni los resultados. */
  onClose: () => void;
  onOpenBible: (
    versionId: string,
    target: BibleTarget,
    fromAnalysis: boolean
  ) => void;
};

export default function ScannerScreen({ onClose, onOpenBible }: Props) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [spans, setSpans] = useState<CitationSpan[]>([]);
  const [results, setResults] = useState<VerseResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [hint, setHint] = useState("");
  const [versionId, setVersionId] = useState(DEFAULT_VERSION_ID);
  const [versionPickerOpen, setVersionPickerOpen] = useState(false);
  const [shareOptionsOpen, setShareOptionsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedSpan, setSelectedSpan] = useState<CitationSpan | null>(null);
  const [citationVisible, setCitationVisible] = useState(false);

  // Los callbacks memorizados (escaneo/foto) leen siempre la versión vigente.
  const versionIdRef = useRef(DEFAULT_VERSION_ID);
  const versionTouchedRef = useRef(false);
  const resultsRef = useRef<VerseResult[]>([]);
  const analyzedTextRef = useRef("");

  const version = getBibleVersion(versionId);
  const ocrAvailable = useMemo(() => isOcrAvailable(), []);
  const { height } = useWindowDimensions();

  const applyResults = useCallback((next: VerseResult[]) => {
    resultsRef.current = next;
    setResults(next);
  }, []);

  useEffect(() => {
    let mounted = true;
    loadSettings().then((settings) => {
      if (!mounted || versionTouchedRef.current) return;
      versionIdRef.current = settings.versionId;
      setVersionId(settings.versionId);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Back sale de la edición; sin edición, cierra el escáner y vuelve al lector.
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (editing) {
          setOcrText(analyzedTextRef.current);
          setEditing(false);
          setExpanded(false);
        } else if (!citationVisible) {
          onClose();
        }
        return true;
      }
    );
    return () => subscription.remove();
  }, [citationVisible, editing, onClose]);

  const handleNewImage = useCallback(
    (uri: string) => {
      setHint("");
      setSelectedSpan(null);
      setCitationVisible(false);
      setEditing(false);
      setExpanded(false);
      setOcrText("");
      analyzedTextRef.current = "";
      setSpans([]);
      applyResults([]);
      setImageUri(uri);
    },
    [applyResults]
  );

  const runAnalysis = useCallback(
    async (text: string) => {
      setLoading(true);
      try {
        const refs = parseReferences(text);
        analyzedTextRef.current = text;
        setSpans(parseReferenceSpans(text));
        setSelectedSpan(null);
        setCitationVisible(false);
        applyResults([]);

        if (refs.length === 0) {
          setHint(
            "No se detectaron citas. Prueba formatos como Jn 3:16, Gén 1:1 o 1 Cor 13:4-7."
          );
          setEditing(true);
          setExpanded(true);
          return;
        }

        const verses = await getVerses(refs, "es", versionIdRef.current);
        applyResults(verses);
        setHint("");
        setEditing(false);
        setExpanded(false);
      } catch (e: any) {
        setHint("No se pudieron analizar las citas. Inténtalo de nuevo.");
        Alert.alert("Error al analizar", e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    },
    [applyResults]
  );

  const analyze = useCallback(
    async (uri: string, manualText?: string) => {
      let text = manualText ?? "";

      if (!manualText) {
        try {
          const ocr = await recognizeText(uri);
          text = ocr.text;
          if (!text.trim()) {
            const message = isOcrAvailable()
              ? "No se detectó texto. Intenta con mejor iluminación."
              : "OCR no disponible en Expo Go. Pega el texto manualmente o usa el build nativo.";
            setHint(message);
            setOcrText("");
            analyzedTextRef.current = "";
            setSpans([]);
            applyResults([]);
            setEditing(true);
            setExpanded(true);
            setSelectedSpan(null);
            setCitationVisible(false);
            return;
          }
        } catch (e: any) {
          setHint("No se pudo leer la imagen. Inténtalo de nuevo.");
          Alert.alert("Error de OCR", e?.message ?? String(e));
          return;
        }
      }

      setOcrText(text);
      await runAnalysis(text);
    },
    [applyResults, runAnalysis]
  );

  const pickImage = useCallback(
    async (useCamera: boolean) => {
      try {
        if (useCamera) {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert("Permiso requerido", "Necesitas permitir la cámara.");
            return;
          }
          const res = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            quality: 0.9,
          });
          if (!res.canceled && res.assets[0]) {
            handleNewImage(res.assets[0].uri);
            await analyze(res.assets[0].uri);
          }
        } else {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            Alert.alert(
              "Permiso requerido",
              "Necesitas permitir acceso a galería."
            );
            return;
          }
          const res = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            quality: 0.9,
          });
          if (!res.canceled && res.assets[0]) {
            handleNewImage(res.assets[0].uri);
            await analyze(res.assets[0].uri);
          }
        }
      } catch (e: any) {
        Alert.alert("Error", e?.message ?? String(e));
      }
    },
    [analyze, handleNewImage]
  );

  const handleScan = useCallback(async () => {
    if (!isDocumentScannerAvailable()) {
      Alert.alert("Escáner no disponible", "Puedes tomar una foto normal.", [
        { text: "Cancelar", style: "cancel" },
        { text: "Usar cámara", onPress: () => pickImage(true) },
      ]);
      return;
    }

    try {
      setScanning(true);
      const uri = await scanDocument();
      if (!uri) return; // el usuario canceló el escáner: conservar resultados
      handleNewImage(uri);
      await analyze(uri);
    } catch (e: any) {
      Alert.alert("No se pudo escanear", e?.message ?? String(e), [
        { text: "Cancelar", style: "cancel" },
        { text: "Usar cámara", onPress: () => pickImage(true) },
      ]);
    } finally {
      setScanning(false);
    }
  }, [analyze, handleNewImage, pickImage]);

  const onManualAnalyze = useCallback(async () => {
    if (!ocrText.trim()) {
      Alert.alert(
        "Pega texto",
        "Pega el texto con citas para analizar (ej: Ver Jn 3:16 y Sal 23,1)"
      );
      return;
    }
    await analyze(imageUri ?? `mock:${ocrText}`, ocrText);
  }, [analyze, imageUri, ocrText]);

  const handleSelectVersion = useCallback(
    async (id: string) => {
      setVersionPickerOpen(false);
      setSelectedSpan(null);
      setCitationVisible(false);
      versionTouchedRef.current = true;
      if (id === versionIdRef.current) return;

      versionIdRef.current = id;
      setVersionId(id);
      await saveSettings({ versionId: id });

      const refs = resultsRef.current.map((result) => result.ref);
      if (refs.length === 0) return;

      setLoading(true);
      try {
        applyResults(await getVerses(refs, "es", id));
      } catch (e: any) {
        Alert.alert("Error al cambiar de versión", e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    },
    [applyResults]
  );

  const handleShare = useCallback(async (format: ExportFormat) => {
    setShareOptionsOpen(false);
    const currentResults = resultsRef.current;
    if (currentResults.length === 0) return;

    const selectedVersion = getBibleVersion(versionIdRef.current);
    setExporting(true);
    try {
      if (format === "plain") {
        await sharePlainText(currentResults, selectedVersion);
      } else {
        await shareExportFile(format, currentResults, selectedVersion);
      }
    } catch (e: any) {
      Alert.alert("No se pudo compartir", e?.message ?? String(e));
    } finally {
      setExporting(false);
    }
  }, []);

  const handleOpenContext = useCallback(
    (ref: ParsedReference) => {
      setCitationVisible(false);
      onOpenBible(
        versionIdRef.current,
        {
          bookId: ref.bookId,
          chapter: ref.chapter,
          verse: ref.verseRanges[0]?.start,
        },
        true
      );
      onClose();
    },
    [onClose, onOpenBible]
  );

  const handleSelectSpan = useCallback((span: CitationSpan) => {
    setSelectedSpan(span);
    setCitationVisible(true);
  }, []);

  const closeCitation = useCallback(() => {
    setCitationVisible(false);
  }, []);

  const handleToggleEdit = useCallback(() => {
    setSelectedSpan(null);
    setCitationVisible(false);
    setEditing(true);
    setExpanded(true);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setOcrText(analyzedTextRef.current);
    setEditing(false);
    setExpanded(false);
  }, []);

  const handleToggleExpand = useCallback(() => {
    setExpanded((current) => !current);
  }, []);

  const panelHeight = useMemo(() => {
    const target = expanded ? height * 0.58 : height * 0.34;
    const max = Math.max(240, height - 340);
    return Math.round(Math.min(Math.max(target, 190), max));
  }, [expanded, height]);

  const visibleSpans = useMemo(() => {
    if (spans.length === 0 || results.length === 0) return [];
    const keys = new Set(
      results.map((result) => `${result.ref.bookId} ${result.ref.chapter}`)
    );
    return spans.filter((span) => keys.has(span.key));
  }, [results, spans]);

  const citation = useMemo<CitationPreview | null>(() => {
    if (!selectedSpan) return null;

    const result = results.find(
      (item) =>
        item.ref.bookId === selectedSpan.ref.bookId &&
        item.ref.chapter === selectedSpan.ref.chapter
    );
    const verses = result
      ? filterVersesByRanges(result.verses, selectedSpan.ref.verseRanges)
      : [];

    return {
      displayRef: formatReference(selectedSpan.ref, "es"),
      raw: selectedSpan.ref.raw,
      verses,
      notFound: !result || result.notFound || verses.length === 0,
    };
  }, [results, selectedSpan]);

  const renderItem = useCallback(
    ({ item }: { item: VerseResult }) => (
      <VerseCard item={item} onOpenContext={handleOpenContext} />
    ),
    [handleOpenContext]
  );

  const keyExtractor = useCallback(
    (item: VerseResult) => item.ref.normalized,
    []
  );

  const renderEmpty = useCallback(
    () => (
      <Text style={styles.empty}>
        Las citas detectadas aparecerán aquí.
      </Text>
    ),
    []
  );

  const topPadding = Math.max(RNStatusBar.currentHeight ?? 0, 24) + 14;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: topPadding }]}
      behavior={Platform.OS === "android" ? "height" : "padding"}
    >
      <View style={styles.topBar}>
        <Pressable
          style={styles.bibleBtn}
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Volver a la lectura"
        >
          <Text style={styles.bibleText}>‹ Leer</Text>
        </Pressable>
        <Text style={styles.title}>Escáner</Text>
        <View style={styles.topBarRight}>
          {!ocrAvailable ? (
            <View style={styles.ocrWarning}>
              <Text style={styles.ocrWarningText}>Sin OCR</Text>
            </View>
          ) : null}
          <VersionChip
            abbr={version.abbr}
            onPress={() => setVersionPickerOpen(true)}
            disabled={scanning || loading}
          />
        </View>
      </View>

      <View style={styles.captureRow}>
        <Pressable
          style={[
            styles.captureBtn,
            styles.scanBtn,
            (scanning || loading) && styles.disabled,
          ]}
          onPress={handleScan}
          disabled={scanning || loading}
          accessibilityRole="button"
          accessibilityLabel="Escanear documento"
        >
          <Text style={[styles.captureText, styles.scanText]}>
            {scanning ? "Escaneando…" : "Escanear"}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.captureBtn,
            styles.galleryBtn,
            (scanning || loading) && styles.disabled,
          ]}
          onPress={() => pickImage(false)}
          disabled={scanning || loading}
          accessibilityRole="button"
          accessibilityLabel="Elegir foto de la galería"
        >
          <Text style={[styles.captureText, styles.galleryText]}>Galería</Text>
        </Pressable>
      </View>

      <RecognizedTextPanel
        text={ocrText}
        spans={visibleSpans}
        resultsCount={results.length}
        editing={editing}
        expanded={expanded}
        loading={loading}
        hint={hint}
        height={panelHeight}
        fill={editing}
        onChangeText={setOcrText}
        onToggleEdit={handleToggleEdit}
        onCancelEdit={handleCancelEdit}
        onToggleExpand={handleToggleExpand}
        onAnalyze={onManualAnalyze}
        onSelectSpan={handleSelectSpan}
      />

      {!editing ? (
        <View style={styles.resultsSection}>
          <View style={styles.resultsHeader}>
            <View style={styles.resultsTitleRow}>
              <Text style={styles.resultsTitle}>Resultados</Text>
              {results.length > 0 ? (
                <View style={styles.resultsCountPill}>
                  <Text style={styles.resultsCount}>{results.length}</Text>
                </View>
              ) : null}
            </View>
            {results.length > 0 ? (
              <Pressable
                style={[
                  styles.shareBtn,
                  (exporting || loading) && styles.disabled,
                ]}
                onPress={() => setShareOptionsOpen(true)}
                disabled={exporting || loading}
                accessibilityRole="button"
                accessibilityLabel="Compartir resultados"
              >
                <Text style={styles.shareText}>
                  {exporting ? "Preparando…" : "Compartir"}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.listWrap}>
            <FlashList
              data={results}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={renderEmpty}
            />
          </View>
        </View>
      ) : null}

      <VersionPickerModal
        visible={versionPickerOpen}
        versions={BIBLE_VERSIONS}
        selectedId={versionId}
        onSelect={handleSelectVersion}
        onClose={() => setVersionPickerOpen(false)}
      />
      <ShareOptionsModal
        visible={shareOptionsOpen}
        count={results.length}
        versionAbbr={version.abbr}
        busy={exporting}
        onSelect={handleShare}
        onClose={() => setShareOptionsOpen(false)}
      />
      <CitationSheet
        visible={citationVisible}
        citation={citation}
        version={version}
        onClose={closeCitation}
        onOpenContext={
          selectedSpan ? () => handleOpenContext(selectedSpan.ref) : undefined
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    // La app dibuja edge-to-edge: deja libre la barra de navegación de Android.
    paddingBottom: 48,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.3,
  },
  topBarRight: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 44 },
  ocrWarning: {
    backgroundColor: colors.warningBg,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ocrWarningText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.warningText,
  },
  bibleBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bibleText: { fontSize: 12, fontWeight: "800", color: colors.navy },
  captureRow: { flexDirection: "row", gap: 10 },
  captureBtn: {
    flex: 1,
    height: 46,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  scanBtn: { backgroundColor: colors.navy },
  galleryBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  captureText: { fontSize: 14, fontWeight: "700" },
  scanText: { color: "#fff" },
  galleryText: { color: colors.navy },
  disabled: { opacity: 0.5 },
  resultsSection: { flex: 1, marginTop: 12 },
  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  resultsTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  resultsTitle: { fontSize: 13, fontWeight: "700", color: colors.ink },
  resultsCountPill: {
    backgroundColor: colors.shareBg,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  resultsCount: { fontSize: 10, fontWeight: "700", color: colors.blue },
  shareBtn: {
    backgroundColor: colors.shareBg,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  shareText: { fontSize: 12, fontWeight: "700", color: colors.navy },
  listWrap: { flex: 1 },
  listContent: { paddingBottom: 32 },
  empty: {
    textAlign: "center",
    color: colors.faint,
    marginTop: 24,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 24,
  },
});
