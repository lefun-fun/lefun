import { lingui } from "@lingui/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ["macros"],
      },
    }),
    lingui(),
  ],
  resolve: {
    dedupe: ["react", "react-dom"],
    mainFields: ["module", "main"],
  },
});
