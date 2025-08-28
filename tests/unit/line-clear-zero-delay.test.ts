import { describe, it, expect } from "@jest/globals";

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
import { reducerWithPipeline as reducer } from "../helpers/reducer-with-pipeline";

// Helper to create game state with zero line clear delay
function createTestState(): GameState {
  return reducer(undefined, {
    seed: createSeed("test"),
    timestampMs: fromNow(),
    timing: {
      gravityEnabled: true,
      gravityMs: createDurationMs(1000),
      lineClearDelayMs: createDurationMs(0), // Zero delay for immediate clearing
      lockDelayMs: createDurationMs(500),
    },
    type: "Init",
  });
}

// Helper to create a board with almost-completed line
function createBoardWithAlmostCompletedLines(): Board {
  const cells = createBoardCells();

  // Fill only the bottom row, leaving gaps for O piece
  for (let x = 0; x < 10; x++) {
    if (x !== 4 && x !== 5) {
      // Leave gaps at x=4,5 for O piece
      cells[idx(createGridCoord(x), createGridCoord(19), 10)] = 1;
    }
  }

  return {
    cells,
    height: 20,
    width: 10,
  };
}

describe("line clear with zero delay", () => {
  it("should clear lines immediately on auto-lock when lineClearDelayMs is 0", () => {
    const state = createTestState();

    const boardWithGaps = createBoardWithAlmostCompletedLines();

    // Set up state with almost completed lines and active piece that will complete them
    const stateWithBoard: GameState = {
      ...state,
      active: {
        id: "O", // Use O piece which is simpler - 2x2 square
        rot: "spawn", // O piece same in all rotations
        x: createGridCoord(3), // Position so cells land at x=4,5
        y: createGridCoord(18), // Position so cells land at y=18,19
      },
      board: boardWithGaps,
      physics: {
        ...state.physics,
        lastGravityTime: createTimestamp(1000),
        lockDelayStartTime: createTimestamp(1000), // Already in lock delay
      },
    };

    // Trigger auto-lock with Tick after lock delay expires
    const newState = reducer(stateWithBoard, {
      timestampMs: createTimestamp(1500 + 500), // Past lock delay
      type: "Tick",
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
    expect(
      newState.board.cells[idx(createGridCoord(4), createGridCoord(19), 10)],
    ).toBeGreaterThan(0); // O piece remnant
    expect(
      newState.board.cells[idx(createGridCoord(5), createGridCoord(19), 10)],
    ).toBeGreaterThan(0); // O piece remnant

    // All other positions should be empty
    for (let x = 0; x < 10; x++) {
      if (x !== 4 && x !== 5) {
        expect(
          newState.board.cells[
            idx(createGridCoord(x), createGridCoord(19), 10)
          ],
        ).toBe(0);
      }
    }

    // Row 18 should be completely empty now
    for (let x = 0; x < 10; x++) {
      expect(
        newState.board.cells[idx(createGridCoord(x), createGridCoord(18), 10)],
      ).toBe(0);
    }
  });

  it("should clear lines immediately on HardDrop when lineClearDelayMs is 0", () => {
    const state = createTestState();

    const stateWithBoard: GameState = {
      ...state,
      active: {
        id: "O",
        rot: "spawn",
        x: createGridCoord(3),
        y: createGridCoord(10), // High up, will drop down
      },
      board: createBoardWithAlmostCompletedLines(),
    };

    const newState = reducer(stateWithBoard, {
      timestampMs: createTimestamp(1000),
      type: "HardDrop",
    });

    // Lines should be cleared immediately
    expect(newState.status).toBe("playing");
    expect(newState.active).toBeUndefined();
    expect(newState.physics.lineClearStartTime).toBeNull();
    expect(newState.physics.lineClearLines).toEqual([]);

    // Check that the line was cleared correctly
    // Similar to the auto-lock test - O piece remnants should remain after line clear
    expect(
      newState.board.cells[idx(createGridCoord(4), createGridCoord(19), 10)],
    ).toBeGreaterThan(0); // O piece remnant
    expect(
      newState.board.cells[idx(createGridCoord(5), createGridCoord(19), 10)],
    ).toBeGreaterThan(0); // O piece remnant

    // All other positions should be empty
    for (let x = 0; x < 10; x++) {
      if (x !== 4 && x !== 5) {
        expect(
          newState.board.cells[
            idx(createGridCoord(x), createGridCoord(19), 10)
          ],
        ).toBe(0);
      }
    }
  });
});
