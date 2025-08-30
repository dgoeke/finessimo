import { describe, it, expect } from "@jest/globals";

import {
  type GameState,
  type Board,
  idx,
  createBoardCells,
  buildPlayingState,
} from "../../src/state/types";
import {
  createSeed,
  createGridCoord,
  createDurationMs,
} from "../../src/types/brands";
import { createTimestamp, fromNow } from "../../src/types/timestamp";
import { reducerWithPipeline as reducer } from "../helpers/reducer-with-pipeline";

function createTestState(): GameState {
  return reducer(undefined, {
    seed: createSeed("test"),
    timestampMs: fromNow(),
    timing: {
      gravityEnabled: true,
      gravityMs: createDurationMs(1000),
      lockDelayMs: createDurationMs(500),
    },
    type: "Init",
  });
}

// Create a board that prevents piece from moving down from negative y position
function createAlmostFullBoard(): Board {
  const cells = createBoardCells();

  // Fill the board completely from row 0 down, except for exactly the T piece spawn footprint
  // T piece at (4, -1) with spawn rotation has cells: [1,0],[0,1],[1,1],[2,1]
  // Absolute positions would be: (5,-1), (4,0), (5,0), (6,0)
  // We need to block positions that would prevent the piece from moving down to y=0
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 10; x++) {
      // Leave spaces for the T piece footprint at y=0, but fill everything below
      if (y === 0 && (x === 4 || x === 5 || x === 6)) {
        // Block these positions so piece can't move down
        cells[idx(createGridCoord(x), createGridCoord(y), 10)] = 1;
      } else if (y > 0) {
        cells[idx(createGridCoord(x), createGridCoord(y), 10)] = 1;
      }
    }
  }

  return {
    cells,
    height: 20,
    width: 10,
  };
}

describe("top-out detection", () => {
  it("should detect top-out when piece locks with cells at y < 0", () => {
    const state = createTestState();

    // Create state where piece will be forced to lock at y < 0
    const stateWithFullBoard = buildPlayingState(
      {
        ...state,
        board: createAlmostFullBoard(),
        physics: {
          ...state.physics,
          lastGravityTime: createTimestamp(1000),
          lockDelay: {
            resets: 0,
            start: createTimestamp(1000),
            tag: "Grounded",
          },
        },
      },
      {
        active: {
          id: "T",
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(-1), // Piece position above visible board
        },
      },
    );

    // Trigger auto-lock
    const newState = reducer(stateWithFullBoard, {
      timestampMs: createTimestamp(1500 + 500),
      type: "Tick",
    });

    expect(newState.status).toBe("topOut");
    expect(newState.active).toBeUndefined();
  });

  it("should detect top-out on HardDrop when piece would lock above board", () => {
    const state = createTestState();

    // Use the same almost full board that prevents movement
    const stateWithFullBoard = buildPlayingState(
      {
        ...state,
        board: createAlmostFullBoard(),
      },
      {
        active: {
          id: "T",
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(-2), // T-piece high above board
        },
      },
    );

    const newState = reducer(stateWithFullBoard, {
      timestampMs: createTimestamp(1000),
      type: "HardDrop",
    });

    expect(newState.status).toBe("topOut");
    expect(newState.active).toBeUndefined();
  });

  it("should not top-out when piece locks entirely within visible board", () => {
    const state = createTestState();

    // Create state with piece that can lock safely
    const safeState = buildPlayingState(
      {
        ...state,
        physics: {
          ...state.physics,
          lastGravityTime: createTimestamp(1000),
          lockDelay: {
            resets: 0,
            start: createTimestamp(1000),
            tag: "Grounded",
          },
        },
      },
      {
        active: {
          id: "T",
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(18), // Safe position within board
        },
      },
    );

    const newState = reducer(safeState, {
      timestampMs: createTimestamp(1500 + 500),
      type: "Tick",
    });

    expect(newState.status).toBe("playing");
    expect(newState.active).toBeUndefined();
  });
});
