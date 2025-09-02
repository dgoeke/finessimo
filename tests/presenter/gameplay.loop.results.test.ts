import { describe, expect, it } from "@jest/globals";

import {
  handleTopOutTransition,
  computeResultsSummary,
} from "../../src/presentation/phaser/scenes/gameplay/loop";
import {
  createDurationMs,
  percentageAsNumber,
  unbrandedMsAsNumber,
} from "../../src/types/brands";

import type { SceneCtx } from "../../src/presentation/phaser/scenes/gameplay/types";
import type { GameState } from "../../src/state/types";

describe("Gameplay Loop Results Integration", () => {
  describe("handleTopOutTransition", () => {
    it("returns true when state is topOut", () => {
      const ctx = {
        state: { status: "topOut" } as GameState,
      } as SceneCtx;

      expect(handleTopOutTransition(ctx)).toBe(true);
    });

    it("returns false when state is not topOut", () => {
      const ctx = {
        state: { status: "playing" } as GameState,
      } as SceneCtx;

      expect(handleTopOutTransition(ctx)).toBe(false);
    });
  });

  describe("computeResultsSummary", () => {
    it("returns default values for null state", () => {
      const result = computeResultsSummary(null);

      expect(percentageAsNumber(result.accuracyPercentage)).toBe(0);
      expect(result.linesCleared).toBe(0);
      expect(result.piecesPlaced).toBe(0);
      expect(unbrandedMsAsNumber(result.timePlayedMs)).toBe(0);
    });

    it("returns default values for undefined state", () => {
      const result = computeResultsSummary(undefined);

      expect(percentageAsNumber(result.accuracyPercentage)).toBe(0);
      expect(result.linesCleared).toBe(0);
      expect(result.piecesPlaced).toBe(0);
      expect(unbrandedMsAsNumber(result.timePlayedMs)).toBe(0);
    });

    it("computes summary from game state stats", () => {
      const state = {
        stats: {
          accuracyPercentage: 87.4,
          linesCleared: 12,
          piecesPlaced: 34,
          timePlayedMs: createDurationMs(12345),
        },
      } as GameState;

      const result = computeResultsSummary(state);

      expect(percentageAsNumber(result.accuracyPercentage)).toBe(87); // rounded
      expect(result.linesCleared).toBe(12);
      expect(result.piecesPlaced).toBe(34);
      expect(unbrandedMsAsNumber(result.timePlayedMs)).toBe(12345);
    });

    it("rounds accuracy percentage", () => {
      const state = {
        stats: {
          accuracyPercentage: 67.8,
          linesCleared: 0,
          piecesPlaced: 0,
          timePlayedMs: createDurationMs(0),
        },
      } as GameState;

      const result = computeResultsSummary(state);

      expect(percentageAsNumber(result.accuracyPercentage)).toBe(68);
    });
  });
});
