import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import ScannerScreen from './src/screens/ScannerScreen';
import BibleScreen, { type BibleTarget } from './src/screens/BibleScreen';

export default function App() {
  const [scannerOpen, setScannerOpen] = useState(false);
  // Habilitado tras la primera apertura: mantiene la foto, el OCR y los
  // resultados mientras el usuario va al capítulo y vuelve.
  const [scannerMounted, setScannerMounted] = useState(false);
  const [jump, setJump] = useState<{ target: BibleTarget; key: number } | null>(
    null
  );

  const openScanner = useCallback(() => {
    setScannerMounted(true);
    setScannerOpen(true);
  }, []);

  const closeScanner = useCallback(() => setScannerOpen(false), []);

  const openChapter = useCallback(
    (_versionId: string, target: BibleTarget) => {
      setJump((current) => ({ target, key: (current?.key ?? 0) + 1 }));
    },
    []
  );

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={scannerOpen ? styles.hidden : styles.fill}>
        <BibleScreen
          jump={jump}
          onOpenScanner={openScanner}
        />
      </View>
      {scannerMounted ? (
        <View style={scannerOpen ? styles.fill : styles.hidden}>
          <ScannerScreen
            onClose={closeScanner}
            onOpenBible={openChapter}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  hidden: { flex: 1, display: 'none' },
});
