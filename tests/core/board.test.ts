import {
  createEmptyBoard,
  canPlacePiece,
  canMove,
  tryMove,
  moveToWall,
  dropToBottom,
  calculateGhostPosition,
  isAtBottom,
  lockPiece,
  getCompletedLines,
  clearLines,
  shiftUpAndInsertRow,
} from "@/core/board";
import { type ActivePiece, type Board, type PieceId, idx } from "@/state/types";
import { createGridCoord } from "@/types/brands";

import { assertDefined } from "../test-helpers";

// Helper function for testing piece values
function testPieceValue(
  emptyBoard: Board,
  expected: number,
  id: PieceId,
): void {
  const piece: ActivePiece = {
    id,
    rot: "spawn",
    x: createGridCoord(4),
    y: createGridCoord(10),
  };

  const lockedBoard = lockPiece(emptyBoard, piece);
  const foundExpectedValue = [...lockedBoard.cells].some(
    (cell) => cell === expected,
  );
  expect(foundExpectedValue).toBe(true);
}

describe("Board Logic", () => {
  let emptyBoard: Board;

  beforeEach(() => {
    emptyBoard = createEmptyBoard();
  });

  describe("createEmptyBoard", () => {
    it("should create a 10x20 empty board", () => {
      expect(emptyBoard.width).toBe(10);
      expect(emptyBoard.height).toBe(20);
      expect(emptyBoard.cells.length).toBe(230);
      expect(emptyBoard.cells.every((cell) => cell === 0)).toBe(true);
    });
  });

  describe("canPlacePiece", () => {
    const tPiece: ActivePiece = {
      id: "T",
      rot: "spawn",
      x: createGridCoord(4),
      y: createGridCoord(2),
    };

    it("should allow placement on empty board", () => {
      expect(canPlacePiece(emptyBoard, tPiece)).toBe(true);
    });

    it("should prevent placement when overlapping with existing blocks", () => {
      const blockedBoard = createEmptyBoard();
      blockedBoard.cells[
        idx(blockedBoard, createGridCoord(5), createGridCoord(3))
      ] = 1; // Block at (5, 3) where T piece has a cell

      expect(canPlacePiece(blockedBoard, tPiece)).toBe(false);
    });

    it("should prevent placement outside board boundaries", () => {
      const leftPiece: ActivePiece = { ...tPiece, x: createGridCoord(-2) };
      const rightPiece: ActivePiece = { ...tPiece, x: createGridCoord(9) };
      const bottomPiece: ActivePiece = { ...tPiece, y: createGridCoord(19) };

      expect(canPlacePiece(emptyBoard, leftPiece)).toBe(false);
      expect(canPlacePiece(emptyBoard, rightPiece)).toBe(false);
      expect(canPlacePiece(emptyBoard, bottomPiece)).toBe(false);
    });

    it("should allow placement in vanish zone", () => {
      const highPiece: ActivePiece = { ...tPiece, y: createGridCoord(-1) };
      expect(canPlacePiece(emptyBoard, highPiece)).toBe(true);
    });

    it("should allow placement at vanish zone boundaries", () => {
      // Test placement at the top of vanish zone (y=-3)
      const topVanishPiece: ActivePiece = { ...tPiece, y: createGridCoord(-3) };
      expect(canPlacePiece(emptyBoard, topVanishPiece)).toBe(true);

      // Test placement at vanish/visible boundary (y=0)
      const boundaryPiece: ActivePiece = { ...tPiece, y: createGridCoord(0) };
      expect(canPlacePiece(emptyBoard, boundaryPiece)).toBe(true);
    });

    it("should prevent placement when extending beyond vanish zone", () => {
      // Create piece that would extend above y=-3
      const beyondVanishPiece: ActivePiece = {
        ...tPiece,
        y: createGridCoord(-4),
      };
      expect(canPlacePiece(emptyBoard, beyondVanishPiece)).toBe(false);
    });

    it("should handle collisions in vanish zone", () => {
      const boardWithVanishBlocks = createEmptyBoard();
      // Block a cell in vanish zone
      boardWithVanishBlocks.cells[
        idx(boardWithVanishBlocks, createGridCoord(5), createGridCoord(-1))
      ] = 1;

      const collidingPiece: ActivePiece = { ...tPiece, y: createGridCoord(-1) };
      expect(canPlacePiece(boardWithVanishBlocks, collidingPiece)).toBe(false);
    });
  });

  describe("canMove and tryMove", () => {
    const tPiece: ActivePiece = {
      id: "T",
      rot: "spawn",
      x: createGridCoord(4),
      y: createGridCoord(2),
    };

    it("should allow valid moves", () => {
      expect(canMove(emptyBoard, tPiece, 1, 0)).toBe(true); // Right
      expect(canMove(emptyBoard, tPiece, -1, 0)).toBe(true); // Left
      expect(canMove(emptyBoard, tPiece, 0, 1)).toBe(true); // Down
      expect(canMove(emptyBoard, tPiece, 0, -1)).toBe(true); // Up
    });

    it("should allow movement in vanish zone", () => {
      const vanishPiece: ActivePiece = { ...tPiece, y: createGridCoord(-2) };
      expect(canMove(emptyBoard, vanishPiece, 1, 0)).toBe(true); // Right in vanish
      expect(canMove(emptyBoard, vanishPiece, -1, 0)).toBe(true); // Left in vanish
      expect(canMove(emptyBoard, vanishPiece, 0, 1)).toBe(true); // Down from vanish to visible
      expect(canMove(emptyBoard, vanishPiece, 0, -1)).toBe(true); // Up within vanish
    });

    it("should prevent movement beyond vanish zone boundaries", () => {
      const topVanishPiece: ActivePiece = { ...tPiece, y: createGridCoord(-3) };
      expect(canMove(emptyBoard, topVanishPiece, 0, -1)).toBe(false); // Can't move above vanish zone
    });

    it("should prevent invalid moves", () => {
      const leftEdgePiece: ActivePiece = { ...tPiece, x: createGridCoord(0) }; // T-piece leftmost cell would be at x=-1
      const rightEdgePiece: ActivePiece = { ...tPiece, x: createGridCoord(7) }; // T-piece rightmost cell would be at x=9
      const bottomPiece: ActivePiece = { ...tPiece, y: createGridCoord(18) }; // T-piece bottom cell would be at y=19 (outside board)

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
      const leftEdgePiece: ActivePiece = { ...tPiece, x: createGridCoord(0) };
      const movedLeft = tryMove(emptyBoard, leftEdgePiece, -1, 0);
      expect(movedLeft).toBeNull();
    });
  });

  describe("moveToWall", () => {
    const tPiece: ActivePiece = {
      id: "T",
      rot: "spawn",
      x: createGridCoord(4),
      y: createGridCoord(2),
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
      const leftWallPiece: ActivePiece = { ...tPiece, x: createGridCoord(0) };
      const stillAtWall = moveToWall(emptyBoard, leftWallPiece, -1);
      expect(stillAtWall.x).toBe(0);
    });

    it("should stop before obstacles", () => {
      const blockedBoard = createEmptyBoard();
      blockedBoard.cells[
        idx(blockedBoard, createGridCoord(6), createGridCoord(2))
      ] = 1; // Block at (6, 2)

      const stoppedPiece = moveToWall(blockedBoard, tPiece, 1);
      expect(stoppedPiece.x).toBe(4); // Should stop before hitting the block
    });
  });

  describe("dropToBottom and isAtBottom", () => {
    const tPiece: ActivePiece = {
      id: "T",
      rot: "spawn",
      x: createGridCoord(4),
      y: createGridCoord(2),
    };

    it("should drop piece to bottom of empty board", () => {
      const droppedPiece = dropToBottom(emptyBoard, tPiece);
      expect(droppedPiece.y).toBe(18); // T piece bottom cells at y=19 (last row)
    });

    it("should detect when piece is at bottom", () => {
      const bottomPiece: ActivePiece = { ...tPiece, y: createGridCoord(18) };
      expect(isAtBottom(emptyBoard, bottomPiece)).toBe(true);
      expect(isAtBottom(emptyBoard, tPiece)).toBe(false);
    });

    it("should stop on obstacles", () => {
      const blockedBoard = createEmptyBoard();
      blockedBoard.cells[
        idx(blockedBoard, createGridCoord(4), createGridCoord(5))
      ] = 1; // Block at (4, 5)

      const droppedPiece = dropToBottom(blockedBoard, tPiece);
      expect(droppedPiece.y).toBe(3); // Should stop at y=3 (bottom cells at y=4, blocked at y=5)
    });
  });

  describe("lockPiece", () => {
    const tPiece: ActivePiece = {
      id: "T",
      rot: "spawn",
      x: createGridCoord(4),
      y: createGridCoord(2),
    };

    it("should place piece cells on board", () => {
      const lockedBoard = lockPiece(emptyBoard, tPiece);

      // T piece spawn shape: [[1,0],[0,1],[1,1],[2,1]]
      expect(
        lockedBoard.cells[
          idx(lockedBoard, createGridCoord(5), createGridCoord(2))
        ],
      ).toBe(3); // (5, 2) - T piece value is 3
      expect(
        lockedBoard.cells[
          idx(lockedBoard, createGridCoord(4), createGridCoord(3))
        ],
      ).toBe(3); // (4, 3)
      expect(
        lockedBoard.cells[
          idx(lockedBoard, createGridCoord(5), createGridCoord(3))
        ],
      ).toBe(3); // (5, 3)
      expect(
        lockedBoard.cells[
          idx(lockedBoard, createGridCoord(6), createGridCoord(3))
        ],
      ).toBe(3); // (6, 3)
    });

    it("should write to vanish zone cells when piece extends there", () => {
      const highPiece: ActivePiece = { ...tPiece, y: createGridCoord(-1) };
      const lockedBoard = lockPiece(emptyBoard, highPiece);

      // T piece at y=-1 has cells at y=-1 and y=0. Both should be locked with vanish zone support.
      // T spawn shape: [1,0],[0,1],[1,1],[2,1] -> at y=-1: [5,-1],[4,0],[5,0],[6,0]

      // Vanish zone cell should be written
      expect(
        lockedBoard.cells[
          idx(lockedBoard, createGridCoord(5), createGridCoord(-1))
        ],
      ).toBe(3); // (5, -1) in vanish zone

      // Visible area cells should also be written
      expect(
        lockedBoard.cells[
          idx(lockedBoard, createGridCoord(4), createGridCoord(0))
        ],
      ).toBe(3); // (4, 0)
      expect(
        lockedBoard.cells[
          idx(lockedBoard, createGridCoord(5), createGridCoord(0))
        ],
      ).toBe(3); // (5, 0)
      expect(
        lockedBoard.cells[
          idx(lockedBoard, createGridCoord(6), createGridCoord(0))
        ],
      ).toBe(3); // (6, 0)
    });

    it("should not write beyond vanish zone boundaries", () => {
      // Create a piece that would extend beyond the vanish zone (above y=-3)
      const veryHighPiece: ActivePiece = { ...tPiece, y: createGridCoord(-4) };
      const lockedBoard = lockPiece(emptyBoard, veryHighPiece);

      // T spawn shape: [1,0],[0,1],[1,1],[2,1] -> at y=-4: [5,-4],[4,-3],[5,-3],[6,-3]
      // Only cells within the storage range (y >= -3) should be written

      // Cell at y=-3 (within vanish zone) should be written
      expect(
        lockedBoard.cells[
          idx(lockedBoard, createGridCoord(4), createGridCoord(-3))
        ],
      ).toBe(3); // (4, -3)
      expect(
        lockedBoard.cells[
          idx(lockedBoard, createGridCoord(5), createGridCoord(-3))
        ],
      ).toBe(3); // (5, -3)
      expect(
        lockedBoard.cells[
          idx(lockedBoard, createGridCoord(6), createGridCoord(-3))
        ],
      ).toBe(3); // (6, -3)

      // The cell at y=-4 is beyond vanish zone and should not cause errors
      // (lockPiece should skip it, not throw an error)
      expect(lockedBoard.cells.length).toBe(230); // Still valid board
    });

    it("should handle piece entirely in vanish zone", () => {
      // I piece positioned entirely in vanish zone
      const iPiece: ActivePiece = {
        id: "I",
        rot: "spawn",
        x: createGridCoord(3),
        y: createGridCoord(-3),
      };
      const lockedBoard = lockPiece(emptyBoard, iPiece);

      // I spawn shape: [[0,1],[1,1],[2,1],[3,1]] -> at (3,-3): [[3,-2],[4,-2],[5,-2],[6,-2]]
      expect(
        lockedBoard.cells[
          idx(lockedBoard, createGridCoord(3), createGridCoord(-2))
        ],
      ).toBe(1); // I piece value is 1
      expect(
        lockedBoard.cells[
          idx(lockedBoard, createGridCoord(4), createGridCoord(-2))
        ],
      ).toBe(1);
      expect(
        lockedBoard.cells[
          idx(lockedBoard, createGridCoord(5), createGridCoord(-2))
        ],
      ).toBe(1);
      expect(
        lockedBoard.cells[
          idx(lockedBoard, createGridCoord(6), createGridCoord(-2))
        ],
      ).toBe(1);
    });

    it("should handle piece spanning vanish and visible zones", () => {
      // T piece positioned so it spans both zones
      const spanningPiece: ActivePiece = { ...tPiece, y: createGridCoord(-1) };
      const lockedBoard = lockPiece(emptyBoard, spanningPiece);

      // T spawn shape: [1,0],[0,1],[1,1],[2,1] -> at y=-1: [5,-1],[4,0],[5,0],[6,0]

      // Vanish zone cell (y=-1)
      expect(
        lockedBoard.cells[
          idx(lockedBoard, createGridCoord(5), createGridCoord(-1))
        ],
      ).toBe(3);

      // Visible zone cells (y=0)
      expect(
        lockedBoard.cells[
          idx(lockedBoard, createGridCoord(4), createGridCoord(0))
        ],
      ).toBe(3);
      expect(
        lockedBoard.cells[
          idx(lockedBoard, createGridCoord(5), createGridCoord(0))
        ],
      ).toBe(3);
      expect(
        lockedBoard.cells[
          idx(lockedBoard, createGridCoord(6), createGridCoord(0))
        ],
      ).toBe(3);
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
        boardWithLine.cells[
          idx(boardWithLine, createGridCoord(x), createGridCoord(19))
        ] = 1; // Fill bottom row
      }

      const completedLines = getCompletedLines(boardWithLine);
      expect(completedLines).toEqual([19]);
    });

    it("should detect multiple completed lines", () => {
      const boardWithLines = createEmptyBoard();
      // Fill rows 18 and 19
      for (let x = 0; x < 10; x++) {
        boardWithLines.cells[
          idx(boardWithLines, createGridCoord(x), createGridCoord(18))
        ] = 1;
        boardWithLines.cells[
          idx(boardWithLines, createGridCoord(x), createGridCoord(19))
        ] = 1;
      }

      const completedLines = getCompletedLines(boardWithLines);
      expect(completedLines).toEqual([18, 19]);
    });

    it("should not detect partially filled lines", () => {
      const boardWithPartialLine = createEmptyBoard();
      for (let x = 0; x < 9; x++) {
        // Fill only 9 out of 10 cells
        boardWithPartialLine.cells[
          idx(boardWithPartialLine, createGridCoord(x), createGridCoord(19))
        ] = 1;
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
      boardWithStacking.cells[
        idx(boardWithStacking, createGridCoord(0), createGridCoord(17))
      ] = 1; // Block at (0, 17)
      boardWithStacking.cells[
        idx(boardWithStacking, createGridCoord(1), createGridCoord(18))
      ] = 1; // Block at (1, 18)

      // Fill row 19 completely
      for (let x = 0; x < 10; x++) {
        boardWithStacking.cells[
          idx(boardWithStacking, createGridCoord(x), createGridCoord(19))
        ] = 1;
      }

      const clearedBoard = clearLines(boardWithStacking, [19]);

      // Check that blocks above dropped down
      expect(
        clearedBoard.cells[
          idx(clearedBoard, createGridCoord(0), createGridCoord(18))
        ],
      ).toBe(1); // (0, 17) -> (0, 18)
      expect(
        clearedBoard.cells[
          idx(clearedBoard, createGridCoord(1), createGridCoord(19))
        ],
      ).toBe(1); // (1, 18) -> (1, 19)

      // Check that original row 19 content is gone (the complete line)
      // Row 19 should only have the dropped block from (1, 18), rest should be empty
      for (let x = 0; x < 10; x++) {
        if (x === 1) {
          expect(
            clearedBoard.cells[
              idx(clearedBoard, createGridCoord(x), createGridCoord(19))
            ],
          ).toBe(1); // Block dropped from (1, 18)
        } else {
          expect(
            clearedBoard.cells[
              idx(clearedBoard, createGridCoord(x), createGridCoord(19))
            ],
          ).toBe(0); // Should be empty
        }
      }
    });

    it("should clear multiple lines correctly", () => {
      const boardWithMultipleLines = createEmptyBoard();

      // Place a block above the lines to be cleared
      boardWithMultipleLines.cells[
        idx(boardWithMultipleLines, createGridCoord(0), createGridCoord(16))
      ] = 1; // Block at (0, 16)

      // Fill rows 18 and 19
      for (let x = 0; x < 10; x++) {
        boardWithMultipleLines.cells[
          idx(boardWithMultipleLines, createGridCoord(x), createGridCoord(18))
        ] = 1;
        boardWithMultipleLines.cells[
          idx(boardWithMultipleLines, createGridCoord(x), createGridCoord(19))
        ] = 1;
      }

      const clearedBoard = clearLines(boardWithMultipleLines, [18, 19]);

      // Check that block dropped down by 2 rows
      expect(
        clearedBoard.cells[
          idx(clearedBoard, createGridCoord(0), createGridCoord(18))
        ],
      ).toBe(1); // (0, 16) -> (0, 18)

      // Check that rows 17 and above are empty (since only one block was placed)
      for (let x = 0; x < 10; x++) {
        if (x === 0) {
          // This cell has the dropped block
          continue;
        }
        expect(
          clearedBoard.cells[
            idx(clearedBoard, createGridCoord(x), createGridCoord(18))
          ],
        ).toBe(0);
      }

      // Check that row 19 is empty
      for (let x = 0; x < 10; x++) {
        expect(
          clearedBoard.cells[
            idx(clearedBoard, createGridCoord(x), createGridCoord(19))
          ],
        ).toBe(0);
      }
    });

    it("should preserve vanish zone contents when clearing visible lines", () => {
      const boardWithVanishAndLines = createEmptyBoard();

      // Place blocks in vanish zone
      boardWithVanishAndLines.cells[
        idx(boardWithVanishAndLines, createGridCoord(2), createGridCoord(-3))
      ] = 5;
      boardWithVanishAndLines.cells[
        idx(boardWithVanishAndLines, createGridCoord(7), createGridCoord(-1))
      ] = 6;

      // Create a complete line at y=19
      for (let x = 0; x < 10; x++) {
        boardWithVanishAndLines.cells[
          idx(boardWithVanishAndLines, createGridCoord(x), createGridCoord(19))
        ] = 1;
      }

      // Place a block above the complete line that should drop
      boardWithVanishAndLines.cells[
        idx(boardWithVanishAndLines, createGridCoord(3), createGridCoord(18))
      ] = 2;

      const clearedBoard = clearLines(boardWithVanishAndLines, [19]);

      // Vanish zone blocks should be preserved exactly
      expect(
        clearedBoard.cells[
          idx(clearedBoard, createGridCoord(2), createGridCoord(-3))
        ],
      ).toBe(5);
      expect(
        clearedBoard.cells[
          idx(clearedBoard, createGridCoord(7), createGridCoord(-1))
        ],
      ).toBe(6);

      // Block from y=18 should have dropped to y=19 (since y=19 was cleared)
      expect(
        clearedBoard.cells[
          idx(clearedBoard, createGridCoord(3), createGridCoord(19))
        ],
      ).toBe(2);

      // Complete line should be gone
      for (let x = 0; x < 10; x++) {
        if (x === 3) continue; // Skip the dropped block
        expect(
          clearedBoard.cells[
            idx(clearedBoard, createGridCoord(x), createGridCoord(19))
          ],
        ).toBe(0);
      }
    });

    it("should handle vanish zone with multiple line clears", () => {
      const boardWithVanishAndMultipleLines = createEmptyBoard();

      // Fill vanish zone with a pattern
      for (let y = -3; y <= -1; y++) {
        for (let x = 0; x < 5; x++) {
          boardWithVanishAndMultipleLines.cells[
            idx(
              boardWithVanishAndMultipleLines,
              createGridCoord(x),
              createGridCoord(y),
            )
          ] = 7; // Use value 7 to distinguish from other pieces
        }
      }

      // Create complete lines at y=18 and y=19
      for (let x = 0; x < 10; x++) {
        boardWithVanishAndMultipleLines.cells[
          idx(
            boardWithVanishAndMultipleLines,
            createGridCoord(x),
            createGridCoord(18),
          )
        ] = 1;
        boardWithVanishAndMultipleLines.cells[
          idx(
            boardWithVanishAndMultipleLines,
            createGridCoord(x),
            createGridCoord(19),
          )
        ] = 1;
      }

      // Place blocks that should drop
      boardWithVanishAndMultipleLines.cells[
        idx(
          boardWithVanishAndMultipleLines,
          createGridCoord(1),
          createGridCoord(16),
        )
      ] = 3;
      boardWithVanishAndMultipleLines.cells[
        idx(
          boardWithVanishAndMultipleLines,
          createGridCoord(8),
          createGridCoord(17),
        )
      ] = 4;

      const clearedBoard = clearLines(
        boardWithVanishAndMultipleLines,
        [18, 19],
      );

      // All vanish zone blocks should be preserved
      for (let y = -3; y <= -1; y++) {
        for (let x = 0; x < 5; x++) {
          expect(
            clearedBoard.cells[
              idx(clearedBoard, createGridCoord(x), createGridCoord(y))
            ],
          ).toBe(7);
        }
        for (let x = 5; x < 10; x++) {
          expect(
            clearedBoard.cells[
              idx(clearedBoard, createGridCoord(x), createGridCoord(y))
            ],
          ).toBe(0);
        }
      }

      // Blocks should have dropped by 2 rows
      expect(
        clearedBoard.cells[
          idx(clearedBoard, createGridCoord(1), createGridCoord(18))
        ],
      ).toBe(3); // (1,16) -> (1,18)
      expect(
        clearedBoard.cells[
          idx(clearedBoard, createGridCoord(8), createGridCoord(19))
        ],
      ).toBe(4); // (8,17) -> (8,19)
    });

    it("should handle empty vanish zone during line clearing", () => {
      const boardWithLine = createEmptyBoard();

      // Fill bottom row
      for (let x = 0; x < 10; x++) {
        boardWithLine.cells[
          idx(boardWithLine, createGridCoord(x), createGridCoord(19))
        ] = 1;
      }

      // Place a block above that will drop when the bottom line is cleared
      boardWithLine.cells[
        idx(boardWithLine, createGridCoord(5), createGridCoord(18))
      ] = 2;

      const clearedBoard = clearLines(boardWithLine, [19]);

      // Empty vanish zone should remain empty
      for (let y = -3; y <= -1; y++) {
        for (let x = 0; x < 10; x++) {
          expect(
            clearedBoard.cells[
              idx(clearedBoard, createGridCoord(x), createGridCoord(y))
            ],
          ).toBe(0);
        }
      }

      // Block from y=18 should have dropped to y=19 (since y=19 was cleared)
      expect(
        clearedBoard.cells[
          idx(clearedBoard, createGridCoord(5), createGridCoord(19))
        ],
      ).toBe(2);
    });

    it("should not mutate original board", () => {
      const originalBoard = createEmptyBoard();
      // Fill bottom row
      for (let x = 0; x < 10; x++) {
        originalBoard.cells[
          idx(originalBoard, createGridCoord(x), createGridCoord(19))
        ] = 1;
      }

      const clearedBoard = clearLines(originalBoard, [19]);

      // Original board should still have the filled row
      expect(
        originalBoard.cells[
          idx(originalBoard, createGridCoord(0), createGridCoord(19))
        ],
      ).toBe(1);
      // Cleared board should have empty bottom row
      expect(
        clearedBoard.cells[
          idx(clearedBoard, createGridCoord(0), createGridCoord(19))
        ],
      ).toBe(0);
      expect(clearedBoard !== originalBoard).toBe(true);
    });
  });

  describe("calculateGhostPosition", () => {
    const tPiece: ActivePiece = {
      id: "T",
      rot: "spawn",
      x: createGridCoord(4),
      y: createGridCoord(2),
    };

    it("should calculate ghost position at bottom of empty board", () => {
      const ghostPosition = calculateGhostPosition(emptyBoard, tPiece);
      expect(ghostPosition.y).toBe(18); // Same as dropToBottom
      expect(ghostPosition.x).toBe(4); // X position unchanged
      expect(ghostPosition.id).toBe("T"); // Piece properties preserved
      expect(ghostPosition.rot).toBe("spawn");
    });

    it("should calculate ghost position with obstacles", () => {
      const blockedBoard = createEmptyBoard();
      blockedBoard.cells[
        idx(blockedBoard, createGridCoord(4), createGridCoord(5))
      ] = 1; // Block at (4, 5)

      const ghostPosition = calculateGhostPosition(blockedBoard, tPiece);
      expect(ghostPosition.y).toBe(3); // Should stop at y=3 (bottom cells at y=4, blocked at y=5)
    });

    it("should handle piece already at bottom", () => {
      const bottomPiece: ActivePiece = { ...tPiece, y: createGridCoord(18) };
      const ghostPosition = calculateGhostPosition(emptyBoard, bottomPiece);
      expect(ghostPosition.y).toBe(18); // Should remain at same position
      expect(ghostPosition).toEqual(bottomPiece); // Should be identical
    });

    it("should calculate ghost position from vanish zone", () => {
      const vanishPiece: ActivePiece = { ...tPiece, y: createGridCoord(-2) };
      const ghostPosition = calculateGhostPosition(emptyBoard, vanishPiece);
      expect(ghostPosition.y).toBe(18); // Should drop to bottom from vanish zone
      expect(ghostPosition.x).toBe(4); // X unchanged
    });

    it("should calculate ghost position with vanish zone obstacles", () => {
      const blockedBoard = createEmptyBoard();
      // Place obstacle in vanish zone
      blockedBoard.cells[
        idx(blockedBoard, createGridCoord(5), createGridCoord(-1))
      ] = 1;

      const vanishPiece: ActivePiece = { ...tPiece, y: createGridCoord(-2) };
      const ghostPosition = calculateGhostPosition(blockedBoard, vanishPiece);

      // T piece spawn shape: [1,0],[0,1],[1,1],[2,1]
      // At (4,-2) has cells at [5,-2],[4,-1],[5,-1],[6,-1]
      // Cell at (5,-1) is blocked, so it should stop at y=-2 to avoid collision at y=-1
      expect(ghostPosition.y).toBe(-2); // Should stop at y=-2 due to collision at y=-1
    });

    it("should work with different piece types", () => {
      const iPiece: ActivePiece = {
        id: "I",
        rot: "spawn",
        x: createGridCoord(4),
        y: createGridCoord(2),
      };

      const ghostPosition = calculateGhostPosition(emptyBoard, iPiece);
      // I piece spawn shape has cells at y offsets [1], so bottom cells at y=18
      expect(ghostPosition.y).toBe(18);
      expect(ghostPosition.id).toBe("I");
    });
  });

  describe("shiftUpAndInsertRow", () => {
    it("should shift empty board and insert garbage row", () => {
      const garbageRow = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0] as const;
      const newCells = shiftUpAndInsertRow(emptyBoard, garbageRow);

      // Should create new cells array
      expect(newCells).not.toBe(emptyBoard.cells);
      expect(newCells.length).toBe(230); // Same length

      // New garbage row should be at bottom (y=19)
      for (let x = 0; x < 10; x++) {
        expect(
          newCells[idx(emptyBoard, createGridCoord(x), createGridCoord(19))],
        ).toBe(garbageRow[x]);
      }

      // All other cells should be empty (shifted up from empty board)
      for (let y = -3; y < 19; y++) {
        for (let x = 0; x < 10; x++) {
          expect(
            newCells[idx(emptyBoard, createGridCoord(x), createGridCoord(y))],
          ).toBe(0);
        }
      }
    });

    it("should shift board with existing content", () => {
      const boardWithContent = createEmptyBoard();

      // Place content in various positions
      boardWithContent.cells[
        idx(boardWithContent, createGridCoord(2), createGridCoord(-2))
      ] = 7; // Vanish zone
      boardWithContent.cells[
        idx(boardWithContent, createGridCoord(5), createGridCoord(10))
      ] = 3; // Middle
      boardWithContent.cells[
        idx(boardWithContent, createGridCoord(8), createGridCoord(18))
      ] = 2; // Near bottom

      const garbageRow = [0, 0, 0, 1, 1, 1, 0, 0, 0, 1] as const;
      const newCells = shiftUpAndInsertRow(boardWithContent, garbageRow);

      // Content should shift up by 1 row
      expect(
        newCells[idx(emptyBoard, createGridCoord(2), createGridCoord(-3))],
      ).toBe(7); // -2 → -3
      expect(
        newCells[idx(emptyBoard, createGridCoord(5), createGridCoord(9))],
      ).toBe(3); // 10 → 9
      expect(
        newCells[idx(emptyBoard, createGridCoord(8), createGridCoord(17))],
      ).toBe(2); // 18 → 17

      // Original positions should be cleared
      expect(
        newCells[idx(emptyBoard, createGridCoord(2), createGridCoord(-2))],
      ).toBe(0);
      expect(
        newCells[idx(emptyBoard, createGridCoord(5), createGridCoord(10))],
      ).toBe(0);
      expect(
        newCells[idx(emptyBoard, createGridCoord(8), createGridCoord(18))],
      ).toBe(0);

      // New garbage row should be at bottom
      for (let x = 0; x < 10; x++) {
        expect(
          newCells[idx(emptyBoard, createGridCoord(x), createGridCoord(19))],
        ).toBe(garbageRow[x]);
      }
    });

    it("should drop topmost vanish row when shifting", () => {
      const boardWithFullVanish = createEmptyBoard();

      // Fill vanish zone completely
      for (let y = -3; y <= -1; y++) {
        for (let x = 0; x < 10; x++) {
          boardWithFullVanish.cells[
            idx(boardWithFullVanish, createGridCoord(x), createGridCoord(y))
          ] = 5;
        }
      }

      // Place marker in topmost vanish row that should be dropped
      boardWithFullVanish.cells[
        idx(boardWithFullVanish, createGridCoord(0), createGridCoord(-3))
      ] = 9;

      const garbageRow = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] as const;
      const newCells = shiftUpAndInsertRow(boardWithFullVanish, garbageRow);

      // Topmost vanish row content should be gone (marker value 9 should not exist)
      const foundDroppedMarker = [...newCells].some((cell) => cell === 9);
      expect(foundDroppedMarker).toBe(false);

      // Content should have shifted up
      expect(
        newCells[idx(emptyBoard, createGridCoord(0), createGridCoord(-3))],
      ).toBe(5); // From -2 → -3
      expect(
        newCells[idx(emptyBoard, createGridCoord(0), createGridCoord(-2))],
      ).toBe(5); // From -1 → -2

      // New garbage at bottom
      expect(
        newCells[idx(emptyBoard, createGridCoord(0), createGridCoord(19))],
      ).toBe(1);
    });

    it("should handle boundary cases in garbage row", () => {
      const emptyRow = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as const;
      const fullRow = [8, 8, 8, 8, 8, 8, 8, 8, 8, 8] as const;
      const mixedRow = [1, 2, 3, 4, 5, 6, 7, 8, 0, 1] as const;

      // Test empty row
      const emptyResult = shiftUpAndInsertRow(emptyBoard, emptyRow);
      for (let x = 0; x < 10; x++) {
        expect(
          emptyResult[idx(emptyBoard, createGridCoord(x), createGridCoord(19))],
        ).toBe(0);
      }

      // Test full row
      const fullResult = shiftUpAndInsertRow(emptyBoard, fullRow);
      for (let x = 0; x < 10; x++) {
        expect(
          fullResult[idx(emptyBoard, createGridCoord(x), createGridCoord(19))],
        ).toBe(8);
      }

      // Test mixed row
      const mixedResult = shiftUpAndInsertRow(emptyBoard, mixedRow);
      for (let x = 0; x < 10; x++) {
        expect(
          mixedResult[idx(emptyBoard, createGridCoord(x), createGridCoord(19))],
        ).toBe(mixedRow[x]);
      }
    });

    it("should preserve board properties but return only cells", () => {
      const garbageRow = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0] as const;
      const result = shiftUpAndInsertRow(emptyBoard, garbageRow);

      // Should return cells array, not full board
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(230);

      // Original board should be unchanged
      expect(emptyBoard.cells.every((cell) => cell === 0)).toBe(true);
    });
  });

  describe("Edge cases and boundary conditions", () => {
    describe("getPieceValue coverage (via lockPiece)", () => {
      it("should map all piece types to correct cell values", () => {
        const pieceValueMapping = [
          { expected: 1, id: "I" as const },
          { expected: 2, id: "O" as const },
          { expected: 3, id: "T" as const },
          { expected: 4, id: "S" as const },
          { expected: 5, id: "Z" as const },
          { expected: 6, id: "J" as const },
          { expected: 7, id: "L" as const },
        ];

        for (const { expected, id } of pieceValueMapping) {
          testPieceValue(emptyBoard, expected, id);
        }
      });
    });

    describe("Boundary conditions for canMove", () => {
      it("should handle extreme coordinates safely", () => {
        const centerPiece: ActivePiece = {
          id: "T",
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(10),
        };

        // Large movements that would go out of bounds
        expect(canMove(emptyBoard, centerPiece, -10, 0)).toBe(false); // Far left
        expect(canMove(emptyBoard, centerPiece, 10, 0)).toBe(false); // Far right
        expect(canMove(emptyBoard, centerPiece, 0, 25)).toBe(false); // Far down
        expect(canMove(emptyBoard, centerPiece, 0, -15)).toBe(false); // Far up (beyond vanish)
      });

      it("should handle moves at exact boundaries", () => {
        // Test T piece at actual left boundary instead
        const leftEdgeTPiece: ActivePiece = {
          id: "T", // T spawn shape: [1,0],[0,1],[1,1],[2,1]
          rot: "spawn",
          x: createGridCoord(0), // At x=0: cells at (1,10),(0,11),(1,11),(2,11)
          y: createGridCoord(10),
        };

        const rightEdgeTPiece: ActivePiece = {
          id: "T",
          rot: "spawn",
          x: createGridCoord(7), // At x=7: cells at (8,10),(7,11),(8,11),(9,11) - rightmost at x=9
          y: createGridCoord(10),
        };

        // T piece at x=0 cannot move further left (would put cell at x=-1)
        expect(canMove(emptyBoard, leftEdgeTPiece, -1, 0)).toBe(false);
        // T piece at x=7 cannot move further right (would put cell at x=10)
        expect(canMove(emptyBoard, rightEdgeTPiece, 1, 0)).toBe(false);

        // Should be able to move inward
        expect(canMove(emptyBoard, leftEdgeTPiece, 1, 0)).toBe(true);
        expect(canMove(emptyBoard, rightEdgeTPiece, -1, 0)).toBe(true);
      });
    });

    describe("Complex collision scenarios", () => {
      it("should handle partial piece collisions correctly", () => {
        const boardWithScatteredBlocks = createEmptyBoard();

        // Create a scenario where only part of piece would collide
        boardWithScatteredBlocks.cells[
          idx(boardWithScatteredBlocks, createGridCoord(5), createGridCoord(5))
        ] = 1;

        const tPiece: ActivePiece = {
          id: "T",
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(4), // T piece cells: (5,4),(4,5),(5,5),(6,5)
        };

        // (5,5) position collides with existing block
        expect(canPlacePiece(boardWithScatteredBlocks, tPiece)).toBe(false);

        // Move slightly to avoid collision
        const shiftedPiece: ActivePiece = { ...tPiece, x: createGridCoord(3) };
        // Shifted cells: (4,4),(3,5),(4,5),(5,5) - still collides at (5,5)
        expect(canPlacePiece(boardWithScatteredBlocks, shiftedPiece)).toBe(
          false,
        );

        // Move to completely avoid collision
        const safePiece: ActivePiece = { ...tPiece, x: createGridCoord(1) };
        // Safe cells: (2,4),(1,5),(2,5),(3,5) - no collisions
        expect(canPlacePiece(boardWithScatteredBlocks, safePiece)).toBe(true);
      });
    });

    describe("Null coalescing edge cases", () => {
      it("should handle undefined cells in board operations", () => {
        // Create a board with some undefined values (simulate corrupted state)
        const corruptedBoard = createEmptyBoard();

        // Manually create undefined values (this is artificial but tests the null coalescing)
        Object.defineProperty(corruptedBoard.cells, "100", {
          configurable: true,
          value: undefined,
          writable: true,
        });

        const tPiece: ActivePiece = {
          id: "T",
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(10),
        };

        // lockPiece should handle undefined board cells gracefully
        const lockedBoard = lockPiece(corruptedBoard, tPiece);
        expect(lockedBoard.cells.length).toBe(230);

        // Should still place the piece correctly
        expect(
          lockedBoard.cells[
            idx(lockedBoard, createGridCoord(5), createGridCoord(10))
          ],
        ).toBe(3);
      });

      it("should handle undefined values in clearLines", () => {
        const boardWithCorruptedCell = createEmptyBoard();

        // Create a line to clear with some undefined values
        for (let x = 0; x < 10; x++) {
          const cellIndex = idx(
            boardWithCorruptedCell,
            createGridCoord(x),
            createGridCoord(19),
          );
          if (x < 5) {
            boardWithCorruptedCell.cells[cellIndex] = 1;
          } else {
            // Simulate undefined cell by using Object.defineProperty
            Object.defineProperty(
              boardWithCorruptedCell.cells,
              cellIndex.toString(),
              {
                configurable: true,
                value: undefined,
                writable: true,
              },
            );
          }
        }

        const clearedBoard = clearLines(boardWithCorruptedCell, [19]);

        // Should handle undefined values gracefully (convert to 0)
        expect(clearedBoard.cells.length).toBe(230);
        expect(
          clearedBoard.cells[
            idx(clearedBoard, createGridCoord(0), createGridCoord(19))
          ],
        ).toBe(0);
      });

      it("should handle sparse arrays in garbage row", () => {
        // Create array with holes (sparse array) to test undefined handling
        const sparseArray = new Array(10);
        sparseArray[0] = 1;
        sparseArray[2] = 3;
        sparseArray[4] = 5;
        sparseArray[5] = 6;
        sparseArray[6] = 7;
        sparseArray[7] = 8;
        sparseArray[8] = 9;
        sparseArray[9] = 0;
        // indices 1 and 3 are intentionally left undefined

        const newCells = shiftUpAndInsertRow(emptyBoard, sparseArray);

        // Should handle undefined values in garbage row (convert to 0)
        expect(
          newCells[idx(emptyBoard, createGridCoord(1), createGridCoord(19))],
        ).toBe(0);
        expect(
          newCells[idx(emptyBoard, createGridCoord(3), createGridCoord(19))],
        ).toBe(0);
        expect(
          newCells[idx(emptyBoard, createGridCoord(0), createGridCoord(19))],
        ).toBe(1);
        expect(
          newCells[idx(emptyBoard, createGridCoord(2), createGridCoord(19))],
        ).toBe(3);
        expect(
          newCells[idx(emptyBoard, createGridCoord(4), createGridCoord(19))],
        ).toBe(5);
      });
    });
  });
});
