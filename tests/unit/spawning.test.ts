/* eslint-disable sonarjs/todo-tag */
import { describe, it, expect } from "@jest/globals";

import { canPlacePiece } from "../../src/core/board";
import {
  createActivePiece,
  canSpawnPiece,
  isTopOut,
  spawnWithHold,
} from "../../src/core/spawning";
import {
  type Board,
  type PieceId,
  createBoardCells,
  idx,
} from "../../src/state/types";
import { createGridCoord } from "../../src/types/brands";
import { assertDefined } from "../test-helpers";

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

describe("spawning", () => {
  describe("createActivePiece", () => {
    it("should create piece at spawn position", () => {
      const piece = createActivePiece("T");

      expect(piece.id).toBe("T");
      expect(piece.rot).toBe("spawn");
      expect(piece.x).toBe(3); // T piece spawn X
      expect(piece.y).toBe(-2); // T piece spawn Y
    });

    it("should create I piece at correct spawn position (fully above playfield)", () => {
      const piece = createActivePiece("I");

      expect(piece.id).toBe("I");
      expect(piece.rot).toBe("spawn");
      expect(piece.x).toBe(3); // I piece spawn X
      expect(piece.y).toBe(-2); // I piece spawn Y (SRS: fully above)
    });

    it("should create O piece at correct spawn position", () => {
      const piece = createActivePiece("O");

      expect(piece.id).toBe("O");
      expect(piece.rot).toBe("spawn");
      expect(piece.x).toBe(3); // O piece spawn X (centered: 4+2+4)
      expect(piece.y).toBe(-2); // O piece spawn Y
    });
  });

  describe("canSpawnPiece", () => {
    it("should return true for empty board", () => {
      const board = createTestBoard();

      // All pieces should spawn successfully on empty board
      expect(canSpawnPiece(board, "T")).toBe(true);
      expect(canSpawnPiece(board, "I")).toBe(true);
      expect(canSpawnPiece(board, "O")).toBe(true);
      expect(canSpawnPiece(board, "S")).toBe(true);
      expect(canSpawnPiece(board, "Z")).toBe(true);
      expect(canSpawnPiece(board, "J")).toBe(true);
      expect(canSpawnPiece(board, "L")).toBe(true);
    });

    it("should return false when spawn position has collision", () => {
      const board = createTestBoard();

      // Block spawn area for T piece
      // T piece spawns at [3,-2] with spawn shape cells: [1,0], [0,1], [1,1], [2,1]
      // Absolute positions: [4,-2], [3,-1], [4,-1], [5,-1]
      // Block one of these positions to prevent spawning
      const blockX = createGridCoord(4);
      const blockY = createGridCoord(-2);
      board.cells[idx(board, blockX, blockY)] = 1; // Block cell at (4,-2)

      expect(canSpawnPiece(board, "T")).toBe(false);
    });

    it("should handle pieces that spawn above visible board", () => {
      const board = createTestBoard();
      // Both T and I pieces spawn above visible board (y < 0) but should work on empty board
      expect(canSpawnPiece(board, "T")).toBe(true);
      expect(canSpawnPiece(board, "I")).toBe(true);
    });

    it("should detect collisions in vanish zone", () => {
      const board = createTestBoard();

      // Block a cell in the vanish zone where T piece spawns
      // T piece spawns at (3,-2) with cells at relative positions: [1,0], [0,1], [1,1], [2,1]
      // Absolute positions: [4,-2], [3,-1], [4,-1], [5,-1]
      const blockX = createGridCoord(4);
      const blockY = createGridCoord(-2); // In vanish zone
      board.cells[idx(board, blockX, blockY)] = 1;

      expect(canSpawnPiece(board, "T")).toBe(false);

      // Clear the cell and verify spawning works again
      board.cells[idx(board, blockX, blockY)] = 0;
      expect(canSpawnPiece(board, "T")).toBe(true);
    });

    it("should handle pieces spawning partially above vanish zone", () => {
      const board = createTestBoard();

      // All pieces spawn at y=-2, which is within the vanish zone (-3 to -1)
      // But they extend to different positions

      // Test I piece: spawns at (3,-2) with cells at [3,-1], [4,-1], [5,-1], [6,-1]
      // Block one of I piece spawn cells at y=-1
      board.cells[idx(board, createGridCoord(4), createGridCoord(-1))] = 1;
      expect(canSpawnPiece(board, "I")).toBe(false);

      // Clear and test with different piece
      board.cells[idx(board, createGridCoord(4), createGridCoord(-1))] = 0;
      expect(canSpawnPiece(board, "I")).toBe(true);
    });

    it("should respect vanish zone boundaries for spawn collision", () => {
      const board = createTestBoard();

      // Test upper boundary - above vanish zone (y < -3) should always block
      // This is handled by isCellBlocked returning true for y < -vanishRows

      // Test lower boundary - collision at y = -1 (bottom of vanish zone)
      board.cells[idx(board, createGridCoord(4), createGridCoord(-1))] = 1;
      expect(canSpawnPiece(board, "T")).toBe(false);

      // Test visible area boundary - collision at y = 0
      board.cells[idx(board, createGridCoord(4), createGridCoord(-1))] = 0;
      board.cells[idx(board, createGridCoord(4), createGridCoord(0))] = 1;
      expect(canSpawnPiece(board, "T")).toBe(true); // T piece doesn't extend to y=0 from spawn position
    });

    it("should handle edge cases at vanish zone boundaries", () => {
      const board = createTestBoard();

      // Test exactly at vanish zone top (y = -3)
      board.cells[idx(board, createGridCoord(4), createGridCoord(-3))] = 1;
      expect(canSpawnPiece(board, "T")).toBe(true); // T piece doesn't reach y=-3

      // Test exactly at vanish zone bottom (y = -1)
      board.cells[idx(board, createGridCoord(4), createGridCoord(-1))] = 1;
      expect(canSpawnPiece(board, "T")).toBe(false); // T piece has cells at y=-1

      // Test exactly at visible area top (y = 0)
      board.cells[idx(board, createGridCoord(4), createGridCoord(-1))] = 0;
      board.cells[idx(board, createGridCoord(4), createGridCoord(0))] = 1;
      expect(canSpawnPiece(board, "T")).toBe(true); // T piece doesn't reach y=0 from spawn
    });

    it("should work correctly for all piece types in vanish zone", () => {
      const board = createTestBoard();
      const allPieces: Array<PieceId> = ["I", "O", "T", "S", "Z", "J", "L"];

      // All pieces should spawn successfully on empty board
      allPieces.forEach((pieceId) => {
        expect(canSpawnPiece(board, pieceId)).toBe(true);
      });

      // Block the common spawn area and test that all pieces are blocked
      // Since all pieces spawn at (3,-2), block that area
      for (let x = 3; x <= 6; x++) {
        for (let y = -2; y <= -1; y++) {
          board.cells[idx(board, createGridCoord(x), createGridCoord(y))] = 1;
        }
      }

      allPieces.forEach((pieceId) => {
        expect(canSpawnPiece(board, pieceId)).toBe(false);
      });
    });
  });

  describe("isTopOut", () => {
    it("should return false for empty board", () => {
      const board = createTestBoard();
      // Empty board should allow spawning, so not topped out
      expect(isTopOut(board, "T")).toBe(false);
      expect(isTopOut(board, "I")).toBe(false);
    });

    it("should return true when piece cannot spawn due to collision", () => {
      const board = createTestBoard();

      // Block spawn area for T piece - same as canSpawnPiece test
      const blockX = createGridCoord(4);
      const blockY = createGridCoord(-2);
      board.cells[idx(board, blockX, blockY)] = 1; // Block cell at (4,-2)

      expect(isTopOut(board, "T")).toBe(true);
    });

    it("should detect vanish zone topout conditions", () => {
      const board = createTestBoard();

      // Completely fill the vanish zone to create topout
      for (let y = -3; y <= -1; y++) {
        for (let x = 0; x < 10; x++) {
          board.cells[idx(board, createGridCoord(x), createGridCoord(y))] = 1;
        }
      }

      // All pieces should be topped out since vanish zone is full
      expect(isTopOut(board, "T")).toBe(true);
      expect(isTopOut(board, "I")).toBe(true);
      expect(isTopOut(board, "O")).toBe(true);
      expect(isTopOut(board, "S")).toBe(true);
      expect(isTopOut(board, "Z")).toBe(true);
      expect(isTopOut(board, "J")).toBe(true);
      expect(isTopOut(board, "L")).toBe(true);
    });

    it("should distinguish lock-out vs block-out with vanish zone", () => {
      const board = createTestBoard();

      // Block-out: piece cannot spawn due to collision in spawn area
      // Block T piece spawn cells specifically
      board.cells[idx(board, createGridCoord(4), createGridCoord(-2))] = 1; // T spawn cell
      expect(isTopOut(board, "T")).toBe(true); // Block-out condition

      // Clear that cell
      board.cells[idx(board, createGridCoord(4), createGridCoord(-2))] = 0;
      expect(isTopOut(board, "T")).toBe(false); // Can spawn again

      // Lock-out would be when a piece spawns but immediately cannot move
      // This is tested implicitly - if spawn succeeds, lock-out is handled by game logic
      const testPiece = createActivePiece("T");
      expect(canPlacePiece(board, testPiece)).toBe(true); // Can spawn = no topout
    });

    it("should handle vanish zone boundary topout cases", () => {
      const board = createTestBoard();

      // Test topout exactly at vanish zone boundaries

      // Fill only the top of vanish zone (y = -3)
      for (let x = 0; x < 10; x++) {
        board.cells[idx(board, createGridCoord(x), createGridCoord(-3))] = 1;
      }
      // Pieces don't spawn at y=-3, so no topout yet
      expect(isTopOut(board, "T")).toBe(false);

      // Fill the bottom of vanish zone (y = -1) where pieces actually spawn
      for (let x = 0; x < 10; x++) {
        board.cells[idx(board, createGridCoord(x), createGridCoord(-1))] = 1;
      }
      // Now T piece should be topped out (has cells at y=-1)
      expect(isTopOut(board, "T")).toBe(true);

      // Clear y=-1 and fill visible area top (y = 0)
      for (let x = 0; x < 10; x++) {
        board.cells[idx(board, createGridCoord(x), createGridCoord(-1))] = 0;
        board.cells[idx(board, createGridCoord(x), createGridCoord(0))] = 1;
      }
      // T piece spawns above y=0, so should still be able to spawn
      expect(isTopOut(board, "T")).toBe(false);
    });

    it("should work consistently across all piece types in vanish zone", () => {
      const board = createTestBoard();
      const allPieces: Array<PieceId> = ["I", "O", "T", "S", "Z", "J", "L"];

      // Empty board - no pieces should be topped out
      allPieces.forEach((pieceId) => {
        expect(isTopOut(board, pieceId)).toBe(false);
      });

      // Progressively fill vanish zone and test topout detection

      // Fill y = -3 (top of vanish zone) - shouldn't affect spawning
      for (let x = 0; x < 10; x++) {
        board.cells[idx(board, createGridCoord(x), createGridCoord(-3))] = 1;
      }
      allPieces.forEach((pieceId) => {
        expect(isTopOut(board, pieceId)).toBe(false); // Still can spawn
      });

      // Fill y = -2 and y = -1 (where pieces actually spawn)
      for (let x = 0; x < 10; x++) {
        board.cells[idx(board, createGridCoord(x), createGridCoord(-2))] = 1;
        board.cells[idx(board, createGridCoord(x), createGridCoord(-1))] = 1;
      }
      allPieces.forEach((pieceId) => {
        expect(isTopOut(board, pieceId)).toBe(true); // All topped out
      });
    });
  });

  describe("spawnWithHold", () => {
    it("should spawn next piece when no hold piece", () => {
      const board = createTestBoard();
      const result = spawnWithHold(board, "T");

      expect(result).not.toBeNull();
      assertDefined(result);
      expect(result[0].id).toBe("T");
      expect(result[1]).toBeUndefined();
    });

    it("should swap with held piece", () => {
      const board = createTestBoard();
      const result = spawnWithHold(board, "T", "I");

      expect(result).not.toBeNull();
      assertDefined(result);
      expect(result[0].id).toBe("I"); // Spawn held piece
      expect(result[1]).toBe("T"); // Next piece becomes hold
    });

    it("should return null on top out", () => {
      const board = createTestBoard();

      // Block spawn area for T piece
      const blockX = createGridCoord(4);
      const blockY = createGridCoord(-2);
      board.cells[idx(board, blockX, blockY)] = 1; // Block cell at (4,-2)

      const result = spawnWithHold(board, "T");
      expect(result).toBeNull(); // Should return null due to top-out
    });

    it("should return null on top out with hold", () => {
      const board = createTestBoard();

      // Block spawn area for T piece (the held piece)
      const blockX = createGridCoord(4);
      const blockY = createGridCoord(-2);
      board.cells[idx(board, blockX, blockY)] = 1; // Block cell at (4,-2)

      const result = spawnWithHold(board, "L", "T");
      expect(result).toBeNull(); // Should return null because held piece "T" can't spawn
    });
  });
});
