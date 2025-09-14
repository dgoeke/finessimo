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
import {
  type ActivePiece,
  type Board,
  createBoardCells,
  createGridCoord,
  idx,
} from "@/engine/core/types";

// Helper functions for building test scenarios

function createTestBoard(customCells: Record<number, number> = {}): Board {
  const board = createEmptyBoard();
  const newCells = createBoardCells();

  // Copy existing cells
  for (let i = 0; i < board.cells.length; i++) {
    newCells[i] = board.cells[i] ?? 0;
  }

  // Apply custom cells
  for (const [indexStr, value] of Object.entries(customCells)) {
    const index = parseInt(indexStr, 10);
    newCells[index] = value;
  }

  return { ...board, cells: newCells };
}

function createTestPiece(
  id: "T" | "I" | "O" | "S" | "Z" | "L" | "J" = "T",
  x = 0,
  y = 0,
  rot: "spawn" | "right" | "two" | "left" = "spawn",
): ActivePiece {
  return {
    id,
    rot,
    x: createGridCoord(x),
    y: createGridCoord(y),
  };
}

function setBoardCell(
  board: Board,
  x: number,
  y: number,
  value: number,
): Board {
  const newCells = createBoardCells();
  for (let i = 0; i < board.cells.length; i++) {
    newCells[i] = board.cells[i] ?? 0;
  }
  const index = idx(board, createGridCoord(x), createGridCoord(y));
  newCells[index] = value;
  return { ...board, cells: newCells };
}

function fillBoardRow(board: Board, y: number, value = 1): Board {
  const newCells = createBoardCells();
  // Copy existing cells
  for (let i = 0; i < board.cells.length; i++) {
    newCells[i] = board.cells[i] ?? 0;
  }
  // Fill the specified row
  for (let x = 0; x < board.width; x++) {
    const index = idx(board, createGridCoord(x), createGridCoord(y));
    newCells[index] = value;
  }
  return { ...board, cells: newCells };
}

// Removed unused function createBoardWithFilledRows

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

      // Clear line 10, line 5 should move down to fill the gap
      const clearedSingle = clearLines(testBoard, [10]);

      // After clearing line 10, remaining lines compact downward
      // Line 5 should move down to become the bottom line since it's the only remaining data
      // So line 5 should end up at the bottom of the remaining lines
      // Since only line 5 has data and line 10 is cleared, line 5 should be at y=19
      expect(
        clearedSingle.cells[
          idx(clearedSingle, createGridCoord(0), createGridCoord(19))
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
      // Only line 15 should remain, compacted to the bottom
      expect(
        clearedMultiple.cells[
          idx(clearedMultiple, createGridCoord(0), createGridCoord(19))
        ],
      ).toBe(3);
      expect(
        clearedMultiple.cells[
          idx(clearedMultiple, createGridCoord(0), createGridCoord(15))
        ],
      ).toBe(0);

      // Test vanish zone preservation - add data to vanish zone
      let vanishBoard = setBoardCell(emptyBoard, 0, -1, 5);
      vanishBoard = setBoardCell(vanishBoard, 0, 5, 1);
      vanishBoard = setBoardCell(vanishBoard, 0, 10, 2);

      const clearedWithVanish = clearLines(vanishBoard, [5]);
      // Vanish zone should be preserved
      expect(
        clearedWithVanish.cells[
          idx(clearedWithVanish, createGridCoord(0), createGridCoord(-1))
        ] ?? 0,
      ).toBe(5);
      // Line 10 should move down to fill gap left by cleared line 5
      expect(
        clearedWithVanish.cells[
          idx(clearedWithVanish, createGridCoord(0), createGridCoord(19))
        ] ?? 0,
      ).toBe(2);
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
  });
});
