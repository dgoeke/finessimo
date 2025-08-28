import { describe, it, expect } from "@jest/globals";

import { shouldCompleteLineClear } from "../../src/app";
import {
  type GameState,
  type Board,
  idx,
  createBoardCells,
} from "../../src/state/types";
import {
  createSeed,
  createDurationMs,
  createGridCoord,
} from "../../src/types/brands";
import { createTimestamp, fromNow } from "../../src/types/timestamp";
import { reducerWithPipeline } from "../helpers/reducer-with-pipeline";

function createStateWithDelay(delayMs: number): GameState {
  return reducerWithPipeline(undefined, {
    seed: createSeed("lc-delay-test"),
    timestampMs: fromNow(),
    timing: {
      gravityEnabled: false,
      gravityMs: createDurationMs(1000),
      lineClearDelayMs: createDurationMs(delayMs),
      lockDelayMs: createDurationMs(500),
    },
    type: "Init",
  });
}

function boardWithBottomGaps(): Board {
  const cells = createBoardCells();
  for (let x = 0; x < 10; x++) {
    if (x !== 4 && x !== 5)
      cells[idx(createGridCoord(x), createGridCoord(19), 10)] = 1;
  }
  return { cells, height: 20, width: 10 };
}

describe("line clear with non-zero delay", () => {
  it("HardDrop properly sets lineClearStartTime to valid timestamp and app completes after delay", () => {
    const state = createStateWithDelay(200);
    const s1: GameState = {
      ...state,
      active: {
        id: "O",
        rot: "spawn",
        x: createGridCoord(3),
        y: createGridCoord(10),
      },
      board: boardWithBottomGaps(),
      // lastGravityTime remains 0 since gravity is disabled
    };

    const afterDrop = reducerWithPipeline(s1, {
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
    const completed = reducerWithPipeline(afterDrop, {
      type: "CompleteLineClear",
    });
    expect(completed.status).toBe("playing");
    expect(completed.physics.lineClearStartTime).toBeNull();
    expect(completed.physics.lineClearLines).toEqual([]);

    // Bottom row should only contain the O remnant at x=4,5
    for (let x = 0; x < 10; x++) {
      if (x === 4 || x === 5) {
        expect(
          completed.board.cells[
            idx(createGridCoord(x), createGridCoord(19), 10)
          ],
        ).toBeGreaterThan(0);
      } else {
        expect(
          completed.board.cells[
            idx(createGridCoord(x), createGridCoord(19), 10)
          ],
        ).toBe(0);
      }
    }
  });
});
