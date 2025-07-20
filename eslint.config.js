// @ts-check

import eslint from '@eslint/js';
import { globalIgnores } from "eslint/config";
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  globalIgnores([
    "games/*/**/dist/**",
    "packages/*/dist/**",
  ]),
  eslint.configs.recommended,
  tseslint.configs.recommended,
  // tseslint.configs.strict,
  // tseslint.configs.stylistic,
  reactHooks.configs['recommended-latest'],
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
  // No warning for "_" variables.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "varsIgnorePattern": "_",
        }
      ]
    }
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    }
  }
);
