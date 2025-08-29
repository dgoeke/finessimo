import {
  type GameState,
  type Action,
  createBoardCells,
} from "../../src/state/types";
import { createSeed, createGridCoord } from "../../src/types/brands";
import { createTimestamp, fromNow } from "../../src/types/timestamp";
import { reducerWithPipeline as reducer } from "../helpers/reducer-with-pipeline";
import { assertActivePiece, createTestSpawnAction } from "../test-helpers";
import { type InvalidGameState } from "../test-types";

describe("Reducer Edge Cases and Error Conditions", () => {
  let validState: GameState;
  let stateWithActivePiece: GameState;

  beforeEach(() => {
    validState = reducer(undefined, {
      seed: createSeed("test"),
      timestampMs: fromNow(),
      type: "Init",
    });

    // Create state with an active piece for testing actions that require one
    stateWithActivePiece = {
      ...validState,
      active: {
        id: "T",
        rot: "spawn",
        x: createGridCoord(4),
        y: createGridCoord(2),
      },
    };
  });

  describe("Actions without active piece", () => {
    it("should return unchanged state for Move action without active piece", () => {
      const action: Action = { dir: -1, optimistic: false, type: "TapMove" };
      const result = reducer(validState, action);
      expect(result).toBe(validState); // Same reference
    });

    it("should return unchanged state for Rotate action without active piece", () => {
      const action: Action = { dir: "CW", type: "Rotate" };
      const result = reducer(validState, action);
      expect(result).toBe(validState);
    });

    it("should return unchanged state for HardDrop action without active piece", () => {
      const action: Action = {
        timestampMs: createTimestamp(1000),
        type: "HardDrop",
      };
      const result = reducer(validState, action);
      expect(result).toBe(validState);
    });

    it("should return unchanged state for SoftDrop action without active piece", () => {
      const softDropOnAction: Action = { on: true, type: "SoftDrop" };
      const softDropOffAction: Action = { on: false, type: "SoftDrop" };

      expect(reducer(validState, softDropOnAction)).toBe(validState);
      expect(reducer(validState, softDropOffAction)).toBe(validState);
    });

    it("should return unchanged state for Hold action without active piece", () => {
      const action: Action = { type: "Hold" };
      const result = reducer(validState, action);
      expect(result).toBe(validState);
    });
  });

  describe("Hold action edge cases", () => {
    it("should return unchanged state when hold is not allowed", () => {
      const stateWithNoHold = {
        ...stateWithActivePiece,
        canHold: false,
      };

      const action: Action = { type: "Hold" };
      const result = reducer(stateWithNoHold, action);
      expect(result).toBe(stateWithNoHold);
    });
  });

  describe("Move action edge cases", () => {
    it("should handle DAS movement source", () => {
      const action: Action = { dir: -1, type: "HoldMove" };
      const result = reducer(stateWithActivePiece, action);

      expect(result).not.toBe(stateWithActivePiece);
      assertActivePiece(stateWithActivePiece);
      expect(result.active?.x).toBeLessThan(stateWithActivePiece.active.x);
    });

    it("should handle invalid movement (blocked)", () => {
      // Create a piece at the edge that can't move further
      const edgeState = {
        ...stateWithActivePiece,
        active: {
          id: "T" as const,
          rot: "spawn" as const,
          x: createGridCoord(0), // At left edge, can't move further left
          y: createGridCoord(2),
        },
      };

      const action: Action = { dir: -1, optimistic: false, type: "TapMove" };
      const result = reducer(edgeState, action);
      expect(result).toBe(edgeState); // No movement possible
    });
  });

  describe("Rotate action edge cases", () => {
    it("should handle blocked rotation", () => {
      // Create a board with blocks that prevent rotation
      const blockedBoard = { ...validState.board };
      blockedBoard.cells = createBoardCells();

      // Fill area around piece to block rotation
      for (let x = 3; x <= 6; x++) {
        for (let y = 1; y <= 4; y++) {
          if (!(x === 4 && y === 2)) {
            // Don't block piece center
            const idx = y * 10 + x;
            if (idx >= 0 && idx < 200) {
              blockedBoard.cells[idx] = 1;
            }
          }
        }
      }

      const blockedState = {
        ...stateWithActivePiece,
        board: blockedBoard,
      };

      const action: Action = { dir: "CW", type: "Rotate" };
      const result = reducer(blockedState, action);
      expect(result).toBe(blockedState); // Rotation blocked
    });
  });

  describe("SoftDrop action edge cases", () => {
    it("should handle soft drop when piece cannot move down", () => {
      // Create a piece at the bottom
      const bottomState = {
        ...stateWithActivePiece,
        active: {
          id: "T" as const,
          rot: "spawn" as const,
          x: createGridCoord(4),
          y: createGridCoord(18), // At bottom
        },
      };

      const action: Action = { on: true, type: "SoftDrop" };
      const result = reducer(bottomState, action);

      // Should return new state even if piece can't move
      expect(result.active).toEqual(bottomState.active);
    });

    it("should handle soft drop off", () => {
      const action: Action = { on: false, type: "SoftDrop" };
      const result = reducer(stateWithActivePiece, action);

      // New physics system updates soft drop state
      expect(result).not.toBe(stateWithActivePiece); // State changes to track physics
      expect(result.physics.isSoftDropping).toBe(false);
      expect(result.active).toEqual(stateWithActivePiece.active); // But piece unchanged
    });
  });

  describe("HardDrop with line clearing", () => {
    it("should handle hard drop that completes lines", () => {
      // Create a board with almost complete lines
      const boardWithAlmostCompleteLine = { ...validState.board };
      boardWithAlmostCompleteLine.cells = createBoardCells();

      // Fill bottom row except for one column where T-piece will land
      for (let x = 0; x < 10; x++) {
        if (x !== 4 && x !== 5 && x !== 6) {
          // Leave space for T-piece
          boardWithAlmostCompleteLine.cells[19 * 10 + x] = 1;
        }
      }

      const almostCompleteState = {
        ...stateWithActivePiece,
        active: {
          id: "T" as const,
          rot: "spawn" as const,
          x: createGridCoord(4),
          y: createGridCoord(0), // High up so it drops
        },
        board: boardWithAlmostCompleteLine,
      };

      const action: Action = {
        timestampMs: createTimestamp(1000),
        type: "HardDrop",
      };
      const result = reducer(almostCompleteState, action);

      expect(result.active).toBeUndefined(); // Piece should be locked
      expect(result.canHold).toBe(true); // Should reset hold
    });
  });

  describe("Invalid or malformed states", () => {
    it("should handle Lock action with invalid state structure", () => {
      const invalidState: InvalidGameState = {
        ...validState,
      };
      // Remove the tick property to make it invalid
      delete invalidState.tick;

      const action: Action = {
        timestampMs: fromNow(),
        type: "Lock",
      };
      const result = reducer(invalidState as GameState, action);
      expect(result).toBe(invalidState); // Should return unchanged
    });

    it("should handle Tick action with invalid state structure", () => {
      const invalidState: InvalidGameState = {
        ...validState,
        tick: "invalid" as unknown as number, // Invalid tick
      };

      const action: Action = {
        timestampMs: createTimestamp(1),
        type: "Tick",
      };
      const result = reducer(invalidState as GameState, action);
      expect(result).toBe(invalidState); // Should return unchanged
    });
  });

  describe("ClearLines action", () => {
    it("should clear specified lines from board", () => {
      // Create a board with some content
      const boardWithContent = { ...validState.board };
      boardWithContent.cells = createBoardCells();

      // Fill some rows
      for (let x = 0; x < 10; x++) {
        boardWithContent.cells[18 * 10 + x] = 1; // Row 18
        boardWithContent.cells[19 * 10 + x] = 2; // Row 19
      }

      const stateWithContent = {
        ...validState,
        board: boardWithContent,
      };

      const action: Action = { lines: [19], type: "ClearLines" };
      const result = reducer(stateWithContent, action);

      expect(result.board).not.toBe(stateWithContent.board);
      expect(result.board.cells[19 * 10 + 0]).toBe(1); // Row 18 moved to 19
    });

    it("should handle empty lines array", () => {
      const action: Action = { lines: [], type: "ClearLines" };
      const result = reducer(validState, action);
      expect(result.board).toBe(validState.board); // Same reference when no lines
    });
  });

  describe("Spawn action", () => {
    it("should spawn piece when game is playing", () => {
      const action: Action = createTestSpawnAction();
      const result = reducer(validState, action);

      // Spawn is now implemented
      expect(result).not.toBe(validState);
      expect(result.active).toBeDefined(); // Should spawn a piece
      assertActivePiece(result);
      expect(result.active.id).toBe(validState.nextQueue[0]); // First from queue
    });
  });
});
