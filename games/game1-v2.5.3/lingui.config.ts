import type { LinguiConfig } from "@lingui/conf";

import { lefunExtractor } from "@lefun/ui/lefunExtractor";

import { game } from "./src/game";

const config: LinguiConfig = {
  locales: ["en", "fr"],
  sourceLocale: "en",
  compileNamespace: "es",
  catalogs: [
    {
      path: "<rootDir>/src/locales/{locale}/messages",
      include: ["src"],
    },
  ],
  format: "po",
  extractors: [lefunExtractor(game)],
  formatOptions: {
    lineNumbers: false,
  },
};

export default config;
