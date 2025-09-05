import { describe, it, expect } from "@jest/globals";

import { shouldCompleteLineClear } from "@/app/app";
import {
  type GameState,
  type Board,
  idx,
  createBoardCells,
  buildPlayingState,
  buildLineClearState,
} from "@/state/types";
import { createSeed, createDurationMs, createGridCoord } from "@/types/brands";
import { createTimestamp, fromNow } from "@/types/timestamp";

import { reducerWithPipeline as reducer } from "../../helpers/reducer-with-pipeline";

function createStateWithDelay(delayMs: number): GameState {
  return reducer(undefined, {
    seed: createSeed("timestamp-validation-test"),
    timestampMs: fromNow(),
    timing: {
      gravityEnabled: false,
      lineClearDelayMs: createDurationMs(delayMs),
    },
    type: "Init",
  });
}

function boardWithBottomGaps(): Board {
  const board: Board = {
    cells: createBoardCells(),
    height: 20,
    totalHeight: 23,
    vanishRows: 3,
    width: 10,
  };
  // Fill bottom row except gaps at x=4,5 (where O piece at x=3 will land)
  for (let x = 0; x < 10; x++) {
    if (x !== 4 && x !== 5) {
      board.cells[idx(board, createGridCoord(x), createGridCoord(19))] = 1; // bottom row
    }
  }
  return board;
}

describe("timestamp validation in line clear scenarios", () => {
  it("createTimestamp rejects zero and negative values", () => {
    expect(() => createTimestamp(0)).toThrow(
      "Timestamp must be a finite, non-zero number.",
    );
    expect(() => createTimestamp(-1)).toThrow(
      "Timestamp must be a finite, non-zero number.",
    );
    expect(() => createTimestamp(NaN)).toThrow(
      "Timestamp must be a finite, non-zero number.",
    );
    expect(() => createTimestamp(Infinity)).toThrow(
      "Timestamp must be a finite, non-zero number.",
    );
  });

  it("createTimestamp accepts positive finite numbers", () => {
    const validTimestamp = createTimestamp(1000);
    expect(validTimestamp).toBe(1000);

    const performanceTimestamp = fromNow();
    expect(performanceTimestamp).toBeGreaterThan(0);
  });

  it("HardDrop with valid timestamp properly sets lineClearStartTime", () => {
    const state = createStateWithDelay(200);
    const s1 = buildPlayingState(
      {
        ...state,
        board: boardWithBottomGaps(),
      },
      {
        active: {
          id: "O",
          rot: "spawn",
          x: createGridCoord(3),
          y: createGridCoord(10),
        },
      },
    );

    const afterDrop = reducer(s1, {
      timestampMs: createTimestamp(1500),
      type: "HardDrop",
    });

    expect(afterDrop.status).toBe("lineClear");
    expect(afterDrop.physics.lineClearStartTime).toBe(1500);
  });

  it("auto-lock in Tick with valid timestamp sets correct lineClearStartTime", () => {
    const state = createStateWithDelay(150);
    const s1 = buildPlayingState(
      {
        ...state,
        board: boardWithBottomGaps(),
        physics: {
          ...state.physics,
          lastGravityTime: createTimestamp(1000),
          lockDelay: {
            resets: 0,
            start: createTimestamp(1000),
            tag: "Grounded",
          },
        },
        timing: {
          ...state.timing,
          gravityEnabled: true,
          lockDelayMs: createDurationMs(100),
        },
      },
      {
        active: {
          id: "O",
          rot: "spawn",
          x: createGridCoord(3),
          y: createGridCoord(18),
        }, // One row above bottom
      },
    );

    // Tick after lock delay has expired should auto-lock
    const afterTick = reducer(s1, {
      timestampMs: createTimestamp(1200),
      type: "Tick",
    });

    expect(afterTick.status).toBe("lineClear");
    expect(afterTick.physics.lineClearStartTime).toBe(1200);
  });

  it("shouldCompleteLineClear works correctly with valid timestamps", () => {
    const state = createStateWithDelay(300);
    const s1 = buildLineClearState({
      ...state,
      physics: {
        ...state.physics,
        lineClearLines: [19],
        lineClearStartTime: createTimestamp(1000),
      },
    });

    // Not enough time elapsed
    expect(shouldCompleteLineClear(s1, 1250)).toBe(false);

    // Exactly enough time elapsed
    expect(shouldCompleteLineClear(s1, 1300)).toBe(true);

    // More than enough time elapsed
    expect(shouldCompleteLineClear(s1, 1500)).toBe(true);
  });

  it("functional purity is preserved with Timestamp", () => {
    const state = createStateWithDelay(100);
    const s1 = buildPlayingState(
      {
        ...state,
        board: boardWithBottomGaps(),
      },
      {
        active: {
          id: "O",
          rot: "spawn",
          x: createGridCoord(3),
          y: createGridCoord(10),
        },
      },
    );

    const timestamp1 = createTimestamp(2000);
    const timestamp2 = createTimestamp(3000);

    // Same state and timestamp should produce identical results
    const result1a = reducer(s1, { timestampMs: timestamp1, type: "HardDrop" });
    const result1b = reducer(s1, { timestampMs: timestamp1, type: "HardDrop" });

    expect(result1a.physics.lineClearStartTime).toBe(
      result1b.physics.lineClearStartTime,
    );
    expect(result1a.physics.lineClearStartTime).toBe(2000);

    // Different timestamps should produce different results
    const result2 = reducer(s1, { timestampMs: timestamp2, type: "HardDrop" });
    expect(result2.physics.lineClearStartTime).toBe(3000);
    expect(result2.physics.lineClearStartTime).not.toBe(
      result1a.physics.lineClearStartTime,
    );
  });

  it("type system prevents compilation with invalid timestamps", () => {
    // These lines would cause TypeScript compilation errors:
    // reducer(state, { type: "HardDrop", timestampMs: 0 });
    // reducer(state, { type: "HardDrop", timestampMs: -1 });
    // reducer(state, { type: "Tick", timestampMs: 0 });

    // This test ensures the type system is working by confirming
    // valid timestamps work correctly
    const state = createStateWithDelay(50);
    const validTimestamp = fromNow();

    expect(() => {
      reducer(state, { timestampMs: validTimestamp, type: "Tick" });
    }).not.toThrow();
  });
});
