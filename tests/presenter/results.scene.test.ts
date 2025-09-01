import { describe, expect, it, jest } from "@jest/globals";

import { Results } from "../../src/presentation/phaser/scenes/Results";
import {
  SCENE_KEYS,
  type SceneController,
  type SceneKey,
} from "../../src/presentation/phaser/scenes/types";

import type {
  ResultsSummary,
  ResultsUiAdapter,
} from "../../src/presentation/phaser/scenes/Results";

describe("Results scene (Phase 7)", () => {
  it("binds buttons and animates counters via UI adapter", () => {
    const calls: Array<string> = [];

    let retryHandler: () => void = () => {
      throw new Error("retry handler not bound");
    };
    let menuHandler: () => void = () => {
      throw new Error("menu handler not bound");
    };

    const ui: ResultsUiAdapter = {
      animateCounter: (label, to, durationMs) =>
        calls.push(`anim:${label}:${String(to)}:${String(durationMs)}`),
      bindMenu: (h) => {
        menuHandler = h;
      },
      bindRetry: (h) => {
        retryHandler = h;
      },
      emitParticles: (kind) => calls.push(`particles:${kind}`),
    } as const;

    const summary: ResultsSummary = {
      accuracyPercentage: 87.4,
      linesCleared: 12,
      piecesPlaced: 34,
      timePlayedMs: 12_345,
    } as const;

    const start = jest.fn<(k: SceneKey) => void>();
    const scene: SceneController = { start };
    const results = new Results();
    results.scene = scene;

    results.show(summary, ui);

    // Expect four counter animations and a celebration burst
    expect(calls.some((c) => c.startsWith("anim:lines:12:"))).toBe(true);
    expect(calls.some((c) => c.startsWith("anim:pieces:34:"))).toBe(true);
    expect(calls.some((c) => c.startsWith("anim:accuracy:87:"))).toBe(true);
    expect(calls.some((c) => c.startsWith("anim:timeSec:12:"))).toBe(true);
    expect(calls).toContain("particles:celebration");

    // Simulate button presses via bound handlers
    retryHandler();
    expect(start).toHaveBeenLastCalledWith(SCENE_KEYS.Gameplay);

    menuHandler();
    expect(start).toHaveBeenLastCalledWith(SCENE_KEYS.MainMenu);
  });
});
