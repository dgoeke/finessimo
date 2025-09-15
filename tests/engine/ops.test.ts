import {
  type PieceId,
  createBoardCells,
  createGridCoord,
  idx,
  createCellValue,
} from "@/engine/core/types";
import {
  withBoard,
  withQueue,
  forceActive,
  addGarbage,
  clearHold,
} from "@/engine/ops";

import {
  createTestGameState,
  createTestPiece,
  setBoardCell,
} from "../test-helpers";

describe("@/engine/ops — pure state transformations for mode control", () => {
  describe("withBoard()", () => {
    test("replaces the entire board with provided cells", () => {
      const state = createTestGameState();
      const newCells = createBoardCells();

      // Set some test values in the new cells
      newCells[0] = createCellValue(1); // I piece in vanish zone
      newCells[100] = createCellValue(2); // O piece in visible area

      const op = withBoard(newCells);
      const result = op(state);

      // Should replace board cells
      expect(result.board.cells).toBe(newCells);
      expect(result.board.cells[0]).toBe(1);
      expect(result.board.cells[100]).toBe(2);

      // Should preserve board structure
      expect(result.board.width).toBe(10);
      expect(result.board.height).toBe(20);
      expect(result.board.totalHeight).toBe(23);
      expect(result.board.vanishRows).toBe(3);

      // Should preserve other state properties
      expect(result.queue).toBe(state.queue);
      expect(result.piece).toBe(state.piece);
      expect(result.hold).toBe(state.hold);
      expect(result.physics).toBe(state.physics);
      expect(result.rng).toBe(state.rng);
      expect(result.tick).toBe(state.tick);

      // Original state should be unchanged (immutability)
      expect(state.board.cells).not.toBe(newCells);
    });

    test("creates new board instance with correct structure", () => {
      const state = createTestGameState();
      const newCells = createBoardCells();
      const op = withBoard(newCells);
      const result = op(state);

      // Should create new board instance
      expect(result.board).not.toBe(state.board);
      expect(result.board.cells).toBe(newCells);

      // Should have correct board dimensions
      expect(result.board.width).toBe(10);
      expect(result.board.height).toBe(20);
      expect(result.board.vanishRows).toBe(3);
      expect(result.board.totalHeight).toBe(23);
    });
  });

  describe("withQueue()", () => {
    test("replaces the queue with specified sequence", () => {
      const state = createTestGameState();
      const newQueue: ReadonlyArray<PieceId> = [
        "I",
        "O",
        "T",
        "S",
        "Z",
        "J",
        "L",
      ];

      const op = withQueue(newQueue);
      const result = op(state);

      // Should replace queue
      expect(result.queue).toEqual(newQueue);
      expect(result.queue).not.toBe(state.queue);

      // Should preserve other state properties
      expect(result.board).toBe(state.board);
      expect(result.piece).toBe(state.piece);
      expect(result.hold).toBe(state.hold);
      expect(result.physics).toBe(state.physics);
      expect(result.rng).toBe(state.rng);
      expect(result.tick).toBe(state.tick);
    });

    test("handles empty queue", () => {
      const state = createTestGameState();
      const emptyQueue: ReadonlyArray<PieceId> = [];

      const op = withQueue(emptyQueue);
      const result = op(state);

      expect(result.queue).toEqual([]);
      expect(result.queue.length).toBe(0);
    });

    test("handles single piece queue", () => {
      const state = createTestGameState();
      const singleQueue: ReadonlyArray<PieceId> = ["T"];

      const op = withQueue(singleQueue);
      const result = op(state);

      expect(result.queue).toEqual(["T"]);
      expect(result.queue.length).toBe(1);
    });

    test("creates new queue array (immutability)", () => {
      const state = createTestGameState();
      const newQueue: ReadonlyArray<PieceId> = ["I", "J"];

      const op = withQueue(newQueue);
      const result = op(state);

      // Should create new array, not reference same one
      expect(result.queue).not.toBe(newQueue);
      expect(result.queue).toEqual(newQueue);
    });
  });

  describe("forceActive()", () => {
    test("creates new active piece at spawn position", () => {
      const state = createTestGameState({ piece: null });

      const op = forceActive("T");
      const result = op(state);

      // Should create T piece at spawn
      expect(result.piece).not.toBeNull();
      if (result.piece) {
        expect(result.piece.id).toBe("T");
        expect(result.piece.rot).toBe("spawn");
      }

      // Should preserve other state properties
      expect(result.board).toBe(state.board);
      expect(result.queue).toBe(state.queue);
      expect(result.hold).toBe(state.hold);
      expect(result.physics).toBe(state.physics);
      expect(result.rng).toBe(state.rng);
      expect(result.tick).toBe(state.tick);
    });

    test("replaces existing piece with new one at spawn", () => {
      const existingPiece = createTestPiece("I", 5, 10, "right");
      const state = createTestGameState({ piece: existingPiece });

      const op = forceActive("O");
      const result = op(state);

      // Should replace with O piece at spawn
      expect(result.piece).not.toBe(existingPiece);
      if (result.piece) {
        expect(result.piece.id).toBe("O");
        expect(result.piece.rot).toBe("spawn");

        // Position should be spawn position, not the old piece position
        expect(result.piece.x).not.toBe(existingPiece.x);
        expect(result.piece.y).not.toBe(existingPiece.y);
      }
    });

    test("works with all piece types", () => {
      const state = createTestGameState({ piece: null });
      const pieceIds: ReadonlyArray<PieceId> = [
        "I",
        "O",
        "T",
        "S",
        "Z",
        "J",
        "L",
      ];

      for (const pieceId of pieceIds) {
        const op = forceActive(pieceId);
        const result = op(state);

        expect(result.piece).not.toBeNull();
        if (result.piece) {
          expect(result.piece.id).toBe(pieceId);
          expect(result.piece.rot).toBe("spawn");
        }
      }
    });
  });

  describe("addGarbage()", () => {
    test("adds single garbage row with hole", () => {
      const state = createTestGameState();
      const originalBoard = state.board;

      const op = addGarbage([3]); // Hole at column 3
      const result = op(state);

      // Should create new board
      expect(result.board).not.toBe(originalBoard);
      expect(result.board.cells).not.toBe(originalBoard.cells);

      // Check bottom row (y=19) has garbage with hole at column 3
      for (let x = 0; x < 10; x++) {
        const cellValue =
          result.board.cells[
            idx(result.board, createGridCoord(x), createGridCoord(19))
          ];
        if (x === 3) {
          expect(cellValue).toBe(0); // Hole
        } else {
          expect(cellValue).toBe(8); // Garbage
        }
      }

      // Should preserve other state properties
      expect(result.queue).toBe(state.queue);
      expect(result.piece).toBe(state.piece);
      expect(result.hold).toBe(state.hold);
      expect(result.physics).toBe(state.physics);
      expect(result.rng).toBe(state.rng);
      expect(result.tick).toBe(state.tick);
    });

    test("adds multiple garbage rows", () => {
      const state = createTestGameState();

      const op = addGarbage([2, 5, 8]); // Three rows with holes at columns 2, 5, 8
      const result = op(state);

      // Check bottom three rows have garbage with correct holes
      // When adding [2, 5, 8]: first 2 goes to bottom, then 5 pushes it up, then 8 pushes both up
      // Final order from bottom to top: 8, 5, 2

      // Bottom row (y=19) should have hole at column 8 (last row added)
      for (let x = 0; x < 10; x++) {
        const cellValue =
          result.board.cells[
            idx(result.board, createGridCoord(x), createGridCoord(19))
          ];
        expect(cellValue).toBe(x === 8 ? 0 : 8);
      }

      // Second from bottom (y=18) should have hole at column 5
      for (let x = 0; x < 10; x++) {
        const cellValue =
          result.board.cells[
            idx(result.board, createGridCoord(x), createGridCoord(18))
          ];
        expect(cellValue).toBe(x === 5 ? 0 : 8);
      }

      // Third from bottom (y=17) should have hole at column 2 (first row added, now at top)
      for (let x = 0; x < 10; x++) {
        const cellValue =
          result.board.cells[
            idx(result.board, createGridCoord(x), createGridCoord(17))
          ];
        expect(cellValue).toBe(x === 2 ? 0 : 8);
      }
    });

    test("shifts existing board content up", () => {
      // Create board with content in bottom row
      let state = createTestGameState();
      state = {
        ...state,
        board: setBoardCell(state.board, 0, 19, 1), // I piece at bottom left
      };

      const op = addGarbage([5]); // Hole at column 5
      const result = op(state);

      // Original bottom content should have moved up to y=18
      const shiftedCell =
        result.board.cells[
          idx(result.board, createGridCoord(0), createGridCoord(18))
        ];
      expect(shiftedCell).toBe(1);

      // New bottom row should be garbage with hole
      const bottomHole =
        result.board.cells[
          idx(result.board, createGridCoord(5), createGridCoord(19))
        ];
      const bottomGarbage =
        result.board.cells[
          idx(result.board, createGridCoord(0), createGridCoord(19))
        ];
      expect(bottomHole).toBe(0);
      expect(bottomGarbage).toBe(8);
    });

    test("handles empty garbage array", () => {
      const state = createTestGameState();

      const op = addGarbage([]);
      const result = op(state);

      // Should return unchanged state (same object reference for efficiency)
      expect(result).toBe(state);
      expect(result.board.cells).toBe(state.board.cells);
    });

    test("throws error for out of bounds hole column", () => {
      const state = createTestGameState();

      // Test negative column
      const negativeOp = addGarbage([-1]);
      expect(() => negativeOp(state)).toThrow(
        "Hole column -1 out of bounds [0, 9]",
      );

      // Test column >= width
      const tooLargeOp = addGarbage([10]);
      expect(() => tooLargeOp(state)).toThrow(
        "Hole column 10 out of bounds [0, 9]",
      );

      // Test way out of bounds
      const wayTooLargeOp = addGarbage([100]);
      expect(() => wayTooLargeOp(state)).toThrow(
        "Hole column 100 out of bounds [0, 9]",
      );
    });

    test("handles edge hole positions", () => {
      const state = createTestGameState();

      // Test leftmost hole
      const leftOp = addGarbage([0]);
      const leftResult = leftOp(state);

      const leftHole =
        leftResult.board.cells[
          idx(leftResult.board, createGridCoord(0), createGridCoord(19))
        ];
      const leftNonHole =
        leftResult.board.cells[
          idx(leftResult.board, createGridCoord(1), createGridCoord(19))
        ];
      expect(leftHole).toBe(0);
      expect(leftNonHole).toBe(8);

      // Test rightmost hole
      const rightOp = addGarbage([9]);
      const rightResult = rightOp(state);

      const rightHole =
        rightResult.board.cells[
          idx(rightResult.board, createGridCoord(9), createGridCoord(19))
        ];
      const rightNonHole =
        rightResult.board.cells[
          idx(rightResult.board, createGridCoord(8), createGridCoord(19))
        ];
      expect(rightHole).toBe(0);
      expect(rightNonHole).toBe(8);
    });
  });

  describe("clearHold()", () => {
    test("clears existing hold piece", () => {
      const state = createTestGameState({
        hold: { piece: "I", usedThisTurn: true },
      });

      const op = clearHold();
      const result = op(state);

      // Should clear hold
      expect(result.hold.piece).toBeNull();
      expect(result.hold.usedThisTurn).toBe(false);

      // Should preserve other state properties
      expect(result.board).toBe(state.board);
      expect(result.queue).toBe(state.queue);
      expect(result.piece).toBe(state.piece);
      expect(result.physics).toBe(state.physics);
      expect(result.rng).toBe(state.rng);
      expect(result.tick).toBe(state.tick);
    });

    test("handles already empty hold", () => {
      const state = createTestGameState({
        hold: { piece: null, usedThisTurn: false },
      });

      const op = clearHold();
      const result = op(state);

      // Should still be clear
      expect(result.hold.piece).toBeNull();
      expect(result.hold.usedThisTurn).toBe(false);
    });

    test("resets usedThisTurn flag", () => {
      const state = createTestGameState({
        hold: { piece: null, usedThisTurn: true },
      });

      const op = clearHold();
      const result = op(state);

      expect(result.hold.piece).toBeNull();
      expect(result.hold.usedThisTurn).toBe(false);
    });
  });

  describe("EngineOp composition", () => {
    test("multiple ops can be composed", () => {
      const state = createTestGameState();

      // Compose multiple operations
      const queue: ReadonlyArray<PieceId> = ["T", "I", "O"];
      const composed = (s: typeof state) => {
        const withNewQueue = withQueue(queue)(s);
        const withActivePiece = forceActive("J")(withNewQueue);
        const withClearedHold = clearHold()(withActivePiece);
        return addGarbage([4])(withClearedHold);
      };

      const result = composed(state);

      // Should apply all operations
      expect(result.queue).toEqual(queue);
      if (result.piece) {
        expect(result.piece.id).toBe("J");
      }
      expect(result.hold.piece).toBeNull();

      // Should have garbage at bottom
      const holeCell =
        result.board.cells[
          idx(result.board, createGridCoord(4), createGridCoord(19))
        ];
      const garbageCell =
        result.board.cells[
          idx(result.board, createGridCoord(0), createGridCoord(19))
        ];
      expect(holeCell).toBe(0);
      expect(garbageCell).toBe(8);
    });

    test("ops are pure functions (no side effects)", () => {
      const state = createTestGameState();
      const originalQueue = state.queue;
      const originalBoard = state.board;
      const originalHold = state.hold;

      // Apply operations
      withQueue(["T"])(state);
      forceActive("O")(state);
      addGarbage([3])(state);
      clearHold()(state);

      // Original state should be unchanged
      expect(state.queue).toBe(originalQueue);
      expect(state.board).toBe(originalBoard);
      expect(state.hold).toBe(originalHold);
    });
  });
});
