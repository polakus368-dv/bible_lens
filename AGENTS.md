# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

Bible Lens es un lector de la Biblia con el escáner como módulo. El flujo, la arquitectura y los gotchas están en `../agents.md`; leerlo antes de cambios grandes. Puntos que más se rompen:

- La pantalla de inicio es `src/screens/BibleScreen.tsx`; `src/screens/ScannerScreen.tsx` solo se monta al tocar `⊞` en la barra superior. Usar hermanos flex en `App.tsx` (nunca `position: 'absolute'` alrededor del lector).
- La versión de la Biblia y los autores de comentarios se guardan con `saveSettings(patch)`; al guardar autores pasar la lista completa vigente.
- Los manifiestos `*.generated.ts` (`versionMetadata`, `commentaryMetadata`) se generan con los scripts de `scripts/`; no editarlos a mano. En este checkout ejecutar los scripts con `node scripts/tsx-shim.js <script.ts>` porque `tsx`/esbuild no funciona.
- Aquí corren las versiones RVR1960/NVI/LBLA solo para uso personal y los sermones de sermonindex en runtime/caché (no empaquetados).
