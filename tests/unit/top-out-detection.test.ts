import { describe, it, expect } from "@jest/globals";

import { isTopOut } from "../../src/core/spawning";
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
      const blockAtSpawnRow = y === 0 && (x === 4 || x === 5 || x === 6);
      if (blockAtSpawnRow || y > 0) {
        // Block these positions so piece can't move down
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

  it("should detect top-out when spawn rows are occupied", () => {
    const board: Board = {
      cells: createBoardCells(),
      height: 20,
      width: 10,
    };

    // Block spawn area in top row
    for (let x = 3; x < 7; x++) {
      board.cells[idx(createGridCoord(x), createGridCoord(0), 10)] = 1;
    }
    expect(isTopOut(board, "T")).toBe(true);

    // Block spawn area in second row
    const board2: Board = {
      cells: createBoardCells(),
      height: 20,
      width: 10,
    };
    for (let x = 3; x < 7; x++) {
      board2.cells[idx(createGridCoord(x), createGridCoord(1), 10)] = 1;
    }
    expect(isTopOut(board2, "T")).toBe(true);
  });

  it("should not false top-out when blocks are adjacent but not within piece footprint", () => {
    // This test verifies the fix for the spawn collision check issue
    // where blocks adjacent to but not within the piece spawn footprint 
    // were causing false top-outs
    
    const board: Board = {
      cells: createBoardCells(),
      height: 20,
      width: 10,
    };

    // T piece spawns at (3, -2) and has spawn cells at relative positions:
    // [1,0], [0,1], [1,1], [2,1] 
    // So absolute positions are: (4,-2), (3,-1), (4,-1), (5,-1)
    // When checking spawn buffer (y >= 0), only (3,0), (4,0), (5,0) would be checked
    
    // Block column 6 in the top row - this should NOT cause a false top-out
    // since the T piece only occupies columns 3-5 at spawn
    board.cells[idx(createGridCoord(6), createGridCoord(0), 10)] = 1;
    expect(isTopOut(board, "T")).toBe(false);
    
    // Similarly for column 2
    board.cells[idx(createGridCoord(2), createGridCoord(0), 10)] = 1;
    expect(isTopOut(board, "T")).toBe(false);
    
    // But blocking the actual spawn footprint should still cause top-out
    board.cells[idx(createGridCoord(4), createGridCoord(0), 10)] = 1;
    expect(isTopOut(board, "T")).toBe(true);
  });
});
