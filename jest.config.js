module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/__tests__", "<rootDir>/src"],
  // Los scripts de build (Node) también tienen tests: parser de comentarios, etc.
  testMatch: ["<rootDir>/__tests__/**/*.test.ts", "<rootDir>/scripts/**/*.test.ts"],
  moduleFileExtensions: ["ts", "tsx", "js"],
  // tsx viene de un node_modules instalado en Linux (esbuild binario);
  // los scripts se ejecutan vía ts-node, que es JS puro.
  moduleNameMapper: { "^tsx$": "<rootDir>/scripts/tsx-shim.js" },
  transform: { "^.+\\.tsx?$": ["ts-jest", { tsconfig: { jsx: "react", esModuleInterop: true } }] },
};
