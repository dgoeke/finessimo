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
  coverageReporters: ["text", "lcov", "html"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^tinykeys$": "<rootDir>/__mocks__/tinykeys.ts",
  },
};
