/** @type {import('jest').Config} */
export default {
  preset: "ts-jest/presets/default-esm",
  extensionsToTreatAsEsm: [".ts"],
  testEnvironment: "jsdom",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "./tsconfig.test.json",
      },
    ],
  },
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!src/main.ts"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html", "json-summary"],
  // Lock coverage to a committed snapshot to prevent regressions
  coverageThreshold: (() => {
    try {
      const fs = require('node:fs');
      const path = require('node:path');
      const thresholdsPath = path.join(__dirname ?? process.cwd(), 'config', 'coverage-thresholds.json');
      if (fs.existsSync(thresholdsPath)) {
        const thresholds = JSON.parse(fs.readFileSync(thresholdsPath, 'utf8'));
        // Include a permissive global so only per-file gates apply
        return { global: { statements: 0, branches: 0, functions: 0, lines: 0 }, ...thresholds };
      }
    } catch {}
    return { global: { statements: 0, branches: 0, functions: 0, lines: 0 } };
  })(),
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@lit-labs/signals$": "<rootDir>/__mocks__/@lit-labs/signals.ts",
  },
};
