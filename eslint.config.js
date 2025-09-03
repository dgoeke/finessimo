import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintComments from "eslint-plugin-eslint-comments";
import importX from "eslint-plugin-import-x";
import perfectionist from "eslint-plugin-perfectionist";
import promise from "eslint-plugin-promise";
import sonarjs from "eslint-plugin-sonarjs"; // cognitive complexity, duplicates
// import unicorn from "eslint-plugin-unicorn";  // many sharp edges, can be noisy

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  sonarjs.configs.recommended,

  // Global language options
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    settings: {
      "import-x/resolver": { typescript: true, node: true },
    },
    plugins: {
      "eslint-comments": eslintComments,
      "import-x": importX,
      perfectionist,
      promise,
      // unicorn,
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },

  // Default rules for all files
  {
    rules: {
      // Core hygiene
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: ["error", "smart"],
      "no-implicit-coercion": "error",
      "default-case-last": "error",
      "prefer-template": "error",
      "sort-imports": "off",

      // Comments guardrails
      "eslint-comments/no-unused-disable": "error",

      // Imports/ordering
      "import-x/no-extraneous-dependencies": "error",
      "import-x/no-default-export": "error",
      "import-x/no-duplicates": "error",
      "import-x/first": "error",
      "import-x/no-mutable-exports": "error",
      "import-x/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "object",
            "type",
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],

      // Promise discipline (some overlap with TS rules; still useful)
      "promise/no-return-wrap": "error",
      "promise/param-names": "error",
      "promise/no-nesting": "warn",
      "promise/no-promise-in-callback": "error",
      "promise/no-callback-in-promise": "warn",

      // Perfectionist (keep objects/ts members tidy)
      "perfectionist/sort-objects": [
        "error",
        { type: "natural", order: "asc" },
      ],
      "perfectionist/sort-imports": "off",
      "perfectionist/sort-named-exports": [
        "error",
        { type: "natural", order: "asc" },
      ],
    },
  },

  // TS-only strictness
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ["./tsconfig.eslint.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-deprecated": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": [
        "error",
        { fixToUnknown: false, ignoreRestArgs: false },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/array-type": ["error", { default: "generic" }],
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-ignore": "allow-with-description", minimumDescriptionLength: 10 },
      ],
      "@typescript-eslint/no-empty-object-type": "error",
      "@typescript-eslint/no-unsafe-function-type": "error",
      "@typescript-eslint/no-wrapper-object-types": "error",
      "@typescript-eslint/no-restricted-types": [
        "error",
        {
          types: {
            object: {
              message:
                "Avoid the broad 'object' type; use a precise shape or `Record<string, unknown>`.",
              suggest: ["Record<string, unknown>", "unknown"],
            },
          },
        },
      ],
      // Async safety
      "@typescript-eslint/no-floating-promises": [
        "error",
        { ignoreVoid: true, ignoreIIFE: true },
      ],
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-confusing-void-expression": [
        "error",
        { ignoreArrowShorthand: true },
      ],

      // Logic safety
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/strict-boolean-expressions": [
        "error",
        {
          allowNullableBoolean: false,
          allowNullableString: false,
          allowNullableNumber: false,
          allowString: false,
          allowNumber: false,
          allowAny: false,
        },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/no-duplicate-type-constituents": "error",
      "@typescript-eslint/prefer-nullish-coalescing": [
        "error",
        { ignoreConditionalTests: true },
      ],
      "@typescript-eslint/prefer-optional-chain": "error",

      // Custom restrictions for codebase consistency
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message:
            "Use fromNow() from '../types/timestamp' instead of Date.now() for consistent timing and strong type safety. Only timestamp utilities may use performance.now() directly.",
        },
        {
          selector:
            "CallExpression[callee.object.name='performance'][callee.property.name='now']",
          message:
            "Use fromNow() from '../types/timestamp' instead of performance.now() for consistent timing and stronger type safety. Only timestamp utilities may use performance.now() directly.",
        },
      ],

      // Style & API clarity (tune to taste)
      "@typescript-eslint/explicit-function-return-type": [
        "warn",
        {
          allowExpressions: false,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
        },
      ],
    },
  },

  // Allow performance.now() in timestamp utilities and their tests
  {
    files: ["**/types/timestamp.ts", "**/timestamp.test.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message:
            "Use performance.now() instead of Date.now() for consistent timing in timestamp utilities",
        },
      ],
    },
  },

  // Maintainability guardrails (tune thresholds to your codebase)
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "max-depth": ["warn", 3],
      complexity: ["warn", 12],
      "max-params": ["warn", 5],
      "max-lines-per-function": [
        "warn",
        { max: 120, skipBlankLines: true, skipComments: true },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // Test files: relax some rules, add jest/vitest globals if needed
  {
    files: ["**/*.test.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": "error",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/ban-ts-comment": ["error", { "ts-ignore": false }],
      "@typescript-eslint/unbound-method": "off", // Allow Jest mock method references
      "@typescript-eslint/no-unsafe-assignment": "off", // Allow mock call data access
      "@typescript-eslint/no-unsafe-member-access": "off", // Allow mock property access
      "@typescript-eslint/restrict-plus-operands": "off", // Allow arithmetic with mock data
      // If using Vitest/Jest, consider eslint-plugin-jest and its flat config here.
    },
  },

  // Declaration files: allow interfaces for global augmentation (TypeScript requirement)
  {
    files: ["**/*.d.ts"],
    rules: {
      "@typescript-eslint/consistent-type-definitions": "off", // Required for global augmentation
    },
  },

  // Ignores
  {
    ignores: [
      "dist",
      "build",
      "node_modules",
      "eslint.config.js",
      "assistants/templates/**/*.hbs",
    ],
  }
);
