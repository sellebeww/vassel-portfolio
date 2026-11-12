// Copyright (c) 2026 Vassel Goleyu. All rights reserved.
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "test-results", "playwright-report", "docs"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      // R3F scenes and the scroll engine intentionally read refs and mutate three.js objects every frame.
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  { files: ["tools/**/*.mjs", "tests/**/*.ts", "*.config.{js,ts}"], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
);
