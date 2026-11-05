# Textos bíblicos offline

Formato compacto usado por la app:

```json
{ "GEN": { "1": { "1": "En el principio..." } } }
```

Cada archivo tiene 66 libros, 1.189 capítulos y ~31.000 versículos.

## es-rvr1909.json

- Traducción: Reina Valera 1909 (RVR1909).
- Licencia: dominio público / CC0 1.0.
- Fuente: [BibleAquifer/ReinaValera1909](https://github.com/BibleAquifer/ReinaValera1909), release `v2026-09-18`, archivo `Spanish-json.zip`.
- Generado con:

```bash
npx tsx scripts/build-rvr1909.ts /ruta/a/json assets/bible/es-rvr1909.json
```

## es-rvr1960.json, es-nvi.json y es-lbla.json

- Traducciones:
  - Reina Valera 1960 (RVR1960).
  - Nueva Versión Internacional (NVI).
  - La Biblia de las Américas (LBLA).
- Fuente: snapshots fijados de [mrk214/bible-data-es-spa](https://github.com/mrk214/bible-data-es-spa):
  - `https://mrk214.github.io/snapshots/es___spa___spa/RVR1960_vid_149.json`
  - `https://mrk214.github.io/snapshots/es___spa___spa/NVI_vid_128.json`
  - `https://mrk214.github.io/snapshots/es___spa___spa/LBLA_vid_89.json`
- **Licencias**: las tres versiones tienen copyright de terceros. Se incluyen
  únicamente para uso personal. La app muestra el aviso en el selector y en
  cada exportación. No redistribuir el APK con estos textos sin autorización.
  - RVR1960: «Texto bíblico Reina-Valera 1960® © Sociedades Bíblicas en
    América Latina, 1960. Derechos renovados 1988, Sociedades Bíblicas Unidas.»
  - NVI: «Santa Biblia, Nueva Versión Internacional® NVI® © 1999, 2015, 2022
    por Biblica, Inc. Usado con permiso. Reservados todos los derechos en todo
    el mundo.»
  - LBLA: «1986, 1995, 1997 by The Lockman Foundation».
- Regenerar (descarga los snapshots, limpia HTML/entidades, une fragmentos y
  valida 66 libros y >30.000 versículos):

```bash
npx tsx scripts/build-versions.ts
```

El script también regenera `src/services/bible/versionMetadata.generated.ts`
(metadatos de las cuatro versiones). No editar ese manifiesto a mano.
