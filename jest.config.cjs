/** @type {import('jest').Config} */
const fs = require("fs");
const path = require("path");

const thresholdsPath = path.join(
  __dirname,
  "config",
  "coverage-thresholds.json"
);

const defaultGlobal = { statements: 0, branches: 0, functions: 0, lines: 0 };

let coverageThreshold;
try {
  if (fs.existsSync(thresholdsPath)) {
    const thresholds = JSON.parse(fs.readFileSync(thresholdsPath, "utf8"));
    // Merge a permissive default global so only provided gates are enforced
    coverageThreshold = { global: defaultGlobal, ...thresholds };
  } else {
    coverageThreshold = { global: defaultGlobal };
  }
} catch (err) {
  // Log so failures to read/parse are visible when Jest loads the config
  // (fall back to permissive defaults to avoid breaking local runs)
  // eslint-disable-next-line no-console
  console.warn("jest.config: could not read coverage thresholds:", err);
  coverageThreshold = { global: defaultGlobal };
}

module.exports = {
  preset: "ts-jest/presets/default-esm",
  extensionsToTreatAsEsm: [".ts"],
  testEnvironment: "jsdom",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
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
  coverageThreshold,
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@lit-labs/signals$": "<rootDir>/__mocks__/@lit-labs/signals.ts",
    // Map Phaser to a light-weight mock for Node/Jest
    "^phaser$": "<rootDir>/__mocks__/phaser.ts",
  },
};
