import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    files: ["apps/web/**/*.ts", "vitest.config.ts"],
    extends: [eslint.configs.recommended, tseslint.configs.recommended],
  },
  {
    files: ["scripts/**/*.mjs"],
    extends: [eslint.configs.recommended],
    languageOptions: {
      sourceType: "module",
      globals: {
        process: "readonly",
      },
    },
  },
);
