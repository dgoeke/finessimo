import { describe, it, expect } from "@jest/globals";
import { calculateGhostPosition } from "../../src/core/board";
import { Board, ActivePiece } from "../../src/state/types";

// Helper to create a test board
function createTestBoard(): Board {
  return {
    width: 10,
    height: 20,
    cells: new Uint8Array(200),
  };
}

describe("ghost piece", () => {
  describe("calculateGhostPosition", () => {
    it("should drop piece to bottom of empty board", () => {
      const board = createTestBoard();
      const piece: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: 3,
        y: -2,
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
        board.cells[19 * 10 + x] = 1; // Fill bottom row
        board.cells[18 * 10 + x] = 1; // Fill second-to-bottom row
      }

      const piece: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: 3,
        y: 5,
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
        x: 4,
        y: 18, // Already at bottom
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
        x: 5,
        y: 0,
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
          board.cells[17 * 10 + x] = 1;
          board.cells[18 * 10 + x] = 1;
          board.cells[19 * 10 + x] = 1;
        }
      }

      const piece: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: 3,
        y: 5,
      };

      const ghostPosition = calculateGhostPosition(board, piece);

      expect(ghostPosition.x).toBe(3);
      expect(ghostPosition.y).toBe(18); // T piece can fit on top of the gap
    });
  });
});
