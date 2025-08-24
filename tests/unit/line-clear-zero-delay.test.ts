import { describe, it, expect } from "@jest/globals";
import { reducer } from "../../src/state/reducer";
import { GameState, Board, idx } from "../../src/state/types";

// Helper to create game state with zero line clear delay
function createTestState(): GameState {
  return reducer(undefined, {
    type: "Init",
    seed: "test",
    timing: {
      gravityEnabled: true,
      gravityMs: 1000,
      lockDelayMs: 500,
      lineClearDelayMs: 0, // Zero delay for immediate clearing
    },
  });
}

// Helper to create a board with almost-completed line
function createBoardWithAlmostCompletedLines(): Board {
  const cells = new Uint8Array(200);

  // Fill only the bottom row, leaving gaps for O piece
  for (let x = 0; x < 10; x++) {
    if (x !== 4 && x !== 5) {
      // Leave gaps at x=4,5 for O piece
      cells[idx(x, 19)] = 1;
    }
  }

  return {
    width: 10,
    height: 20,
    cells,
  };
}

describe("line clear with zero delay", () => {
  it("should clear lines immediately on auto-lock when lineClearDelayMs is 0", () => {
    const state = createTestState();

    const boardWithGaps = createBoardWithAlmostCompletedLines();

    // Set up state with almost completed lines and active piece that will complete them
    const stateWithBoard: GameState = {
      ...state,
      board: boardWithGaps,
      active: {
        id: "O", // Use O piece which is simpler - 2x2 square
        x: 3, // Position so cells land at x=4,5
        y: 18, // Position so cells land at y=18,19
        rot: "spawn", // O piece same in all rotations
      },
      physics: {
        ...state.physics,
        lockDelayStartTime: 1000, // Already in lock delay
        lastGravityTime: 0,
      },
    };

    // Trigger auto-lock with Tick after lock delay expires
    const newState = reducer(stateWithBoard, {
      type: "Tick",
      timestampMs: 1500 + 500, // Past lock delay
    });

    // Lines should be cleared immediately
    expect(newState.status).toBe("playing");
    expect(newState.active).toBeUndefined();
    expect(newState.physics.lineClearStartTime).toBeNull();
    expect(newState.physics.lineClearLines).toEqual([]);

    // Check that the line was cleared correctly
    // The O piece had cells at (4,18), (5,18), (4,19), (5,19)
    // Line 19 was completed and cleared
    // The upper part of the O piece at y=18 should have dropped to y=19
    expect(newState.board.cells[idx(4, 19)]).toBeGreaterThan(0); // O piece remnant
    expect(newState.board.cells[idx(5, 19)]).toBeGreaterThan(0); // O piece remnant

    // All other positions should be empty
    for (let x = 0; x < 10; x++) {
      if (x !== 4 && x !== 5) {
        expect(newState.board.cells[idx(x, 19)]).toBe(0);
      }
    }

    // Row 18 should be completely empty now
    for (let x = 0; x < 10; x++) {
      expect(newState.board.cells[idx(x, 18)]).toBe(0);
    }
  });

  it("should clear lines immediately on HardDrop when lineClearDelayMs is 0", () => {
    const state = createTestState();

    const stateWithBoard: GameState = {
      ...state,
      board: createBoardWithAlmostCompletedLines(),
      active: {
        id: "O",
        x: 3,
        y: 10, // High up, will drop down
        rot: "spawn",
      },
    };

    const newState = reducer(stateWithBoard, {
      type: "HardDrop",
    });

    // Lines should be cleared immediately
    expect(newState.status).toBe("playing");
    expect(newState.active).toBeUndefined();
    expect(newState.physics.lineClearStartTime).toBeNull();
    expect(newState.physics.lineClearLines).toEqual([]);

    // Check that the line was cleared correctly
    // Similar to the auto-lock test - O piece remnants should remain after line clear
    expect(newState.board.cells[idx(4, 19)]).toBeGreaterThan(0); // O piece remnant
    expect(newState.board.cells[idx(5, 19)]).toBeGreaterThan(0); // O piece remnant

    // All other positions should be empty
    for (let x = 0; x < 10; x++) {
      if (x !== 4 && x !== 5) {
        expect(newState.board.cells[idx(x, 19)]).toBe(0);
      }
    }
  });
});
