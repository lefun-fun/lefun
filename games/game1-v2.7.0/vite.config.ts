import { lingui, linguiTransformerBabelPreset } from "@lingui/vite-plugin";
import babel from "@rolldown/plugin-babel";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [linguiTransformerBabelPreset()] }),
    lingui(),
  ],
  build: {
    lib: {
      entry: {
        game: "src/game.ts",
        ui: "src/ui.tsx",
        backend: "src/backend.ts",
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        "@lingui/react",
        "react",
        "react/jsx-runtime",
        "react-dom",
        "@lefun/core",
        "@lefun/game",
        "@lefun/ui",
      ],
      output: {
        assetFileNames: (info) =>
          info.name?.endsWith(".css") ? "index.css" : "[name][extname]",
      },
    },
    sourcemap: true,
  },
});
