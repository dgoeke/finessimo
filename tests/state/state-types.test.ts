import {
  idx,
  idxSafe,
  isCellBlocked,
  type Board,
  createBoardCells,
} from "../../src/state/types";
import { createGridCoord } from "../../src/types/brands";

// Test board helper
const createTestBoard = (): Board => ({
  cells: createBoardCells(),
  height: 20,
  totalHeight: 23,
  vanishRows: 3,
  width: 10,
});

describe("State Types Utilities", () => {
  describe("idx function", () => {
    const board = createTestBoard();
    it("should calculate correct index for top-left corner (y=0 -> storage index 30)", () => {
      expect(idx(board, createGridCoord(0), createGridCoord(0))).toBe(30); // y=0 -> storage row 3 -> index 30
    });

    it("should calculate correct index for top-right corner (y=0 -> storage index 39)", () => {
      expect(idx(board, createGridCoord(9), createGridCoord(0))).toBe(39); // y=0 -> storage row 3 -> index 39
    });

    it("should calculate correct index for bottom-left corner (y=19 -> storage index 220)", () => {
      expect(idx(board, createGridCoord(0), createGridCoord(19))).toBe(220); // y=19 -> storage row 22 -> index 220
    });

    it("should calculate correct index for bottom-right corner (y=19 -> storage index 229)", () => {
      expect(idx(board, createGridCoord(9), createGridCoord(19))).toBe(229); // y=19 -> storage row 22 -> index 229
    });

    it("should calculate correct index for middle position (y=10 -> storage index 135)", () => {
      expect(idx(board, createGridCoord(5), createGridCoord(10))).toBe(135); // y=10 -> storage row 13 -> index 135
    });

    it("should work with standard board width (y=2 -> storage index 53)", () => {
      expect(idx(board, createGridCoord(3), createGridCoord(2))).toBe(53); // y=2 -> storage row 5 -> index 53
    });

    it("should handle edge cases with zero coordinates", () => {
      expect(idx(board, createGridCoord(0), createGridCoord(0))).toBe(30); // y=0 -> storage row 3
      expect(idx(board, createGridCoord(0), createGridCoord(1))).toBe(40); // y=1 -> storage row 4
    });

    it("should handle vanish zone coordinates", () => {
      expect(idx(board, createGridCoord(0), createGridCoord(-3))).toBe(0); // y=-3 -> storage row 0
      expect(idx(board, createGridCoord(5), createGridCoord(-1))).toBe(25); // y=-1 -> storage row 2 -> index 25
    });
  });

  describe("isCellBlocked function", () => {
    let emptyBoard: Board;
    let boardWithBlocks: Board;

    beforeEach(() => {
      // Create empty board
      emptyBoard = {
        cells: createBoardCells(),
        height: 20,
        totalHeight: 23,
        vanishRows: 3,
        width: 10,
      };

      // Create board with some blocks
      boardWithBlocks = {
        cells: createBoardCells(),
        height: 20,
        totalHeight: 23,
        vanishRows: 3,
        width: 10,
      };
      // Add some blocks
      boardWithBlocks.cells[
        idx(boardWithBlocks, createGridCoord(5), createGridCoord(10))
      ] = 1; // Block at (5, 10)
      boardWithBlocks.cells[
        idx(boardWithBlocks, createGridCoord(0), createGridCoord(19))
      ] = 2; // Block at bottom-left
      boardWithBlocks.cells[
        idx(boardWithBlocks, createGridCoord(9), createGridCoord(0))
      ] = 3; // Block at top-right
    });

    describe("boundary checks", () => {
      it("should block cells left of board", () => {
        expect(
          isCellBlocked(emptyBoard, createGridCoord(-1), createGridCoord(10)),
        ).toBe(true);
        expect(
          isCellBlocked(emptyBoard, createGridCoord(-5), createGridCoord(5)),
        ).toBe(true);
      });

      it("should block cells right of board", () => {
        expect(
          isCellBlocked(emptyBoard, createGridCoord(10), createGridCoord(10)),
        ).toBe(true);
        expect(
          isCellBlocked(emptyBoard, createGridCoord(15), createGridCoord(5)),
        ).toBe(true);
      });

      it("should block cells below board", () => {
        expect(
          isCellBlocked(emptyBoard, createGridCoord(5), createGridCoord(20)),
        ).toBe(true);
        expect(
          isCellBlocked(emptyBoard, createGridCoord(5), createGridCoord(25)),
        ).toBe(true);
      });

      it("should handle vanish zone and above-vanish boundaries", () => {
        // Vanish zone (-3..-1) should check cell contents (empty = not blocked)
        expect(
          isCellBlocked(emptyBoard, createGridCoord(5), createGridCoord(-1)),
        ).toBe(false);
        expect(
          isCellBlocked(emptyBoard, createGridCoord(5), createGridCoord(-2)),
        ).toBe(false);
        expect(
          isCellBlocked(emptyBoard, createGridCoord(5), createGridCoord(-3)),
        ).toBe(false);

        // Beyond vanish zone (< -3) should be blocked
        expect(
          isCellBlocked(emptyBoard, createGridCoord(5), createGridCoord(-4)),
        ).toBe(true);
        expect(
          isCellBlocked(emptyBoard, createGridCoord(5), createGridCoord(-10)),
        ).toBe(true);
      });
    });

    describe("valid board positions", () => {
      it("should not block empty cells", () => {
        expect(
          isCellBlocked(emptyBoard, createGridCoord(0), createGridCoord(0)),
        ).toBe(false);
        expect(
          isCellBlocked(emptyBoard, createGridCoord(5), createGridCoord(10)),
        ).toBe(false);
        expect(
          isCellBlocked(emptyBoard, createGridCoord(9), createGridCoord(19)),
        ).toBe(false);
      });

      it("should block occupied cells", () => {
        expect(
          isCellBlocked(
            boardWithBlocks,
            createGridCoord(5),
            createGridCoord(10),
          ),
        ).toBe(true);
        expect(
          isCellBlocked(
            boardWithBlocks,
            createGridCoord(0),
            createGridCoord(19),
          ),
        ).toBe(true);
        expect(
          isCellBlocked(
            boardWithBlocks,
            createGridCoord(9),
            createGridCoord(0),
          ),
        ).toBe(true);
      });

      it("should not block empty cells on board with some blocks", () => {
        expect(
          isCellBlocked(
            boardWithBlocks,
            createGridCoord(0),
            createGridCoord(0),
          ),
        ).toBe(false);
        expect(
          isCellBlocked(
            boardWithBlocks,
            createGridCoord(4),
            createGridCoord(10),
          ),
        ).toBe(false); // Next to block
        expect(
          isCellBlocked(
            boardWithBlocks,
            createGridCoord(5),
            createGridCoord(9),
          ),
        ).toBe(false); // Above block
      });
    });

    describe("corner cases", () => {
      it("should handle all four corners correctly", () => {
        // Top-left (empty)
        expect(
          isCellBlocked(emptyBoard, createGridCoord(0), createGridCoord(0)),
        ).toBe(false);

        // Top-right (has block in test board)
        expect(
          isCellBlocked(
            boardWithBlocks,
            createGridCoord(9),
            createGridCoord(0),
          ),
        ).toBe(true);

        // Bottom-left (has block in test board)
        expect(
          isCellBlocked(
            boardWithBlocks,
            createGridCoord(0),
            createGridCoord(19),
          ),
        ).toBe(true);

        // Bottom-right (empty)
        expect(
          isCellBlocked(emptyBoard, createGridCoord(9), createGridCoord(19)),
        ).toBe(false);
      });

      it("should handle edge positions correctly", () => {
        // Top edge
        expect(
          isCellBlocked(emptyBoard, createGridCoord(5), createGridCoord(0)),
        ).toBe(false);

        // Bottom edge
        expect(
          isCellBlocked(emptyBoard, createGridCoord(5), createGridCoord(19)),
        ).toBe(false);

        // Left edge
        expect(
          isCellBlocked(emptyBoard, createGridCoord(0), createGridCoord(10)),
        ).toBe(false);

        // Right edge
        expect(
          isCellBlocked(emptyBoard, createGridCoord(9), createGridCoord(10)),
        ).toBe(false);
      });
    });

    describe("different cell values", () => {
      it("should block any non-zero cell value", () => {
        const board: Board = {
          cells: createBoardCells(),
          height: 20,
          totalHeight: 23,
          vanishRows: 3,
          width: 10,
        };

        // Test different piece types (1-7)
        for (let pieceValue = 1; pieceValue <= 7; pieceValue++) {
          board.cells[idx(board, createGridCoord(5), createGridCoord(5))] =
            pieceValue;
          expect(
            isCellBlocked(board, createGridCoord(5), createGridCoord(5)),
          ).toBe(true);
        }
      });

      it("should not block zero (empty) cell value", () => {
        const board: Board = {
          cells: createBoardCells(),
          height: 20,
          totalHeight: 23,
          vanishRows: 3,
          width: 10,
        };

        board.cells[idx(board, createGridCoord(5), createGridCoord(5))] = 0;
        expect(
          isCellBlocked(board, createGridCoord(5), createGridCoord(5)),
        ).toBe(false);
      });
    });

    describe("vanish zone behavior", () => {
      it("should allow pieces in empty vanish zone cells", () => {
        // Vanish zone cells that are empty should not block
        expect(
          isCellBlocked(emptyBoard, createGridCoord(4), createGridCoord(-1)),
        ).toBe(false);
        expect(
          isCellBlocked(emptyBoard, createGridCoord(5), createGridCoord(-2)),
        ).toBe(false);
        expect(
          isCellBlocked(emptyBoard, createGridCoord(5), createGridCoord(-3)),
        ).toBe(false);
      });

      it("should block pieces when vanish zone cells are occupied", () => {
        // Create a board with occupied vanish zone cells
        const boardWithVanishBlocks: Board = {
          cells: createBoardCells(),
          height: 20,
          totalHeight: 23,
          vanishRows: 3,
          width: 10,
        };

        // Place blocks in vanish zone
        boardWithVanishBlocks.cells[
          idx(boardWithVanishBlocks, createGridCoord(5), createGridCoord(-1))
        ] = 1;
        boardWithVanishBlocks.cells[
          idx(boardWithVanishBlocks, createGridCoord(3), createGridCoord(-2))
        ] = 2;

        // These should now be blocked due to occupied cells
        expect(
          isCellBlocked(
            boardWithVanishBlocks,
            createGridCoord(5),
            createGridCoord(-1),
          ),
        ).toBe(true);
        expect(
          isCellBlocked(
            boardWithVanishBlocks,
            createGridCoord(3),
            createGridCoord(-2),
          ),
        ).toBe(true);

        // Adjacent empty cells should still be unblocked
        expect(
          isCellBlocked(
            boardWithVanishBlocks,
            createGridCoord(4),
            createGridCoord(-1),
          ),
        ).toBe(false);
        expect(
          isCellBlocked(
            boardWithVanishBlocks,
            createGridCoord(4),
            createGridCoord(-2),
          ),
        ).toBe(false);
      });

      it("should still respect horizontal boundaries in vanish zone", () => {
        expect(
          isCellBlocked(emptyBoard, createGridCoord(-1), createGridCoord(-1)),
        ).toBe(true);
        expect(
          isCellBlocked(emptyBoard, createGridCoord(10), createGridCoord(-1)),
        ).toBe(true);
        expect(
          isCellBlocked(emptyBoard, createGridCoord(-1), createGridCoord(-3)),
        ).toBe(true);
        expect(
          isCellBlocked(emptyBoard, createGridCoord(10), createGridCoord(-3)),
        ).toBe(true);
      });

      it("should handle boundary between vanish zone and beyond-vanish correctly", () => {
        // Vanish zone boundary (y = -3) should check contents
        expect(
          isCellBlocked(emptyBoard, createGridCoord(5), createGridCoord(-3)),
        ).toBe(false);

        // Beyond vanish zone (y = -4) should always be blocked
        expect(
          isCellBlocked(emptyBoard, createGridCoord(5), createGridCoord(-4)),
        ).toBe(true);
      });
    });
  });

  describe("idxSafe function", () => {
    const board = createTestBoard();

    it("should work identically to idx for valid coordinates", () => {
      // Test various valid coordinates throughout the storage
      expect(idxSafe(board, createGridCoord(0), createGridCoord(-3))).toBe(
        idx(board, createGridCoord(0), createGridCoord(-3)),
      ); // vanish zone top-left
      expect(idxSafe(board, createGridCoord(9), createGridCoord(-1))).toBe(
        idx(board, createGridCoord(9), createGridCoord(-1)),
      ); // vanish zone top-right
      expect(idxSafe(board, createGridCoord(5), createGridCoord(0))).toBe(
        idx(board, createGridCoord(5), createGridCoord(0)),
      ); // visible area top-center
      expect(idxSafe(board, createGridCoord(0), createGridCoord(19))).toBe(
        idx(board, createGridCoord(0), createGridCoord(19)),
      ); // visible area bottom-left
      expect(idxSafe(board, createGridCoord(9), createGridCoord(19))).toBe(
        idx(board, createGridCoord(9), createGridCoord(19)),
      ); // visible area bottom-right
    });

    it("should throw for coordinates left of board", () => {
      expect(() =>
        idxSafe(board, createGridCoord(-1), createGridCoord(0)),
      ).toThrow("idxSafe: out-of-bounds");
      expect(() =>
        idxSafe(board, createGridCoord(-5), createGridCoord(10)),
      ).toThrow("idxSafe: out-of-bounds");
      expect(() =>
        idxSafe(board, createGridCoord(-1), createGridCoord(-1)),
      ).toThrow("idxSafe: out-of-bounds"); // vanish zone
    });

    it("should throw for coordinates right of board", () => {
      expect(() =>
        idxSafe(board, createGridCoord(10), createGridCoord(0)),
      ).toThrow("idxSafe: out-of-bounds");
      expect(() =>
        idxSafe(board, createGridCoord(15), createGridCoord(10)),
      ).toThrow("idxSafe: out-of-bounds");
      expect(() =>
        idxSafe(board, createGridCoord(10), createGridCoord(-1)),
      ).toThrow("idxSafe: out-of-bounds"); // vanish zone
    });

    it("should throw for coordinates below visible board", () => {
      expect(() =>
        idxSafe(board, createGridCoord(0), createGridCoord(20)),
      ).toThrow("idxSafe: out-of-bounds");
      expect(() =>
        idxSafe(board, createGridCoord(5), createGridCoord(25)),
      ).toThrow("idxSafe: out-of-bounds");
      expect(() =>
        idxSafe(board, createGridCoord(9), createGridCoord(20)),
      ).toThrow("idxSafe: out-of-bounds");
    });

    it("should throw for coordinates above vanish zone", () => {
      expect(() =>
        idxSafe(board, createGridCoord(0), createGridCoord(-4)),
      ).toThrow("idxSafe: out-of-bounds");
      expect(() =>
        idxSafe(board, createGridCoord(5), createGridCoord(-10)),
      ).toThrow("idxSafe: out-of-bounds");
      expect(() =>
        idxSafe(board, createGridCoord(9), createGridCoord(-4)),
      ).toThrow("idxSafe: out-of-bounds");
    });

    it("should handle vanish zone boundary correctly", () => {
      // Vanish zone starts at y=-3 (valid)
      expect(() =>
        idxSafe(board, createGridCoord(5), createGridCoord(-3)),
      ).not.toThrow();
      // Above vanish zone at y=-4 (invalid)
      expect(() =>
        idxSafe(board, createGridCoord(5), createGridCoord(-4)),
      ).toThrow("idxSafe: out-of-bounds");
    });

    it("should handle visible area boundary correctly", () => {
      // Visible area ends at y=19 (valid)
      expect(() =>
        idxSafe(board, createGridCoord(5), createGridCoord(19)),
      ).not.toThrow();
      // Below visible area at y=20 (invalid)
      expect(() =>
        idxSafe(board, createGridCoord(5), createGridCoord(20)),
      ).toThrow("idxSafe: out-of-bounds");
    });

    it("should handle all four corner boundaries", () => {
      // Valid corners
      expect(() =>
        idxSafe(board, createGridCoord(0), createGridCoord(-3)),
      ).not.toThrow(); // vanish top-left
      expect(() =>
        idxSafe(board, createGridCoord(9), createGridCoord(-3)),
      ).not.toThrow(); // vanish top-right
      expect(() =>
        idxSafe(board, createGridCoord(0), createGridCoord(19)),
      ).not.toThrow(); // visible bottom-left
      expect(() =>
        idxSafe(board, createGridCoord(9), createGridCoord(19)),
      ).not.toThrow(); // visible bottom-right

      // Invalid corners (one step beyond boundaries)
      expect(() =>
        idxSafe(board, createGridCoord(-1), createGridCoord(-3)),
      ).toThrow("idxSafe: out-of-bounds"); // left edge
      expect(() =>
        idxSafe(board, createGridCoord(10), createGridCoord(-3)),
      ).toThrow("idxSafe: out-of-bounds"); // right edge
      expect(() =>
        idxSafe(board, createGridCoord(0), createGridCoord(-4)),
      ).toThrow("idxSafe: out-of-bounds"); // above vanish
      expect(() =>
        idxSafe(board, createGridCoord(0), createGridCoord(20)),
      ).toThrow("idxSafe: out-of-bounds"); // below visible
    });
  });

  describe("Board interface constraints", () => {
    it("should enforce readonly properties", () => {
      const board: Board = {
        cells: createBoardCells(),
        height: 20,
        totalHeight: 23,
        vanishRows: 3,
        width: 10,
      };

      // These should be readonly - TypeScript will catch attempts to modify
      expect(board.width).toBe(10);
      expect(board.height).toBe(20);
      expect(board.cells.length).toBe(230);
    });

    it("should use Uint8Array for cells with correct length", () => {
      const board: Board = {
        cells: createBoardCells(),
        height: 20,
        totalHeight: 23,
        vanishRows: 3,
        width: 10,
      };

      expect(board.cells).toBeInstanceOf(Uint8Array);
      expect(board.cells.length).toBe(board.width * board.totalHeight);
    });

    it("should support cell values 0-7", () => {
      const board: Board = {
        cells: createBoardCells(),
        height: 20,
        totalHeight: 23,
        vanishRows: 3,
        width: 10,
      };

      // Test that we can set all valid values
      for (let value = 0; value <= 7; value++) {
        board.cells[0] = value;
        expect(board.cells[0]).toBe(value);
      }
    });
  });
});
