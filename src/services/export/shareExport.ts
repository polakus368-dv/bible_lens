/**
 * Comparte las exportaciones: texto plano por el Share nativo y
 * archivos .txt/.md por expo-sharing (escritos en caché, sin permisos).
 */

import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Share } from "react-native";
import type { VerseResult } from "../bible/bibleService";
import type { BibleVersion } from "../bible/versions";
import {
  buildExport,
  buildPlainExport,
  formatFileStamp,
  type ExportFormat,
} from "./exportService";

export async function sharePlainText(
  results: VerseResult[],
  version: BibleVersion
): Promise<void> {
  await Share.share({
    message: buildPlainExport(results, version),
    title: `Bible Lens · ${version.abbr}`,
  });
}

export async function shareExportFile(
  format: Exclude<ExportFormat, "plain">,
  results: VerseResult[],
  version: BibleVersion,
  date: Date = new Date()
): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error("Compartir archivos no está disponible en este dispositivo.");
  }

  const content = buildExport(format, results, version, date);
  const file = new File(
    Paths.cache,
    `bible-lens-${version.id}-${formatFileStamp(date)}.${format}`
  );
  if (file.exists) file.delete();
  file.create({ intermediates: true });
  file.write(content);

  await Sharing.shareAsync(file.uri, {
    mimeType: "text/plain",
    dialogTitle: `Compartir Bible Lens · ${version.abbr}`,
    UTI: format === "md" ? "net.daringfireball.markdown" : "public.plain-text",
  });
}
