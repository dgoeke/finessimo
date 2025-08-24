import { describe, it, expect } from "@jest/globals";
import { reducer } from "../../src/state/reducer";
import { GameState, Board, idx } from "../../src/state/types";
import { shouldCompleteLineClear } from "../../src/app";

function createStateWithDelay(delayMs: number): GameState {
  return reducer(undefined, {
    type: "Init",
    seed: "lc-delay-test",
    timing: {
      gravityEnabled: false,
      gravityMs: 1000,
      lockDelayMs: 500,
      lineClearDelayMs: delayMs,
    },
  });
}

function boardWithBottomGaps(): Board {
  const cells = new Uint8Array(200);
  for (let x = 0; x < 10; x++) {
    if (x !== 4 && x !== 5) cells[idx(x, 19)] = 1;
  }
  return { width: 10, height: 20, cells };
}

describe("line clear with non-zero delay", () => {
  it("HardDrop sets lineClearStartTime to 0 (falsy) and app still completes after delay", () => {
    const state = createStateWithDelay(200);
    const s1: GameState = {
      ...state,
      board: boardWithBottomGaps(),
      active: { id: "O", x: 3, y: 10, rot: "spawn" },
      // lastGravityTime remains 0 since gravity is disabled
    };

    const afterDrop = reducer(s1, { type: "HardDrop" });
    expect(afterDrop.status).toBe("lineClear");
    // Regression guard: previously app checked truthiness; 0 is valid and must be handled
    expect(afterDrop.physics.lineClearStartTime).toBe(0);

    // App helper should complete when enough time has elapsed
    expect(shouldCompleteLineClear(afterDrop, 100)).toBe(false);
    expect(shouldCompleteLineClear(afterDrop, 250)).toBe(true);

    // Completing clears lines and returns to playing
    const completed = reducer(afterDrop, { type: "CompleteLineClear" });
    expect(completed.status).toBe("playing");
    expect(completed.physics.lineClearStartTime).toBeNull();
    expect(completed.physics.lineClearLines).toEqual([]);

    // Bottom row should only contain the O remnant at x=4,5
    for (let x = 0; x < 10; x++) {
      if (x === 4 || x === 5) {
        expect(completed.board.cells[idx(x, 19)]).toBeGreaterThan(0);
      } else {
        expect(completed.board.cells[idx(x, 19)]).toBe(0);
      }
    }
  });
});
