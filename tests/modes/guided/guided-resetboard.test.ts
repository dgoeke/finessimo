import { describe, test, expect, jest } from "@jest/globals";

import { createDurationMs } from "@/types/brands";

import { reducerWithPipeline } from "../../helpers/reducer-with-pipeline";
import { createTestInitAction } from "../../test-helpers";

import type { Action, GameState } from "@/state/types";

describe("Guided mode clears board after commit", () => {
  test("board is reset after a hard drop commit", () => {
    // Mock console.error to suppress expected error messages during test
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {
      // Suppress expected console.error during test
    });

    try {
      let state: GameState | undefined = undefined;
      // Init and switch to guided mode with zero line-clear delay
      state = reducerWithPipeline(
        state,
        createTestInitAction({ mode: "guided" }),
      );
      state = reducerWithPipeline(state, { mode: "guided", type: "SetMode" });
      state = reducerWithPipeline(state, {
        timing: { lineClearDelayMs: createDurationMs(0) },
        type: "UpdateTiming",
      });
      // Spawn next piece
      state = reducerWithPipeline(state, { type: "Spawn" } as Action);
      expect(state.active).toBeDefined();
      // Hard drop to trigger pending lock → pipeline commit → reset board
      const hardDrop: Action = {
        timestampMs: state.stats.startedAtMs,
        type: "HardDrop",
      };
      state = reducerWithPipeline(state, hardDrop);
      // After pipeline + reset, board should be empty (all zeros)
      const allZero = Array.from(state.board.cells).every((v) => v === 0);
      expect(allZero).toBe(true);
    } finally {
      // Restore console.error
      consoleSpy.mockRestore();
    }
  });
});
