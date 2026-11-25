import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "test-results/**",
      "playwright-report/**",
      "docs/gallery/**",
      ".sandcastle/**",
      "eslint.config.js",
      "vite.config.ts",
      "vitest.config.ts",
      "playwright.config.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ["src/**/*.ts", "e2e/**/*.ts"],
    languageOptions: {
      parserOptions: { projectService: true },
    },
    rules: {
      "no-console": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
);
