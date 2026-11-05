/**
 * Escáner de documentos con ML Kit (on-device).
 *
 * Usa el escáner de Google Play Services en modo FULL: detecta bordes,
 * corrige perspectiva, endereza (dewarp), quita sombras/manchas y devuelve
 * un JPEG listo para el OCR. También permite importar una foto existente
 * desde la galería del escáner.
 *
 * En Expo Go el módulo nativo no existe: la carga es perezosa y se informa
 * como no disponible para caer al flujo de cámara normal.
 */

export type ScanResult = {
  scannedImages?: string[];
  status?: "success" | "cancel";
};

type ScannerModule = {
  scanDocument: (options?: {
    maxNumDocuments?: number;
    croppedImageQuality?: number;
  }) => Promise<ScanResult>;
};

let scanner: ScannerModule | null = null;
try {
  scanner = require("react-native-document-scanner-plugin").default ?? null;
} catch {
  scanner = null;
}

export function isDocumentScannerAvailable(): boolean {
  return Boolean(scanner?.scanDocument);
}

/**
 * Abre el escáner y devuelve la URI de la primera página procesada, o null
 * si el usuario cancela.
 */
export async function scanDocument(maxPages = 1): Promise<string | null> {
  if (!scanner) {
    throw new Error("El escáner no está disponible en este build.");
  }

  const result = await scanner.scanDocument({
    maxNumDocuments: maxPages,
    croppedImageQuality: 100,
  });

  if (result.status !== "success") return null;

  const uri = result.scannedImages?.[0];
  if (!uri) return null;

  // ML Kit devuelve content://; si viniera una ruta pelada, agregamos file://.
  return /^(file|content):\/\//.test(uri) ? uri : `file://${uri}`;
}
