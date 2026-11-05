/**
 * Reemplazo de `tsx` para los scripts de build en este checkout de Windows.
 * Los node_modules se instalaron en Linux y el binario de esbuild no coincide,
 * así que los scripts se ejecutan con ts-node (JS puro).
 *
 * Uso: node scripts/tsx-shim.js scripts/build-commentary.ts --only adamclarke
 */
const path = require("path");

require("ts-node").register({
  transpileOnly: true,
  compilerOptions: {
    module: "commonjs",
    esModuleInterop: true,
    resolveJsonModule: true,
    rootDir: path.join(__dirname, ".."),
  },
  // ts-node no siempre descarta estos errores de layout sin typeCheck.
  ignoreDiagnostics: [5011, 5109, 2580, 6059],
});

const target = process.argv[2];
if (!target) {
  console.error("Uso: node scripts/tsx-shim.js <script.ts> [args...]");
  process.exit(1);
}
process.argv.splice(2, 1);
require(path.resolve(target));
