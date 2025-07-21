// @ts-check

import eslint from "@eslint/js";
import { globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tseslint from "typescript-eslint";

export default tseslint.config(
  globalIgnores([
    "games/*/*/dist/**",
    "games/*/dist/**",
    "packages/*/dist/**",
    "packages/*/*.config.js",
    "games/*/*.config.{ts,js}",
    "games/*/*/*.config.{ts,js}",
  ]),
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
  reactHooks.configs["recommended-latest"],
  // simple-import-sort
  {
    plugins: {
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      "simple-import-sort/imports": [
        "error",
        {
          groups: [
            ["^\\u0000"],
            ["^node:"],
            ["^@?\\w"],
            ["(^@lefun/|^dudo-game$)"],
            ["^"],
            ["^\\."],
          ],
        },
      ],
      "simple-import-sort/exports": "error",
    },
  },
  {
    rules: {
      // We had too many of these.
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      //
      // TODO Enable this one.
      "@typescript-eslint/no-redundant-type-constituents": "off",
      //
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      // No warning for "_" variables.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          varsIgnorePattern: "_",
        },
      ],
    },
  },
);
