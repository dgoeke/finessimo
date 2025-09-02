import { describe, expect, it, jest } from "@jest/globals";

import { Results } from "../../src/presentation/phaser/scenes/Results";
import {
  SCENE_KEYS,
  type SceneKey,
} from "../../src/presentation/phaser/scenes/types";
import {
  createPercentage,
  createUnbrandedMs,
  createDurationMs,
} from "../../src/types/brands";

import type { ResultsSummary } from "../../src/presentation/phaser/scenes/Results";

describe("Results scene (Phase 7)", () => {
  it("has proper scene key", () => {
    // Results scene should be created with correct key
    expect(SCENE_KEYS.Results).toBe("Results");
  });

  it("accepts summary data in init method", () => {
    const summary: ResultsSummary = {
      accuracyPercentage: createPercentage(87),
      linesCleared: 12,
      piecesPlaced: 34,
      timePlayedMs: createUnbrandedMs(createDurationMs(12_345)),
    } as const;

    const results = new Results();
    results.init({ summary });

    // The init method should accept summary data
    // Internal storage validation would require runtime test
  });

  it("provides both retry and backToMenu scene transitions", () => {
    const start = jest.fn<(k: SceneKey) => void>();
    const results = new Results();

    // Mock the scene plugin directly on the instance
    Object.defineProperty(results, "scene", {
      value: { start },
      writable: true,
    });

    results.retry();
    expect(start).toHaveBeenCalledWith(SCENE_KEYS.Gameplay);

    results.backToMenu();
    expect(start).toHaveBeenCalledWith(SCENE_KEYS.MainMenu);
  });

  it("handles null summary gracefully in init", () => {
    const results = new Results();

    // Should not throw when called without data
    expect(() => results.init()).not.toThrow();

    // Should not throw when called with empty data
    expect(() => results.init({})).not.toThrow();
  });

  it("accepts valid summary data structure", () => {
    const validSummary: ResultsSummary = {
      accuracyPercentage: createPercentage(95),
      linesCleared: 25,
      piecesPlaced: 50,
      timePlayedMs: createUnbrandedMs(createDurationMs(30000)),
    } as const;

    const results = new Results();

    expect(() => results.init({ summary: validSummary })).not.toThrow();
  });
});
