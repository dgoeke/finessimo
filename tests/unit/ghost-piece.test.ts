import { describe, it, expect } from "@jest/globals";

import { calculateGhostPosition } from "../../src/core/board";
import {
  type Board,
  type ActivePiece,
  createBoardCells,
  idx,
} from "../../src/state/types";
import { createGridCoord } from "../../src/types/brands";

// Helper to create a test board
function createTestBoard(): Board {
  return {
    cells: createBoardCells(),
    height: 20,
    totalHeight: 23,
    vanishRows: 3,
    width: 10,
  };
}

describe("ghost piece", () => {
  describe("calculateGhostPosition", () => {
    it("should drop piece to bottom of empty board", () => {
      const board = createTestBoard();
      const piece: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: createGridCoord(3),
        y: createGridCoord(-2),
      };

      const ghostPosition = calculateGhostPosition(board, piece);

      expect(ghostPosition.id).toBe("T");
      expect(ghostPosition.rot).toBe("spawn");
      expect(ghostPosition.x).toBe(3); // Same X position
      expect(ghostPosition.y).toBe(18); // Should drop to bottom (accounting for piece height)
    });

    it("should stop above existing pieces", () => {
      const board = createTestBoard();

      // Place some blocks at the bottom
      for (let x = 0; x < 10; x++) {
        board.cells[idx(board, createGridCoord(x), createGridCoord(19))] = 1; // Fill bottom row
        board.cells[idx(board, createGridCoord(x), createGridCoord(18))] = 1; // Fill second-to-bottom row
      }

      const piece: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: createGridCoord(3),
        y: createGridCoord(5),
      };

      const ghostPosition = calculateGhostPosition(board, piece);

      expect(ghostPosition.x).toBe(3);
      expect(ghostPosition.y).toBe(16); // Should stop above the filled rows
    });

    it("should handle piece already at bottom", () => {
      const board = createTestBoard();
      const piece: ActivePiece = {
        id: "O", // O piece is 2x2
        rot: "spawn",
        x: createGridCoord(4),
        y: createGridCoord(18), // Already at bottom
      };

      const ghostPosition = calculateGhostPosition(board, piece);

      expect(ghostPosition.x).toBe(4);
      expect(ghostPosition.y).toBe(18); // Should stay at same position
    });

    it("should work with rotated pieces", () => {
      const board = createTestBoard();
      const piece: ActivePiece = {
        id: "I",
        rot: "right", // Vertical I piece
        x: createGridCoord(5),
        y: createGridCoord(0),
      };

      const ghostPosition = calculateGhostPosition(board, piece);

      expect(ghostPosition.x).toBe(5);
      expect(ghostPosition.y).toBe(16); // I piece in right rotation has height 4
    });

    it("should handle complex board layout", () => {
      const board = createTestBoard();

      // Create a more complex board with gaps
      for (let x = 0; x < 10; x++) {
        if (x !== 3 && x !== 4 && x !== 5) {
          // Leave gap for T piece
          board.cells[idx(board, createGridCoord(x), createGridCoord(17))] = 1;
          board.cells[idx(board, createGridCoord(x), createGridCoord(18))] = 1;
          board.cells[idx(board, createGridCoord(x), createGridCoord(19))] = 1;
        }
      }

      const piece: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: createGridCoord(3),
        y: createGridCoord(5),
      };

      const ghostPosition = calculateGhostPosition(board, piece);

      expect(ghostPosition.x).toBe(3);
      expect(ghostPosition.y).toBe(18); // T piece can fit on top of the gap
    });
  });
});
