import {
  createEmptyBoard,
  canPlacePiece,
  canMove,
  tryMove,
  moveToWall,
  dropToBottom,
  isAtBottom,
  lockPiece,
  getCompletedLines,
  clearLines,
} from "../../src/core/board";
import { ActivePiece, Board } from "../../src/state/types";
import { assertDefined } from "../test-helpers";

describe("Board Logic", () => {
  let emptyBoard: Board;

  beforeEach(() => {
    emptyBoard = createEmptyBoard();
  });

  describe("createEmptyBoard", () => {
    it("should create a 10x20 empty board", () => {
      expect(emptyBoard.width).toBe(10);
      expect(emptyBoard.height).toBe(20);
      expect(emptyBoard.cells.length).toBe(200);
      expect(emptyBoard.cells.every((cell) => cell === 0)).toBe(true);
    });
  });

  describe("canPlacePiece", () => {
    const tPiece: ActivePiece = {
      id: "T",
      rot: "spawn",
      x: 4,
      y: 2,
    };

    it("should allow placement on empty board", () => {
      expect(canPlacePiece(emptyBoard, tPiece)).toBe(true);
    });

    it("should prevent placement when overlapping with existing blocks", () => {
      const blockedBoard = createEmptyBoard();
      blockedBoard.cells[3 * 10 + 5] = 1; // Block at (5, 3) where T piece has a cell

      expect(canPlacePiece(blockedBoard, tPiece)).toBe(false);
    });

    it("should prevent placement outside board boundaries", () => {
      const leftPiece: ActivePiece = { ...tPiece, x: -2 };
      const rightPiece: ActivePiece = { ...tPiece, x: 9 };
      const bottomPiece: ActivePiece = { ...tPiece, y: 19 };

      expect(canPlacePiece(emptyBoard, leftPiece)).toBe(false);
      expect(canPlacePiece(emptyBoard, rightPiece)).toBe(false);
      expect(canPlacePiece(emptyBoard, bottomPiece)).toBe(false);
    });

    it("should allow placement with negative y (above board)", () => {
      const highPiece: ActivePiece = { ...tPiece, y: -1 };
      expect(canPlacePiece(emptyBoard, highPiece)).toBe(true);
    });
  });

  describe("canMove and tryMove", () => {
    const tPiece: ActivePiece = {
      id: "T",
      rot: "spawn",
      x: 4,
      y: 2,
    };

    it("should allow valid moves", () => {
      expect(canMove(emptyBoard, tPiece, 1, 0)).toBe(true); // Right
      expect(canMove(emptyBoard, tPiece, -1, 0)).toBe(true); // Left
      expect(canMove(emptyBoard, tPiece, 0, 1)).toBe(true); // Down
      expect(canMove(emptyBoard, tPiece, 0, -1)).toBe(true); // Up
    });

    it("should prevent invalid moves", () => {
      const leftEdgePiece: ActivePiece = { ...tPiece, x: 0 }; // T-piece leftmost cell would be at x=-1
      const rightEdgePiece: ActivePiece = { ...tPiece, x: 7 }; // T-piece rightmost cell would be at x=9
      const bottomPiece: ActivePiece = { ...tPiece, y: 18 }; // T-piece bottom cell would be at y=19 (outside board)

      expect(canMove(emptyBoard, leftEdgePiece, -1, 0)).toBe(false);
      expect(canMove(emptyBoard, rightEdgePiece, 1, 0)).toBe(false);
      expect(canMove(emptyBoard, bottomPiece, 0, 1)).toBe(false);
    });

    it("should return moved piece for valid moves", () => {
      const movedRight = tryMove(emptyBoard, tPiece, 1, 0);
      expect(movedRight).not.toBeNull();
      // Use helper for runtime narrowing
      assertDefined(movedRight);
      expect(movedRight.x).toBe(5);
      expect(movedRight.y).toBe(2);
    });

    it("should return null for invalid moves", () => {
      const leftEdgePiece: ActivePiece = { ...tPiece, x: 0 };
      const movedLeft = tryMove(emptyBoard, leftEdgePiece, -1, 0);
      expect(movedLeft).toBeNull();
    });
  });

  describe("moveToWall", () => {
    const tPiece: ActivePiece = {
      id: "T",
      rot: "spawn",
      x: 4,
      y: 2,
    };

    it("should move piece to left wall", () => {
      const atLeftWall = moveToWall(emptyBoard, tPiece, -1);
      expect(atLeftWall.x).toBe(0); // T piece can go to x=0 (leftmost cell at offset 0)
    });

    it("should move piece to right wall", () => {
      const atRightWall = moveToWall(emptyBoard, tPiece, 1);
      expect(atRightWall.x).toBe(7); // T piece can go to x=7 (cells at 6,7,8,7)
    });

    it("should not move if already at wall", () => {
      const leftWallPiece: ActivePiece = { ...tPiece, x: 0 };
      const stillAtWall = moveToWall(emptyBoard, leftWallPiece, -1);
      expect(stillAtWall.x).toBe(0);
    });

    it("should stop before obstacles", () => {
      const blockedBoard = createEmptyBoard();
      blockedBoard.cells[2 * 10 + 6] = 1; // Block at (6, 2)

      const stoppedPiece = moveToWall(blockedBoard, tPiece, 1);
      expect(stoppedPiece.x).toBe(4); // Should stop before hitting the block
    });
  });

  describe("dropToBottom and isAtBottom", () => {
    const tPiece: ActivePiece = {
      id: "T",
      rot: "spawn",
      x: 4,
      y: 2,
    };

    it("should drop piece to bottom of empty board", () => {
      const droppedPiece = dropToBottom(emptyBoard, tPiece);
      expect(droppedPiece.y).toBe(18); // T piece bottom cells at y=19 (last row)
    });

    it("should detect when piece is at bottom", () => {
      const bottomPiece: ActivePiece = { ...tPiece, y: 18 };
      expect(isAtBottom(emptyBoard, bottomPiece)).toBe(true);
      expect(isAtBottom(emptyBoard, tPiece)).toBe(false);
    });

    it("should stop on obstacles", () => {
      const blockedBoard = createEmptyBoard();
      blockedBoard.cells[5 * 10 + 4] = 1; // Block at (4, 5)

      const droppedPiece = dropToBottom(blockedBoard, tPiece);
      expect(droppedPiece.y).toBe(3); // Should stop at y=3 (bottom cells at y=4, blocked at y=5)
    });
  });

  describe("lockPiece", () => {
    const tPiece: ActivePiece = {
      id: "T",
      rot: "spawn",
      x: 4,
      y: 2,
    };

    it("should place piece cells on board", () => {
      const lockedBoard = lockPiece(emptyBoard, tPiece);

      // T piece spawn shape: [[1,0],[0,1],[1,1],[2,1]]
      expect(lockedBoard.cells[2 * 10 + 5]).toBe(3); // (5, 2) - T piece value is 3
      expect(lockedBoard.cells[3 * 10 + 4]).toBe(3); // (4, 3)
      expect(lockedBoard.cells[3 * 10 + 5]).toBe(3); // (5, 3)
      expect(lockedBoard.cells[3 * 10 + 6]).toBe(3); // (6, 3)
    });

    it("should not modify cells outside board boundaries", () => {
      const highPiece: ActivePiece = { ...tPiece, y: -1 };
      const lockedBoard = lockPiece(emptyBoard, highPiece);

      // T piece at y=-1 has cells at y=-1 and y=0. Only y=0 cells should be locked.
      // T spawn shape: [1,0],[0,1],[1,1],[2,1] -> at y=-1: [5,-1],[4,0],[5,0],[6,0]
      expect(lockedBoard.cells[0 * 10 + 4]).toBe(3); // (4, 0)
      expect(lockedBoard.cells[0 * 10 + 5]).toBe(3); // (5, 0)
      expect(lockedBoard.cells[0 * 10 + 6]).toBe(3); // (6, 0)
    });

    it("should not mutate original board", () => {
      const originalBoard = createEmptyBoard();
      const lockedBoard = lockPiece(originalBoard, tPiece);

      expect(originalBoard.cells.every((cell) => cell === 0)).toBe(true);
      expect(lockedBoard === originalBoard).toBe(false);
    });
  });

  describe("getCompletedLines", () => {
    it("should detect no completed lines on empty board", () => {
      const completedLines = getCompletedLines(emptyBoard);
      expect(completedLines).toEqual([]);
    });

    it("should detect single completed line", () => {
      const boardWithLine = createEmptyBoard();
      for (let x = 0; x < 10; x++) {
        boardWithLine.cells[19 * 10 + x] = 1; // Fill bottom row
      }

      const completedLines = getCompletedLines(boardWithLine);
      expect(completedLines).toEqual([19]);
    });

    it("should detect multiple completed lines", () => {
      const boardWithLines = createEmptyBoard();
      // Fill rows 18 and 19
      for (let x = 0; x < 10; x++) {
        boardWithLines.cells[18 * 10 + x] = 1;
        boardWithLines.cells[19 * 10 + x] = 1;
      }

      const completedLines = getCompletedLines(boardWithLines);
      expect(completedLines).toEqual([18, 19]);
    });

    it("should not detect partially filled lines", () => {
      const boardWithPartialLine = createEmptyBoard();
      for (let x = 0; x < 9; x++) {
        // Fill only 9 out of 10 cells
        boardWithPartialLine.cells[19 * 10 + x] = 1;
      }

      const completedLines = getCompletedLines(boardWithPartialLine);
      expect(completedLines).toEqual([]);
    });
  });

  describe("clearLines", () => {
    it("should return same board when no lines to clear", () => {
      const clearedBoard = clearLines(emptyBoard, []);
      expect(clearedBoard).toBe(emptyBoard);
    });

    it("should clear single line and drop rows above", () => {
      const boardWithStacking = createEmptyBoard();

      // Create a scenario with blocks above a complete line
      boardWithStacking.cells[17 * 10 + 0] = 1; // Block at (0, 17)
      boardWithStacking.cells[18 * 10 + 1] = 1; // Block at (1, 18)

      // Fill row 19 completely
      for (let x = 0; x < 10; x++) {
        boardWithStacking.cells[19 * 10 + x] = 1;
      }

      const clearedBoard = clearLines(boardWithStacking, [19]);

      // Check that blocks above dropped down
      expect(clearedBoard.cells[18 * 10 + 0]).toBe(1); // (0, 17) -> (0, 18)
      expect(clearedBoard.cells[19 * 10 + 1]).toBe(1); // (1, 18) -> (1, 19)

      // Check that original row 19 content is gone (the complete line)
      // Row 19 should only have the dropped block from (1, 18), rest should be empty
      for (let x = 0; x < 10; x++) {
        if (x === 1) {
          expect(clearedBoard.cells[19 * 10 + x]).toBe(1); // Block dropped from (1, 18)
        } else {
          expect(clearedBoard.cells[19 * 10 + x]).toBe(0); // Should be empty
        }
      }
    });

    it("should clear multiple lines correctly", () => {
      const boardWithMultipleLines = createEmptyBoard();

      // Place a block above the lines to be cleared
      boardWithMultipleLines.cells[16 * 10 + 0] = 1; // Block at (0, 16)

      // Fill rows 18 and 19
      for (let x = 0; x < 10; x++) {
        boardWithMultipleLines.cells[18 * 10 + x] = 1;
        boardWithMultipleLines.cells[19 * 10 + x] = 1;
      }

      const clearedBoard = clearLines(boardWithMultipleLines, [18, 19]);

      // Check that block dropped down by 2 rows
      expect(clearedBoard.cells[18 * 10 + 0]).toBe(1); // (0, 16) -> (0, 18)

      // Check that rows 17 and above are empty (since only one block was placed)
      for (let x = 0; x < 10; x++) {
        if (x === 0) {
          // This cell has the dropped block
          continue;
        }
        expect(clearedBoard.cells[18 * 10 + x]).toBe(0);
      }

      // Check that row 19 is empty
      for (let x = 0; x < 10; x++) {
        expect(clearedBoard.cells[19 * 10 + x]).toBe(0);
      }
    });

    it("should not mutate original board", () => {
      const originalBoard = createEmptyBoard();
      // Fill bottom row
      for (let x = 0; x < 10; x++) {
        originalBoard.cells[19 * 10 + x] = 1;
      }

      const clearedBoard = clearLines(originalBoard, [19]);

      // Original board should still have the filled row
      expect(originalBoard.cells[19 * 10 + 0]).toBe(1);
      // Cleared board should have empty bottom row
      expect(clearedBoard.cells[19 * 10 + 0]).toBe(0);
      expect(clearedBoard !== originalBoard).toBe(true);
    });
  });
});
