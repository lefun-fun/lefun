import type { LinguiConfig } from "@lingui/conf";
import { formatter } from "@lingui/format-po";

import { lefunExtractor } from "@lefun/ui/lefunExtractor";

import { game } from "./src/game";

const config: LinguiConfig = {
  locales: ["en", "fr"],
  sourceLocale: "en",
  catalogs: [
    {
      path: "<rootDir>/src/locales/{locale}/messages",
      include: ["src"],
    },
  ],
  format: formatter({ lineNumbers: false }),
  extractors: [lefunExtractor(game)],
};

export default config;
