import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      // The polymorphic-model boundary and a few Express/Mongoose seams need pragmatic casts.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // The raw Mongo setup script runs under mongosh, not Node/TS — lint it loosely as a script.
    files: ["scripts/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: { db: "readonly", ObjectId: "readonly", print: "readonly" },
    },
    rules: {
      "no-undef": "off",
    },
  }
);
