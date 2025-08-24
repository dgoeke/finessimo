import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      "no-undef": "off",
      "prefer-const": "error",
      "no-var": "error",
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/prefer-optional-chain": "off",
      "@typescript-eslint/non-nullable-type-assertion-style": "off",
      "@typescript-eslint/prefer-regexp-exec": "off",
      "@typescript-eslint/dot-notation": "off",
    },
  },
  {
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      "@typescript-eslint/ban-ts-comment": [
        "warn",
        { "ts-expect-error": "allow-with-description" },
      ],
    },
  },
  {
    ignores: ["dist", "build", "node_modules", "eslint.config.js"],
  },
);
