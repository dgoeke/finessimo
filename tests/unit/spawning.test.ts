/* eslint-disable sonarjs/todo-tag */
import { describe, it, expect } from "@jest/globals";

import {
  createActivePiece,
  canSpawnPiece,
  isTopOut,
  spawnWithHold,
} from "../../src/core/spawning";
import { type Board, createBoardCells, idx } from "../../src/state/types";
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

      // TODO: Update when spawn collision detection is re-implemented

      // These now always return true due to stubbing
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

    // TODO: Add comprehensive vanish zone spawn collision tests when spawn collision detection is re-implemented
    // These tests should cover:
    // - Collision detection in vanish zone (-3..-1)
    // - Proper boundary checking for pieces that spawn partially above vanish zone
    // - Edge cases where pieces spawn exactly at vanish zone boundaries
    // - Interaction between vanish zone collisions and visible area collisions
    // - Different piece types and their spawn positions relative to vanish zone
    it.todo("should detect collisions in vanish zone");
    it.todo("should handle pieces spawning partially above vanish zone");
    it.todo("should respect vanish zone boundaries for spawn collision");
    it.todo("should handle edge cases at vanish zone boundaries");
    it.todo("should work correctly for all piece types in vanish zone");
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

    // TODO: Add comprehensive vanish zone topout detection tests when spawn collision detection is re-implemented
    // These tests should cover:
    // - Different topout scenarios in vanish zone vs visible area
    // - Proper detection when pieces can spawn in vanish zone but not visible area
    // - Edge cases where topout occurs exactly at vanish zone boundaries
    // - Lock-out vs block-out detection with vanish zone support
    // - Interaction between vanish zone state and topout conditions
    it.todo("should detect vanish zone topout conditions");
    it.todo("should distinguish lock-out vs block-out with vanish zone");
    it.todo("should handle vanish zone boundary topout cases");
    it.todo("should work consistently across all piece types in vanish zone");
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
