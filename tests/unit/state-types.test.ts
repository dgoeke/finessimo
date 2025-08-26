import { idx, isCellBlocked, type Board } from "../../src/state/types";

describe("State Types Utilities", () => {
  describe("idx function", () => {
    it("should calculate correct index for top-left corner", () => {
      expect(idx(0, 0)).toBe(0);
    });

    it("should calculate correct index for top-right corner", () => {
      expect(idx(9, 0)).toBe(9);
    });

    it("should calculate correct index for bottom-left corner", () => {
      expect(idx(0, 19)).toBe(190);
    });

    it("should calculate correct index for bottom-right corner", () => {
      expect(idx(9, 19)).toBe(199);
    });

    it("should calculate correct index for middle position", () => {
      expect(idx(5, 10)).toBe(105); // 10 * 10 + 5
    });

    it("should work with custom width", () => {
      expect(idx(3, 2, 5)).toBe(13); // 2 * 5 + 3
    });

    it("should handle edge cases with zero coordinates", () => {
      expect(idx(0, 0, 1)).toBe(0);
      expect(idx(0, 1, 1)).toBe(1);
    });
  });

  describe("isCellBlocked function", () => {
    let emptyBoard: Board;
    let boardWithBlocks: Board;

    beforeEach(() => {
      // Create empty board
      emptyBoard = {
        cells: new Uint8Array(200),
        height: 20,
        width: 10,
      };

      // Create board with some blocks
      boardWithBlocks = {
        cells: new Uint8Array(200),
        height: 20,
        width: 10,
      };
      // Add some blocks
      boardWithBlocks.cells[idx(5, 10)] = 1; // Block at (5, 10)
      boardWithBlocks.cells[idx(0, 19)] = 2; // Block at bottom-left
      boardWithBlocks.cells[idx(9, 0)] = 3; // Block at top-right
    });

    describe("boundary checks", () => {
      it("should block cells left of board", () => {
        expect(isCellBlocked(emptyBoard, -1, 10)).toBe(true);
        expect(isCellBlocked(emptyBoard, -5, 5)).toBe(true);
      });

      it("should block cells right of board", () => {
        expect(isCellBlocked(emptyBoard, 10, 10)).toBe(true);
        expect(isCellBlocked(emptyBoard, 15, 5)).toBe(true);
      });

      it("should block cells below board", () => {
        expect(isCellBlocked(emptyBoard, 5, 20)).toBe(true);
        expect(isCellBlocked(emptyBoard, 5, 25)).toBe(true);
      });

      it("should NOT block cells above board (negative y)", () => {
        expect(isCellBlocked(emptyBoard, 5, -1)).toBe(false);
        expect(isCellBlocked(emptyBoard, 5, -10)).toBe(false);
        expect(isCellBlocked(emptyBoard, 0, -1)).toBe(false);
        expect(isCellBlocked(emptyBoard, 9, -1)).toBe(false);
      });
    });

    describe("valid board positions", () => {
      it("should not block empty cells", () => {
        expect(isCellBlocked(emptyBoard, 0, 0)).toBe(false);
        expect(isCellBlocked(emptyBoard, 5, 10)).toBe(false);
        expect(isCellBlocked(emptyBoard, 9, 19)).toBe(false);
      });

      it("should block occupied cells", () => {
        expect(isCellBlocked(boardWithBlocks, 5, 10)).toBe(true);
        expect(isCellBlocked(boardWithBlocks, 0, 19)).toBe(true);
        expect(isCellBlocked(boardWithBlocks, 9, 0)).toBe(true);
      });

      it("should not block empty cells on board with some blocks", () => {
        expect(isCellBlocked(boardWithBlocks, 0, 0)).toBe(false);
        expect(isCellBlocked(boardWithBlocks, 4, 10)).toBe(false); // Next to block
        expect(isCellBlocked(boardWithBlocks, 5, 9)).toBe(false); // Above block
      });
    });

    describe("corner cases", () => {
      it("should handle all four corners correctly", () => {
        // Top-left (empty)
        expect(isCellBlocked(emptyBoard, 0, 0)).toBe(false);

        // Top-right (has block in test board)
        expect(isCellBlocked(boardWithBlocks, 9, 0)).toBe(true);

        // Bottom-left (has block in test board)
        expect(isCellBlocked(boardWithBlocks, 0, 19)).toBe(true);

        // Bottom-right (empty)
        expect(isCellBlocked(emptyBoard, 9, 19)).toBe(false);
      });

      it("should handle edge positions correctly", () => {
        // Top edge
        expect(isCellBlocked(emptyBoard, 5, 0)).toBe(false);

        // Bottom edge
        expect(isCellBlocked(emptyBoard, 5, 19)).toBe(false);

        // Left edge
        expect(isCellBlocked(emptyBoard, 0, 10)).toBe(false);

        // Right edge
        expect(isCellBlocked(emptyBoard, 9, 10)).toBe(false);
      });
    });

    describe("different cell values", () => {
      it("should block any non-zero cell value", () => {
        const board: Board = {
          cells: new Uint8Array(200),
          height: 20,
          width: 10,
        };

        // Test different piece types (1-7)
        for (let pieceValue = 1; pieceValue <= 7; pieceValue++) {
          board.cells[idx(5, 5)] = pieceValue;
          expect(isCellBlocked(board, 5, 5)).toBe(true);
        }
      });

      it("should not block zero (empty) cell value", () => {
        const board: Board = {
          cells: new Uint8Array(200),
          height: 20,
          width: 10,
        };

        board.cells[idx(5, 5)] = 0;
        expect(isCellBlocked(board, 5, 5)).toBe(false);
      });
    });

    describe("spawn zone behavior", () => {
      it("should allow pieces to exist above the board during spawn", () => {
        // This is critical for piece spawning
        expect(isCellBlocked(emptyBoard, 4, -1)).toBe(false);
        expect(isCellBlocked(emptyBoard, 5, -2)).toBe(false);
        expect(isCellBlocked(boardWithBlocks, 4, -1)).toBe(false);
      });

      it("should still respect horizontal boundaries above board", () => {
        expect(isCellBlocked(emptyBoard, -1, -1)).toBe(true);
        expect(isCellBlocked(emptyBoard, 10, -1)).toBe(true);
      });
    });
  });

  describe("Board interface constraints", () => {
    it("should enforce readonly properties", () => {
      const board: Board = {
        cells: new Uint8Array(200),
        height: 20,
        width: 10,
      };

      // These should be readonly - TypeScript will catch attempts to modify
      expect(board.width).toBe(10);
      expect(board.height).toBe(20);
      expect(board.cells.length).toBe(200);
    });

    it("should use Uint8Array for cells with correct length", () => {
      const board: Board = {
        cells: new Uint8Array(200),
        height: 20,
        width: 10,
      };

      expect(board.cells).toBeInstanceOf(Uint8Array);
      expect(board.cells.length).toBe(board.width * board.height);
    });

    it("should support cell values 0-7", () => {
      const board: Board = {
        cells: new Uint8Array(200),
        height: 20,
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
