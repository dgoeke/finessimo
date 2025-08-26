import { describe, it, expect } from "@jest/globals";

import { shouldCompleteLineClear } from "../../src/app";
import { reducer } from "../../src/state/reducer";
import { type GameState, type Board, idx } from "../../src/state/types";
import { createTimestamp } from "../../src/types/timestamp";

function createStateWithDelay(delayMs: number): GameState {
  return reducer(undefined, {
    seed: "lc-delay-test",
    timing: {
      gravityEnabled: false,
      gravityMs: 1000,
      lineClearDelayMs: delayMs,
      lockDelayMs: 500,
    },
    type: "Init",
  });
}

function boardWithBottomGaps(): Board {
  const cells = new Uint8Array(200);
  for (let x = 0; x < 10; x++) {
    if (x !== 4 && x !== 5) cells[idx(x, 19)] = 1;
  }
  return { cells, height: 20, width: 10 };
}

describe("line clear with non-zero delay", () => {
  it("HardDrop properly sets lineClearStartTime to valid timestamp and app completes after delay", () => {
    const state = createStateWithDelay(200);
    const s1: GameState = {
      ...state,
      active: { id: "O", rot: "spawn", x: 3, y: 10 },
      board: boardWithBottomGaps(),
      // lastGravityTime remains 0 since gravity is disabled
    };

    const afterDrop = reducer(s1, {
      timestampMs: createTimestamp(1000),
      type: "HardDrop",
    });
    expect(afterDrop.status).toBe("lineClear");
    // lineClearStartTime should be set to current timestamp
    expect(afterDrop.physics.lineClearStartTime).toBeGreaterThan(0);

    // App helper should complete when enough time has elapsed
    expect(afterDrop.physics.lineClearStartTime).not.toBeNull();
    const clearStartTime = afterDrop.physics.lineClearStartTime as number;
    expect(shouldCompleteLineClear(afterDrop, clearStartTime + 100)).toBe(
      false,
    );
    expect(shouldCompleteLineClear(afterDrop, clearStartTime + 250)).toBe(true);

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
