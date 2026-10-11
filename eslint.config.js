// @ts-check
import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import astro from "eslint-plugin-astro";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";
import globals from "globals";

const controlFiles = ["apps/control/**/*.{js,jsx,ts,tsx}"];

export default defineConfig(
  // Build output, generated files and test/audit reports are never linted.
  globalIgnores([
    "**/dist/",
    "**/.astro/",
    "test-results/",
    "playwright-report/",
    "**/.lighthouseci/",
    // Wrangler local state and the staging copy of the web (spec 003).
    "**/.wrangler/",
    "apps/web/.staging/",
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    // Root tooling scripts and config files run in Node.
    files: ["*.{js,mjs,cjs,ts}", "scripts/**/*.{js,mjs,cjs,ts}"],
    languageOptions: { globals: globals.node },
  },
  {
    // CommonJS config files required by tools (e.g. apps/web/lighthouserc.cjs).
    files: ["**/*.cjs"],
    languageOptions: { sourceType: "commonjs", globals: globals.node },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Public website (Astro): the plugin's configs only match .astro files.
  astro.configs["flat/recommended"],
  // Control Center (React).
  {
    files: controlFiles,
    extends: [
      react.configs.flat.recommended,
      react.configs.flat["jsx-runtime"],
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: { globals: globals.browser },
    // "detect" cannot resolve react from the root (pnpm keeps it inside
    // apps/control), so the version is pinned to the installed line.
    settings: { react: { version: "19.3" } },
  },
  // Must stay last: turns off rules that conflict with Prettier.
  prettier,
);
