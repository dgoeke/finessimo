import {
  calculateGhostPosition,
  canPlacePiece,
  clearLines,
  createEmptyBoard,
  dropToBottom,
  getCompletedLines,
  isAtBottom,
  lockPiece,
  moveToWall,
  shiftUpAndInsertRow,
  tryMove,
} from "@/engine/core/board";
import { type Board, createGridCoord, idx } from "@/engine/core/types";

import {
  createTestBoard,
  createTestPiece,
  setBoardCell,
  fillBoardRow,
} from "../../test-helpers";

// Helper functions for building test scenarios

describe("@/engine/core/board — geometry & line clear", () => {
  describe("idx()", () => {
    test("y=-3 maps to storage row 0; y=0 maps to storage row vanishRows; dimensions totalHeight=23, width=10", () => {
      const board = createEmptyBoard();

      // Test vanish zone mapping: y=-3 should map to storage index 0
      const vanishTopIndex = idx(
        board,
        createGridCoord(0),
        createGridCoord(-3),
      );
      expect(vanishTopIndex).toBe(0);

      // Test visible zone start: y=0 should map to storage row vanishRows (3)
      const visibleStartIndex = idx(
        board,
        createGridCoord(0),
        createGridCoord(0),
      );
      expect(visibleStartIndex).toBe(board.vanishRows * board.width); // 3 * 10 = 30

      // Test visible zone end: y=19 should map to storage row totalHeight-1 (22)
      const visibleEndIndex = idx(
        board,
        createGridCoord(0),
        createGridCoord(19),
      );
      expect(visibleEndIndex).toBe((board.totalHeight - 1) * board.width); // 22 * 10 = 220

      // Test board dimensions
      expect(board.width).toBe(10);
      expect(board.height).toBe(20);
      expect(board.totalHeight).toBe(23);
      expect(board.vanishRows).toBe(3);
    });
  });

  describe("canPlacePiece()", () => {
    test("false when any cell is out of bounds or collides with non-zero cell; vanish rows count as collidable", () => {
      const board = createEmptyBoard();

      // Test valid placement in visible area
      const validPiece = createTestPiece("T", 4, 2, "spawn");
      expect(canPlacePiece(board, validPiece)).toBe(true);

      // Test collision with filled cell - T piece spawn shape is [1,0], [0,1], [1,1], [2,1]
      const blockedBoard = setBoardCell(board, 4, 3, 1); // Block center-bottom cell
      expect(canPlacePiece(blockedBoard, validPiece)).toBe(false);

      // Test out of bounds - left edge
      const leftPiece = createTestPiece("T", -1, 2, "spawn");
      expect(canPlacePiece(board, leftPiece)).toBe(false);

      // Test out of bounds - right edge
      const rightPiece = createTestPiece("T", 9, 2, "spawn");
      expect(canPlacePiece(board, rightPiece)).toBe(false);

      // Test collision in vanish zone - vanish rows are collidable when filled
      const vanishPiece = createTestPiece("T", 4, -2, "spawn");
      expect(canPlacePiece(board, vanishPiece)).toBe(true); // Empty vanish zone allows placement

      const vanishBlockedBoard = setBoardCell(board, 4, -1, 1); // Block vanish zone
      expect(canPlacePiece(vanishBlockedBoard, vanishPiece)).toBe(false);
    });
  });

  describe("tryMove()", () => {
    test("moves piece by (dx,dy) only if all target cells are free; otherwise returns null", () => {
      const board = createEmptyBoard();
      const piece = createTestPiece("T", 4, 10, "spawn");

      // Valid move right
      const movedRight = tryMove(board, piece, 1, 0);
      expect(movedRight).not.toBeNull();
      if (movedRight) {
        expect(movedRight.x).not.toBe(piece.x); // Should be different branded value
        expect(movedRight.y).toBe(piece.y);
      }

      // Valid move down
      const movedDown = tryMove(board, piece, 0, 1);
      expect(movedDown).not.toBeNull();
      if (movedDown) {
        expect(movedDown.x).toBe(piece.x);
        expect(movedDown.y).not.toBe(piece.y); // Should be different branded value
      }

      // Invalid move (blocked) - T piece spawn shape is [1,0], [0,1], [1,1], [2,1]
      const blockedBoard = setBoardCell(board, 5, 11, 1); // Block right-bottom cell
      const blockedMove = tryMove(blockedBoard, piece, 1, 0);
      expect(blockedMove).toBeNull();

      // Invalid move (out of bounds) - piece too far left
      const leftBoundPiece = createTestPiece("T", 0, 10, "spawn");
      const leftMove = tryMove(board, leftBoundPiece, -1, 0);
      expect(leftMove).toBeNull();
    });
  });

  describe("moveToWall()", () => {
    test("slides piece left/right until next move would collide; returns final x", () => {
      const board = createEmptyBoard();
      const piece = createTestPiece("T", 4, 10, "spawn");

      // Move right to wall (board boundary)
      const rightWall = moveToWall(board, piece, 1);
      // T piece has cells at relative positions [1,0], [0,1], [1,1], [2,1]
      // So rightmost cell is at +2 from piece.x
      // Board width is 10, so piece.x can be at most 7 (7+2=9, last valid column)
      expect(rightWall.x).not.toBe(piece.x); // Should move

      // Move left to wall (board boundary)
      const leftWall = moveToWall(board, piece, -1);
      // Leftmost cell is at +0 from piece.x, so piece.x can be at minimum 0
      expect(leftWall.x).not.toBe(piece.x); // Should move

      // Already at wall - piece already at right edge
      const rightEdgePiece = createTestPiece("T", 7, 10, "spawn");
      const noMoveRight = moveToWall(board, rightEdgePiece, 1);
      expect(noMoveRight).toBe(rightEdgePiece); // Should return same object when no movement

      // Blocked by other pieces - T piece spawn shape is [1,0], [0,1], [1,1], [2,1]
      // From position (4,10), if the piece moves right to (5,10), cells become: (6,10), (5,11), (6,11), (7,11)
      // Then if it tries to move to (6,10), cells would be: (7,10), (6,11), (7,11), (8,11)
      // Block position (7,10) so piece can move once but not twice
      const blockedBoard = setBoardCell(board, 7, 10, 1); // Block further movement right
      const blockedMove = moveToWall(blockedBoard, piece, 1);
      expect(blockedMove.x).not.toBe(piece.x); // Should move to just before the block
    });
  });

  describe("isAtBottom()", () => {
    test("true when cannot move down by one; false otherwise", () => {
      const board = createEmptyBoard();

      // Piece not at bottom
      const midPiece = createTestPiece("T", 4, 10, "spawn");
      expect(isAtBottom(board, midPiece)).toBe(false);

      // Piece at bottom of board - T piece spawn shape is [1,0], [0,1], [1,1], [2,1]
      // Bottommost cells are at +1 from piece.y, so piece.y=18 means bottom cells at y=19 (last row)
      const bottomPiece = createTestPiece("T", 4, 18, "spawn");
      expect(isAtBottom(board, bottomPiece)).toBe(true);

      // Piece blocked by other pieces
      const blockedBoard = setBoardCell(board, 4, 12, 1); // Block path down
      const blockedPiece = createTestPiece("T", 4, 10, "spawn"); // Bottom cell would be at y=11
      expect(isAtBottom(blockedBoard, blockedPiece)).toBe(true);
    });
  });

  describe("dropToBottom()", () => {
    test("returns piece at the lowest legal y", () => {
      const board = createEmptyBoard();
      const piece = createTestPiece("T", 4, 0, "spawn");

      // Drop to bottom of empty board
      const dropped = dropToBottom(board, piece);
      // T piece spawn shape bottommost cells at +1 from piece.y
      // So piece.y=18 means bottom cells at y=19 (last valid row)
      expect(dropped.y).not.toBe(piece.y); // Should move down
      expect(dropped.x).toBe(piece.x); // x unchanged
      expect(dropped.id).toBe(piece.id); // piece unchanged

      // Drop onto blocked surface
      const blockedBoard = setBoardCell(board, 4, 15, 1); // Block at y=15
      const droppedBlocked = dropToBottom(blockedBoard, piece);
      // Piece should stop just above the block
      expect(droppedBlocked.y).not.toBe(piece.y); // Should move down but not all the way
    });
  });

  describe("lockPiece()", () => {
    test("merges active piece cells into board", () => {
      const board = createEmptyBoard();
      const piece = createTestPiece("T", 4, 10, "spawn");

      // Lock piece onto empty board
      const locked = lockPiece(board, piece);

      // Check that locked board is different object
      expect(locked).not.toBe(board);
      expect(locked.cells).not.toBe(board.cells);

      // Check that T piece cells are set - T piece value is 3
      // T piece spawn shape is [1,0], [0,1], [1,1], [2,1] relative to piece position
      const expectedCells: Array<[number, number]> = [
        [5, 10], // piece.x(4) + 1, piece.y(10) + 0
        [4, 11], // piece.x(4) + 0, piece.y(10) + 1
        [5, 11], // piece.x(4) + 1, piece.y(10) + 1
        [6, 11], // piece.x(4) + 2, piece.y(10) + 1
      ];

      for (const [x, y] of expectedCells) {
        const cellValue =
          locked.cells[idx(locked, createGridCoord(x), createGridCoord(y))] ??
          0;
        expect(cellValue).toBe(3); // T piece value
      }

      // Check that other cells remain empty
      const otherCell =
        locked.cells[idx(locked, createGridCoord(0), createGridCoord(0))] ?? 0;
      expect(otherCell).toBe(0);
    });
  });

  describe("getCompletedLines()", () => {
    test("returns visible row indices fully filled (0..19), ignores vanish rows", () => {
      const emptyBoard = createEmptyBoard();

      // No complete lines in empty board
      const emptyLines = getCompletedLines(emptyBoard);
      expect(emptyLines).toEqual([]);

      // Single complete line
      const singleCompleteBoard = fillBoardRow(emptyBoard, 5, 2);
      const singleLines = getCompletedLines(singleCompleteBoard);
      expect(singleLines).toEqual([5]);

      // Vanish rows ignored even if filled
      const vanishFilledBoard = fillBoardRow(emptyBoard, -1, 7);
      const vanishLines = getCompletedLines(vanishFilledBoard);
      expect(vanishLines).toEqual([]); // Vanish rows ignored

      // Test mixed complete and incomplete lines
      let mixedBoard = fillBoardRow(emptyBoard, 8, 1); // Fill row 8 completely
      mixedBoard = fillBoardRow(mixedBoard, 12, 3); // Fill row 12 completely
      mixedBoard = fillBoardRow(mixedBoard, 10, 2); // Fill row 10 completely then make incomplete
      const partialMixed = setBoardCell(mixedBoard, 3, 10, 0); // Make line 10 incomplete by clearing one cell
      const mixedLines = getCompletedLines(partialMixed);
      expect(mixedLines).toEqual([8, 12]); // Only complete lines

      // Test all lines complete
      const allCompleteCustomCells: Record<number, number> = {};
      for (let y = 0; y < 20; y++) {
        for (let x = 0; x < 10; x++) {
          const index = idx(emptyBoard, createGridCoord(x), createGridCoord(y));
          allCompleteCustomCells[index] = 1;
        }
      }
      const allCompleteBoard = createTestBoard(allCompleteCustomCells);
      const allLines = getCompletedLines(allCompleteBoard);
      expect(allLines).toEqual([
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
      ]);
    });
  });

  describe("clearLines()", () => {
    test("compacts board, removes given rows, preserves vanish rows as-is", () => {
      const emptyBoard = createEmptyBoard();

      // Clearing no lines returns same board
      const noChange = clearLines(emptyBoard, []);
      expect(noChange).toBe(emptyBoard);

      // Test clearing single line - create board with data in row 5 and row 10
      let testBoard = setBoardCell(emptyBoard, 0, 5, 2);
      testBoard = setBoardCell(testBoard, 0, 10, 3);

      // Clear line 10, line 5 should shift down by 1 position
      const clearedSingle = clearLines(testBoard, [10]);

      // After clearing line 10, line 5 shifts down to position 6 (proper Tetris behavior)
      // The cleared line was below row 5, so row 5 moves down by 1
      expect(
        clearedSingle.cells[
          idx(clearedSingle, createGridCoord(0), createGridCoord(6))
        ],
      ).toBe(2);
      expect(
        clearedSingle.cells[
          idx(clearedSingle, createGridCoord(0), createGridCoord(5))
        ],
      ).toBe(0);

      // Test clearing multiple lines
      let multiBoard = setBoardCell(emptyBoard, 0, 5, 1);
      multiBoard = setBoardCell(multiBoard, 0, 10, 2);
      multiBoard = setBoardCell(multiBoard, 0, 15, 3);

      const clearedMultiple = clearLines(multiBoard, [5, 10]);
      // Line 15 stays at row 15 (no lines below it were cleared)
      expect(
        clearedMultiple.cells[
          idx(clearedMultiple, createGridCoord(0), createGridCoord(15))
        ],
      ).toBe(3);

      // Test vanish zone preservation - add data to vanish zone
      let vanishBoard = setBoardCell(emptyBoard, 0, -1, 5);
      vanishBoard = setBoardCell(vanishBoard, 0, 5, 1);
      vanishBoard = setBoardCell(vanishBoard, 0, 10, 2);

      const clearedWithVanish = clearLines(vanishBoard, [5]);
      // With vanish zone compaction fix: vanish zone row -1 should move to visible area
      expect(
        clearedWithVanish.cells[
          idx(clearedWithVanish, createGridCoord(0), createGridCoord(0))
        ] ?? 0,
      ).toBe(5);
      // Line 10 stays at row 10 (no lines below it were cleared)
      expect(
        clearedWithVanish.cells[
          idx(clearedWithVanish, createGridCoord(0), createGridCoord(10))
        ] ?? 0,
      ).toBe(2);
      // Vanish zone should now be empty
      expect(
        clearedWithVanish.cells[
          idx(clearedWithVanish, createGridCoord(0), createGridCoord(-1))
        ] ?? 0,
      ).toBe(0);
    });

    test("Vanish-zone rows are pulled down on line clear", () => {
      const b0 = createEmptyBoard();
      // put a single block in vanish at y = -1, x = 0
      const b1 = setBoardCell(b0, 0, -1, 1);
      // fill bottom visible row
      const b2 = fillBoardRow(b1, 19, 1);

      const b3 = clearLines(b2, [19]);

      // block that was at -1 should now be at y = 0
      expect(
        b3.cells[idx(b3, createGridCoord(0), createGridCoord(0))] ?? 0,
      ).toBe(1);
      // vanish cell at -1 should be cleared after compaction
      expect(
        b3.cells[idx(b3, createGridCoord(0), createGridCoord(-1))] ?? 0,
      ).toBe(0);
    });

    test("prevents vanish zone rows from overflowing when multiple lines are cleared at the bottom", () => {
      const b0 = createEmptyBoard();
      // Place blocks in multiple vanish zone rows
      let board = setBoardCell(b0, 0, -3, 1); // Top vanish row
      board = setBoardCell(board, 1, -2, 2); // Middle vanish row
      board = setBoardCell(board, 2, -1, 3); // Bottom vanish row

      // Fill bottom rows that will be cleared
      board = fillBoardRow(board, 18, 4);
      board = fillBoardRow(board, 19, 5);

      // Clear multiple bottom rows - this would try to pull all vanish rows down
      const result = clearLines(board, [18, 19]);

      // Only the bottom 2 vanish rows should fit in visible area
      expect(
        result.cells[idx(result, createGridCoord(1), createGridCoord(0))] ?? 0,
      ).toBe(2); // -2 → 0
      expect(
        result.cells[idx(result, createGridCoord(2), createGridCoord(1))] ?? 0,
      ).toBe(3); // -1 → 1

      // The top vanish row (-3) should be lost (would overflow beyond visible area)
      expect(
        result.cells[idx(result, createGridCoord(0), createGridCoord(-3))] ?? 0,
      ).toBe(0);
      expect(
        result.cells[idx(result, createGridCoord(0), createGridCoord(2))] ?? 0,
      ).toBe(0); // Not pulled down to row 2
    });

    test("handles clearing all visible rows while vanish zone has blocks", () => {
      const b0 = createEmptyBoard();
      // Place blocks in vanish zone
      let board = setBoardCell(b0, 0, -3, 1);
      board = setBoardCell(board, 1, -2, 2);
      board = setBoardCell(board, 2, -1, 3);

      // Fill all visible rows (0-19)
      for (let y = 0; y < 20; y++) {
        board = fillBoardRow(board, y, y + 10); // Use different values per row
      }

      // Clear ALL visible rows (extreme edge case)
      const allVisibleRows = Array.from({ length: 20 }, (_, i) => i);
      const result = clearLines(board, allVisibleRows);

      // All vanish zone blocks should move into visible area
      expect(
        result.cells[idx(result, createGridCoord(0), createGridCoord(17))] ?? 0,
      ).toBe(1); // -3 → 17
      expect(
        result.cells[idx(result, createGridCoord(1), createGridCoord(18))] ?? 0,
      ).toBe(2); // -2 → 18
      expect(
        result.cells[idx(result, createGridCoord(2), createGridCoord(19))] ?? 0,
      ).toBe(3); // -1 → 19

      // Rest of visible area should be empty
      expect(
        result.cells[idx(result, createGridCoord(0), createGridCoord(3))] ?? 0,
      ).toBe(0);
      expect(
        result.cells[idx(result, createGridCoord(0), createGridCoord(19))] ?? 0,
      ).toBe(0);

      // Vanish zone should be empty
      expect(
        result.cells[idx(result, createGridCoord(0), createGridCoord(-1))] ?? 0,
      ).toBe(0);
    });

    test("handles duplicate row numbers correctly", () => {
      const board = createEmptyBoard();
      // Create board with content at rows 5 and 10
      let testBoard = setBoardCell(board, 0, 5, 1);
      testBoard = setBoardCell(testBoard, 0, 10, 2);

      // Clear row 10 with duplicates [10, 10, 10]
      const resultWithDuplicates = clearLines(testBoard, [10, 10, 10]);
      // Clear row 10 normally [10]
      const resultNormal = clearLines(testBoard, [10]);

      // Both should produce identical results
      expect(resultWithDuplicates).toEqual(resultNormal);

      // Row 5 should shift down to row 6 in both cases
      expect(
        resultWithDuplicates.cells[
          idx(resultWithDuplicates, createGridCoord(0), createGridCoord(6))
        ],
      ).toBe(1);
      expect(
        resultNormal.cells[
          idx(resultNormal, createGridCoord(0), createGridCoord(6))
        ],
      ).toBe(1);
    });

    test("handles negative row numbers correctly", () => {
      const board = createEmptyBoard();
      // Create board with content at rows 5 and 10
      let testBoard = setBoardCell(board, 0, 5, 1);
      testBoard = setBoardCell(testBoard, 0, 10, 2);

      // Clear with negative and valid rows [-1, 10]
      const resultWithNegative = clearLines(testBoard, [-1, 10]);
      // Clear normally [10]
      const resultNormal = clearLines(testBoard, [10]);

      // Both should produce identical results (negative rows ignored)
      expect(resultWithNegative).toEqual(resultNormal);

      // Row 5 should shift down to row 6 in both cases
      expect(
        resultWithNegative.cells[
          idx(resultWithNegative, createGridCoord(0), createGridCoord(6))
        ],
      ).toBe(1);
    });

    test("handles out-of-range row numbers correctly", () => {
      const board = createEmptyBoard();
      // Create board with content at rows 5 and 10
      let testBoard = setBoardCell(board, 0, 5, 1);
      testBoard = setBoardCell(testBoard, 0, 10, 2);

      // Clear with out-of-range and valid rows [25, 10]
      const resultWithOutOfRange = clearLines(testBoard, [25, 10]);
      // Clear normally [10]
      const resultNormal = clearLines(testBoard, [10]);

      // Both should produce identical results (out-of-range rows ignored)
      expect(resultWithOutOfRange).toEqual(resultNormal);

      // Row 5 should shift down to row 6 in both cases
      expect(
        resultWithOutOfRange.cells[
          idx(resultWithOutOfRange, createGridCoord(0), createGridCoord(6))
        ],
      ).toBe(1);
    });

    test("handles mixed invalid inputs correctly", () => {
      const board = createEmptyBoard();
      // Create board with content at rows 5 and 10
      let testBoard = setBoardCell(board, 0, 5, 1);
      testBoard = setBoardCell(testBoard, 0, 10, 2);

      // Clear with mixed invalid inputs [-1, 10, 10, 25, -5]
      const resultWithMixed = clearLines(testBoard, [-1, 10, 10, 25, -5]);
      // Clear normally [10]
      const resultNormal = clearLines(testBoard, [10]);

      // Both should produce identical results (invalid rows ignored, duplicates removed)
      expect(resultWithMixed).toEqual(resultNormal);

      // Row 5 should shift down to row 6 in both cases
      expect(
        resultWithMixed.cells[
          idx(resultWithMixed, createGridCoord(0), createGridCoord(6))
        ],
      ).toBe(1);
    });

    test("returns unchanged board when all input rows are invalid", () => {
      const board = createEmptyBoard();
      const testBoard = setBoardCell(board, 0, 5, 1);

      // Clear with only invalid rows
      const result = clearLines(testBoard, [-1, -5, 25, 30]);

      // Board should be unchanged
      expect(result).toBe(testBoard);
    });
  });

  describe("calculateGhostPosition()", () => {
    test("returns same result as dropToBottom() - ghost piece positioning", () => {
      const board = createTestBoard();
      const piece = createTestPiece("T", 3, -2);

      const ghostPos = calculateGhostPosition(board, piece);
      const dropPos = dropToBottom(board, piece);

      // Should be identical to dropToBottom
      expect(ghostPos).toEqual(dropPos);
      expect(ghostPos.y).toBe(createGridCoord(18)); // Bottom of empty board
    });

    test("ghost position accounts for obstacles on board", () => {
      const board = createTestBoard({
        190: 1,
        191: 1,
        192: 1,
        193: 1, // Row 19, cells 0-3 filled
      });
      const piece = createTestPiece("T", 1, -2);

      const ghostPos = calculateGhostPosition(board, piece);

      // Should stop above the obstacle
      expect(ghostPos.y).toBe(createGridCoord(14)); // One row above obstacle
    });
  });

  describe("shiftUpAndInsertRow()", () => {
    test("shifts all rows up by one and inserts new row at bottom", () => {
      const board = createTestBoard({
        // Fill some cells in various rows for testing
        30: 1,
        31: 2, // Row 0 (y=0)
        50: 3,
        51: 4, // Row 2 (y=2)
      });

      const garbageRow = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0]; // Alternating pattern
      const newCells = shiftUpAndInsertRow(board, garbageRow);

      // Create expected board to compare
      const expectedBoard = { ...board, cells: newCells };

      // Original row 0 should have moved to row -1 (vanish zone)
      expect(
        newCells[idx(expectedBoard, createGridCoord(0), createGridCoord(-1))] ??
          0,
      ).toBe(1);
      expect(
        newCells[idx(expectedBoard, createGridCoord(1), createGridCoord(-1))] ??
          0,
      ).toBe(2);

      // Original row 2 should have moved to row 1
      expect(
        newCells[idx(expectedBoard, createGridCoord(0), createGridCoord(1))] ??
          0,
      ).toBe(3);
      expect(
        newCells[idx(expectedBoard, createGridCoord(1), createGridCoord(1))] ??
          0,
      ).toBe(4);

      // Bottom row (y=19) should contain the inserted garbage
      for (let x = 0; x < 10; x++) {
        expect(
          newCells[
            idx(expectedBoard, createGridCoord(x), createGridCoord(19))
          ] ?? 0,
        ).toBe(garbageRow[x] ?? 0);
      }
    });

    test("preserves vanish zone content during shift", () => {
      const board = createTestBoard({
        // Add content to vanish zone
        5: 7,
        6: 8, // Row -3 (y=-3)
        15: 5,
        16: 6, // Row -2 (y=-2)
      });

      const garbageRow = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
      const newCells = shiftUpAndInsertRow(board, garbageRow);
      const expectedBoard = { ...board, cells: newCells };

      // Original vanish zone content should have shifted up
      // Row -3 content goes to row -4 (out of bounds, so lost)
      // Row -2 content goes to row -3
      expect(
        newCells[idx(expectedBoard, createGridCoord(5), createGridCoord(-3))] ??
          0,
      ).toBe(5);
      expect(
        newCells[idx(expectedBoard, createGridCoord(6), createGridCoord(-3))] ??
          0,
      ).toBe(6);

      // Verify garbage row is at bottom
      expect(
        newCells[idx(expectedBoard, createGridCoord(0), createGridCoord(19))] ??
          0,
      ).toBe(2);
    });

    test("handles empty board correctly", () => {
      const board = createTestBoard(); // Empty board
      const garbageRow = [1, 2, 3, 4, 5, 6, 7, 8, 1, 2];
      const newCells = shiftUpAndInsertRow(board, garbageRow);
      const expectedBoard = { ...board, cells: newCells };

      // Most of the board should remain empty
      expect(
        newCells[idx(expectedBoard, createGridCoord(0), createGridCoord(0))] ??
          0,
      ).toBe(0);
      expect(
        newCells[idx(expectedBoard, createGridCoord(0), createGridCoord(10))] ??
          0,
      ).toBe(0);

      // Only bottom row should have the garbage
      for (let x = 0; x < 10; x++) {
        expect(
          newCells[
            idx(expectedBoard, createGridCoord(x), createGridCoord(19))
          ] ?? 0,
        ).toBe(garbageRow[x] ?? 0);
      }
    });

    test("returns BoardCells array with correct dimensions", () => {
      const board = createTestBoard();
      const garbageRow = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
      const newCells = shiftUpAndInsertRow(board, garbageRow);

      // Should return properly sized BoardCells
      expect(newCells).toHaveLength(230); // 23 * 10
      expect(newCells).toBeInstanceOf(Uint8Array);
    });

    test("handles short garbage row by filling remaining cells with 0", () => {
      const board = createTestBoard();
      const shortRow = [1, 2, 3]; // shorter than width 10
      const newCells = shiftUpAndInsertRow(board, shortRow);
      const expectedBoard = { ...board, cells: newCells };

      for (let x = 0; x < 10; x++) {
        const v =
          newCells[
            idx(expectedBoard, createGridCoord(x), createGridCoord(19))
          ] ?? 0;
        if (x < shortRow.length) {
          expect(v).toBe(shortRow[x] ?? 0);
        } else {
          expect(v).toBe(0);
        }
      }
    });
  });

  describe("Defensive fallbacks with truncated BoardCells (branch coverage)", () => {
    test("lockPiece: copies from truncated source using 0 fallback", () => {
      // Intentionally create an invalid board with too-short cells to exercise `?? 0` fallbacks
      const invalidCells = new Uint8Array(10) as unknown as Board["cells"]; // shorter than 230
      const invalidBoard: Board = {
        cells: invalidCells,
        height: 20,
        totalHeight: 23,
        vanishRows: 3,
        width: 10,
      };

      const piece = createTestPiece("T", 4, 10, "spawn");
      const locked = lockPiece(invalidBoard, piece);

      // Should succeed and produce a full-sized cells array
      expect(locked.cells).toHaveLength(230);
      // Expect some known cell from the piece to be written
      const v =
        locked.cells[idx(locked, createGridCoord(5), createGridCoord(10))] ?? 0;
      expect(v).toBe(3); // T piece value
    });

    test("clearLines: uses vanish copy fallback without throwing", () => {
      const invalidCells = new Uint8Array(10) as unknown as Board["cells"]; // shorter than 230
      const invalidBoard: Board = {
        cells: invalidCells,
        height: 20,
        totalHeight: 23,
        vanishRows: 3,
        width: 10,
      };

      // Clearing any line should not throw and should return a board with full-sized cells
      const cleared = clearLines(invalidBoard, [0]);
      expect(cleared.cells).toHaveLength(230);
    });

    test("shiftUpAndInsertRow: reads undefined from source and falls back to 0", () => {
      const invalidCells = new Uint8Array(10) as unknown as Board["cells"]; // shorter than 230
      const invalidBoard: Board = {
        cells: invalidCells,
        height: 20,
        totalHeight: 23,
        vanishRows: 3,
        width: 10,
      };

      const garbageRow = [9, 9, 9, 9, 9, 9, 9, 9, 9, 9];
      const newCells = shiftUpAndInsertRow(invalidBoard, garbageRow);

      // Bottom row should match provided garbage; shifted rows beyond source length default to 0
      for (let x = 0; x < 10; x++) {
        expect(
          newCells[
            idx(
              { ...invalidBoard, cells: newCells },
              createGridCoord(x),
              createGridCoord(19),
            )
          ] ?? 0,
        ).toBe(garbageRow[x] ?? 0);
      }
    });
  });
});
