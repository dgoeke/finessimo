import { describe, it, expect } from "@jest/globals";
import { reducer } from "../../src/state/reducer";
import { GameState, Board, idx } from "../../src/state/types";
import { createTimestamp } from "../../src/types/timestamp";

function createTestState(): GameState {
  return reducer(undefined, {
    type: "Init",
    seed: "test",
    timing: {
      gravityEnabled: true,
      gravityMs: 1000,
      lockDelayMs: 500,
    },
  });
}

// Create a board that prevents piece from moving down from negative y position
function createAlmostFullBoard(): Board {
  const cells = new Uint8Array(200);

  // Fill the board completely from row 0 down, except for exactly the T piece spawn footprint
  // T piece at (4, -1) with spawn rotation has cells: [1,0],[0,1],[1,1],[2,1]
  // Absolute positions would be: (5,-1), (4,0), (5,0), (6,0)
  // We need to block positions that would prevent the piece from moving down to y=0
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 10; x++) {
      // Leave spaces for the T piece footprint at y=0, but fill everything below
      if (y === 0 && (x === 4 || x === 5 || x === 6)) {
        // Block these positions so piece can't move down
        cells[idx(x, y)] = 1;
      } else if (y > 0) {
        cells[idx(x, y)] = 1;
      }
    }
  }

  return {
    width: 10,
    height: 20,
    cells,
  };
}

describe("top-out detection", () => {
  it("should detect top-out when piece locks with cells at y < 0", () => {
    const state = createTestState();

    // Create state where piece will be forced to lock at y < 0
    const stateWithFullBoard: GameState = {
      ...state,
      board: createAlmostFullBoard(),
      active: {
        id: "T",
        x: 4,
        y: -1, // Piece position above visible board
        rot: "spawn",
      },
      physics: {
        ...state.physics,
        lockDelayStartTime: 1000,
        lastGravityTime: 0,
      },
    };

    // Trigger auto-lock
    const newState = reducer(stateWithFullBoard, {
      type: "Tick",
      timestampMs: createTimestamp(1500 + 500),
    });

    expect(newState.status).toBe("topOut");
    expect(newState.active).toBeUndefined();
  });

  it("should detect top-out on HardDrop when piece would lock above board", () => {
    const state = createTestState();

    // Use the same almost full board that prevents movement
    const stateWithFullBoard: GameState = {
      ...state,
      board: createAlmostFullBoard(),
      active: {
        id: "T",
        x: 4,
        y: -2, // T-piece high above board
        rot: "spawn",
      },
    };

    const newState = reducer(stateWithFullBoard, {
      type: "HardDrop",
      timestampMs: createTimestamp(1000),
    });

    expect(newState.status).toBe("topOut");
    expect(newState.active).toBeUndefined();
  });

  it("should not top-out when piece locks entirely within visible board", () => {
    const state = createTestState();

    // Create state with piece that can lock safely
    const safeState: GameState = {
      ...state,
      active: {
        id: "T",
        x: 4,
        y: 18, // Safe position within board
        rot: "spawn",
      },
      physics: {
        ...state.physics,
        lockDelayStartTime: 1000,
        lastGravityTime: 0,
      },
    };

    const newState = reducer(safeState, {
      type: "Tick",
      timestampMs: createTimestamp(1500 + 500),
    });

    expect(newState.status).toBe("playing");
    expect(newState.active).toBeUndefined();
  });
});
