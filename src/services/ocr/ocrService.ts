import { NativeModules } from "react-native";
import { orderLinesByPosition } from "./lineOrder";

export type OcrResult = {
  text: string;
  blocks: string[];
};

let mlkit: any = null;
try {
  mlkit = require("@react-native-ml-kit/text-recognition");
} catch {
  mlkit = null;
}

function hasNativeModule(): boolean {
  return Boolean(NativeModules.TextRecognition);
}

export async function recognizeText(imageUri: string): Promise<OcrResult> {
  if (mlkit?.default?.recognize && hasNativeModule()) {
    try {
      const result = await mlkit.default.recognize(imageUri);
      // ML Kit ordena por bloques; reordenamos por posición visual para que el
      // texto reconocido coincida con la lectura de la foto.
      const text: string = orderLinesByPosition(result.blocks) || result.text || "";
      const blocks: string[] =
        result.blocks?.map((block: any) => block.text) ?? (text ? [text] : []);
      return { text, blocks };
    } catch (error) {
      console.warn("[OCR] ML Kit error:", error);
    }
  }

  if (imageUri.startsWith("mock:")) {
    const mockText = imageUri.replace("mock:", "");
    return { text: mockText, blocks: [mockText] };
  }

  return { text: "", blocks: [] };
}

export function isOcrAvailable(): boolean {
  return Boolean(mlkit?.default?.recognize && hasNativeModule());
}
