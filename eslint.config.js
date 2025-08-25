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
      "prefer-const": "error",
      "no-var": "error",
      "@typescript-eslint/no-unused-vars": "error",
    },
  },
  {
    ignores: [
      "dist",
      "build",
      "node_modules",
      "eslint.config.js",
      "assistants/templates/**/*.hbs",
    ],
  },
);
