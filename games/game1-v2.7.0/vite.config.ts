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
  resolve: {
    dedupe: ["react", "react-dom"],
    mainFields: ["module", "main"],
  },
});
