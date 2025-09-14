/**
 * @fileoverview Tests for the shared test helpers module
 *
 * These tests verify that the consolidated helper functions work correctly
 * and maintain the same behavior as the original implementations.
 */

import { createEmptyBoard } from "@/engine/core/board";
import { createGridCoord, idx } from "@/engine/core/types";
import { toQ } from "@/engine/utils/fixedpoint";

import {
  createTestConfig,
  createTestGameState,
  createTestPiece,
  setBoardCell,
  createTestBoard,
  fillBoardRow,
  createTestPhysics,
  createBoardWithCollisions,
  setupBoardWithFloor,
  createBoardWithLeftWall,
  createBoardWithRightWall,
} from "./test-helpers";

describe("test-helpers", () => {
  describe("createTestConfig()", () => {
    test("creates config with sensible defaults", () => {
      const config = createTestConfig();

      expect(config.gravity32).toBe(toQ(0.5));
      expect(config.height).toBe(20);
      expect(config.lockDelayTicks).toBe(30);
      expect(config.maxLockResets).toBe(15);
      expect(config.previewCount).toBe(7);
      expect(config.rngSeed).toBe(12345);
      expect(config.softDrop32).toBe(toQ(2.0));
      expect(config.width).toBe(10);
    });

    test("applies overrides correctly", () => {
      const config = createTestConfig({
        gravity32: toQ(1.0),
        previewCount: 5,
      });

      expect(config.gravity32).toBe(toQ(1.0));
      expect(config.previewCount).toBe(5);
      expect(config.height).toBe(20); // Default preserved
    });
  });

  describe("createTestGameState()", () => {
    test("creates complete game state with proper defaults", () => {
      const state = createTestGameState();

      expect(state.board).toBeDefined();
      expect(state.cfg).toBeDefined();
      expect(state.hold).toEqual({ piece: null, usedThisTurn: false });
      expect(state.physics).toBeDefined();
      expect(state.piece).toBeNull();
      expect(state.queue).toHaveLength(7);
      expect(state.tick).toBe(0);
    });

    test("properly merges nested overrides", () => {
      const state = createTestGameState({
        hold: { piece: "I", usedThisTurn: true },
        physics: {
          gravityAccum32: toQ(0.5),
          lock: { deadlineTick: null, resetCount: 2 },
          softDropOn: true,
        },
      });

      expect(state.hold.piece).toBe("I");
      expect(state.hold.usedThisTurn).toBe(true);
      expect(state.physics.softDropOn).toBe(true);
      expect(state.physics.gravityAccum32).toBe(toQ(0.5)); // Override applied
      expect(state.physics.lock.deadlineTick).toBeNull();
      expect(state.physics.lock.resetCount).toBe(2);
    });
  });

  describe("createTestPiece()", () => {
    test("creates piece with branded types and defaults", () => {
      const piece = createTestPiece();

      expect(piece.id).toBe("T");
      expect(piece.rot).toBe("spawn");
      expect(piece.x).toBe(createGridCoord(4));
      expect(piece.y).toBe(createGridCoord(0));
    });

    test("applies custom parameters", () => {
      const piece = createTestPiece("I", 5, 10, "right");

      expect(piece.id).toBe("I");
      expect(piece.rot).toBe("right");
      expect(piece.x).toBe(createGridCoord(5));
      expect(piece.y).toBe(createGridCoord(10));
    });
  });

  describe("setBoardCell()", () => {
    test("sets individual cells while preserving immutability", () => {
      const originalBoard = createEmptyBoard();
      const modifiedBoard = setBoardCell(originalBoard, 4, 10, 5);

      // Original board unchanged
      expect(
        originalBoard.cells[
          idx(originalBoard, createGridCoord(4), createGridCoord(10))
        ],
      ).toBe(0);

      // New board has the change
      expect(
        modifiedBoard.cells[
          idx(modifiedBoard, createGridCoord(4), createGridCoord(10))
        ],
      ).toBe(5);
      expect(modifiedBoard).not.toBe(originalBoard);
      expect(modifiedBoard.cells).not.toBe(originalBoard.cells);
    });
  });

  describe("createTestBoard()", () => {
    test("creates empty board by default", () => {
      const board = createTestBoard();

      // Should be empty by default
      expect(
        board.cells[idx(board, createGridCoord(0), createGridCoord(0))],
      ).toBe(0);
      expect(
        board.cells[idx(board, createGridCoord(5), createGridCoord(10))],
      ).toBe(0);
    });

    test("applies custom cell mappings", () => {
      const board = createTestBoard({ 30: 1, 31: 2 });

      // Custom cells should be set
      expect(board.cells[30]).toBe(1);
      expect(board.cells[31]).toBe(2);

      // Other cells should remain empty
      expect(board.cells[32]).toBe(0);
    });
  });

  describe("fillBoardRow()", () => {
    test("fills entire row with specified value", () => {
      const board = createEmptyBoard();
      const filledBoard = fillBoardRow(board, 15, 3);

      // Check that row 15 is filled with value 3
      for (let x = 0; x < 10; x++) {
        const cellValue =
          filledBoard.cells[
            idx(filledBoard, createGridCoord(x), createGridCoord(15))
          ];
        expect(cellValue).toBe(3);
      }

      // Check that other rows remain empty
      expect(
        filledBoard.cells[
          idx(filledBoard, createGridCoord(0), createGridCoord(14))
        ],
      ).toBe(0);
      expect(
        filledBoard.cells[
          idx(filledBoard, createGridCoord(0), createGridCoord(16))
        ],
      ).toBe(0);
    });
  });

  describe("createBoardWithCollisions()", () => {
    test("creates board with multiple collisions", () => {
      const board = createBoardWithCollisions([
        { value: 1, x: 4, y: 10 },
        { value: 2, x: 5, y: 10 },
        { value: 3, x: 4, y: 11 },
      ]);

      expect(
        board.cells[idx(board, createGridCoord(4), createGridCoord(10))],
      ).toBe(1);
      expect(
        board.cells[idx(board, createGridCoord(5), createGridCoord(10))],
      ).toBe(2);
      expect(
        board.cells[idx(board, createGridCoord(4), createGridCoord(11))],
      ).toBe(3);
      expect(
        board.cells[idx(board, createGridCoord(6), createGridCoord(10))],
      ).toBe(0);
    });
  });

  describe("setupBoardWithFloor()", () => {
    test("creates horizontal floor across board width", () => {
      const board = setupBoardWithFloor(18, 7);

      // Floor should span entire width at y=18
      for (let x = 0; x < 10; x++) {
        expect(
          board.cells[idx(board, createGridCoord(x), createGridCoord(18))],
        ).toBe(7);
      }

      // Other rows should be empty
      expect(
        board.cells[idx(board, createGridCoord(0), createGridCoord(17))],
      ).toBe(0);
      expect(
        board.cells[idx(board, createGridCoord(0), createGridCoord(19))],
      ).toBe(0);
    });
  });

  describe("createBoardWithLeftWall()", () => {
    test("creates left wall with default parameters", () => {
      const board = createBoardWithLeftWall();

      // Left wall (x=0) should be filled for visible area
      for (let y = 0; y < 20; y++) {
        expect(
          board.cells[idx(board, createGridCoord(0), createGridCoord(y))],
        ).toBe(1);
      }

      // Other columns should be empty
      expect(
        board.cells[idx(board, createGridCoord(1), createGridCoord(0))],
      ).toBe(0);
      expect(
        board.cells[idx(board, createGridCoord(9), createGridCoord(0))],
      ).toBe(0);
    });
  });

  describe("createBoardWithRightWall()", () => {
    test("creates right wall with custom parameters", () => {
      const board = createBoardWithRightWall(5, 10); // 5 rows starting at y=10

      // Right wall (x=9) should be filled for specified range
      for (let y = 10; y < 15; y++) {
        expect(
          board.cells[idx(board, createGridCoord(9), createGridCoord(y))],
        ).toBe(1);
      }

      // Outside range should be empty
      expect(
        board.cells[idx(board, createGridCoord(9), createGridCoord(9))],
      ).toBe(0);
      expect(
        board.cells[idx(board, createGridCoord(9), createGridCoord(15))],
      ).toBe(0);
      expect(
        board.cells[idx(board, createGridCoord(8), createGridCoord(10))],
      ).toBe(0);
    });
  });

  describe("createTestPhysics()", () => {
    test("provides non-zero defaults for reset testing", () => {
      const physics = createTestPhysics();

      expect(physics.gravityAccum32).toBe(toQ(0.25));
      expect(physics.lock.deadlineTick).toBe(100);
      expect(physics.lock.resetCount).toBe(5);
      expect(physics.softDropOn).toBe(false);
    });

    test("applies overrides correctly including nested lock properties", () => {
      const physics = createTestPhysics({
        gravityAccum32: toQ(1.0),
        lock: { deadlineTick: null, resetCount: 3 },
        softDropOn: true,
      });

      expect(physics.gravityAccum32).toBe(toQ(1.0));
      expect(physics.softDropOn).toBe(true);
      expect(physics.lock.deadlineTick).toBeNull();
      expect(physics.lock.resetCount).toBe(3); // Override applied
    });
  });

  describe("immutability guarantees", () => {
    test("all board modification functions return new instances", () => {
      const originalBoard = createEmptyBoard();

      const modified1 = setBoardCell(originalBoard, 0, 0, 1);
      const modified2 = fillBoardRow(originalBoard, 10, 2);
      const modified3 = createBoardWithLeftWall();

      expect(modified1).not.toBe(originalBoard);
      expect(modified1.cells).not.toBe(originalBoard.cells);
      expect(modified2).not.toBe(originalBoard);
      expect(modified2.cells).not.toBe(originalBoard.cells);
      expect(modified3).not.toBe(originalBoard);
      expect(modified3.cells).not.toBe(originalBoard.cells);
    });
  });
});
