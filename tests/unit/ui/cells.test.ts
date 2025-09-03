import { describe, it, expect, beforeEach } from "@jest/globals";

// PIECES removed - not used in simplified tests
import { createEmptyBoard } from "../../../src/core/board";
import { idx } from "../../../src/state/types";
import { createGridCoord } from "../../../src/types/brands";
import {
  getCellColor,
  isWithinBounds,
  renderBoardCells,
  renderActivePieceCells,
} from "../../../src/ui/renderers/cells";
import {
  asCellSizePx,
  asBoardCols,
  asVisibleRows,
  asVanishRows,
  asPixelY,
} from "../../../src/ui/types/brands-render";

import type { Board, ActivePiece } from "../../../src/state/types";
import type { BoardViewport } from "../../../src/ui/types/brands-render";

describe("cells renderer", () => {
  let mockCtx: CanvasRenderingContext2D;
  let viewport: BoardViewport;

  beforeEach(() => {
    // Create mock canvas context with all required methods
    const mockGradient = {
      addColorStop: jest.fn(),
    };

    const fillRect = jest.fn();
    const strokeRect = jest.fn();
    const createLinearGradient = jest.fn().mockReturnValue(mockGradient);

    mockCtx = {
      createLinearGradient,
      fillRect,
      fillStyle: "#000000",
      lineWidth: 1,
      strokeRect,
      strokeStyle: "#000000",
    } as unknown as CanvasRenderingContext2D;

    viewport = {
      cell: asCellSizePx(30),
      cols: asBoardCols(10),
      vanishRows: asVanishRows(3), // Match board vanish rows
      visibleRows: asVisibleRows(20),
    } as const;
  });

  describe("getCellColor", () => {
    it("should return correct colors for all piece types", () => {
      expect(getCellColor(0)).toBe("#000000"); // empty (shouldn't be used)
      expect(getCellColor(1)).toBe("#00FFFF"); // I piece - cyan
      expect(getCellColor(2)).toBe("#FFFF00"); // O piece - yellow
      expect(getCellColor(3)).toBe("#FF00FF"); // T piece - magenta
      expect(getCellColor(4)).toBe("#00FF00"); // S piece - green
      expect(getCellColor(5)).toBe("#FF0000"); // Z piece - red
      expect(getCellColor(6)).toBe("#0000FF"); // J piece - blue
      expect(getCellColor(7)).toBe("#FF7F00"); // L piece - orange
    });

    it("should return white for invalid cell values", () => {
      expect(getCellColor(8)).toBe("#ffffff");
      expect(getCellColor(-1)).toBe("#ffffff");
      expect(getCellColor(100)).toBe("#ffffff");
    });

    it("should handle non-integer cell values", () => {
      expect(getCellColor(1.5)).toBe("#ffffff");
      expect(getCellColor(NaN)).toBe("#ffffff");
      expect(getCellColor(Infinity)).toBe("#ffffff");
    });
  });

  describe("isWithinBounds", () => {
    it("should return true for coordinates within visible play area", () => {
      expect(isWithinBounds(0, 0, viewport)).toBe(true);
      expect(isWithinBounds(9, 19, viewport)).toBe(true);
      expect(isWithinBounds(5, 10, viewport)).toBe(true);
    });

    it("should return true for coordinates in vanish zone", () => {
      expect(isWithinBounds(0, -2, viewport)).toBe(true);
      expect(isWithinBounds(9, -1, viewport)).toBe(true);
      expect(isWithinBounds(5, -2, viewport)).toBe(true);
    });

    it("should return false for coordinates outside horizontal bounds", () => {
      expect(isWithinBounds(-1, 0, viewport)).toBe(false);
      expect(isWithinBounds(10, 0, viewport)).toBe(false);
      expect(isWithinBounds(-5, 10, viewport)).toBe(false);
      expect(isWithinBounds(15, 10, viewport)).toBe(false);
    });

    it("should return false for coordinates above vanish zone", () => {
      expect(isWithinBounds(0, -4, viewport)).toBe(false); // above 3 vanish rows
      expect(isWithinBounds(5, -5, viewport)).toBe(false);
    });

    it("should return false for coordinates below visible area", () => {
      expect(isWithinBounds(0, 20, viewport)).toBe(false);
      expect(isWithinBounds(5, 25, viewport)).toBe(false);
    });

    it("should handle edge cases at exact boundaries", () => {
      // Exact boundaries should be within bounds
      expect(isWithinBounds(0, -3, viewport)).toBe(true); // top-left corner (3 vanish rows)
      expect(isWithinBounds(9, 19, viewport)).toBe(true); // bottom-right corner

      // Just outside boundaries should be out of bounds
      expect(isWithinBounds(0, -4, viewport)).toBe(false); // one above vanish
      expect(isWithinBounds(10, 0, viewport)).toBe(false); // one right of board
      expect(isWithinBounds(0, 20, viewport)).toBe(false); // one below board
    });

    it("should handle different viewport configurations", () => {
      const smallViewport: BoardViewport = {
        cell: asCellSizePx(20),
        cols: asBoardCols(5),
        vanishRows: asVanishRows(1),
        visibleRows: asVisibleRows(10),
      };

      expect(isWithinBounds(0, 0, smallViewport)).toBe(true);
      expect(isWithinBounds(4, 9, smallViewport)).toBe(true);
      expect(isWithinBounds(0, -1, smallViewport)).toBe(true);

      expect(isWithinBounds(5, 0, smallViewport)).toBe(false);
      expect(isWithinBounds(0, 10, smallViewport)).toBe(false);
      expect(isWithinBounds(0, -2, smallViewport)).toBe(false);
    });
  });

  describe("renderBoardCells", () => {
    let board: Board;

    beforeEach(() => {
      board = createEmptyBoard();
    });

    it("should render cells from a populated board", () => {
      // Place some cells on the board using proper indexing
      board.cells[idx(board, createGridCoord(0), createGridCoord(0))] = 1; // I piece at (0,0)
      board.cells[idx(board, createGridCoord(1), createGridCoord(0))] = 2; // O piece at (1,0)
      board.cells[idx(board, createGridCoord(0), createGridCoord(1))] = 3; // T piece at (0,1)

      renderBoardCells(mockCtx, board, viewport);

      // Verify fillRect was called for each non-empty cell
      expect(mockCtx.fillRect).toHaveBeenCalled();
      expect(mockCtx.createLinearGradient).toHaveBeenCalled();
      expect(mockCtx.strokeRect).toHaveBeenCalled();
    });

    it("should not render empty cells", () => {
      renderBoardCells(mockCtx, board, viewport);

      // Empty board should not trigger any drawing
      expect(mockCtx.fillRect).not.toHaveBeenCalled();
      expect(mockCtx.strokeRect).not.toHaveBeenCalled();
    });

    it("should handle cells in vanish zone", () => {
      // Place cells in vanish zone (negative y coordinates in grid space)
      board.cells[idx(board, createGridCoord(5), createGridCoord(-1))] = 5; // Z piece in vanish zone

      renderBoardCells(mockCtx, board, viewport);

      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it("should skip undefined cell values", () => {
      // Create a board with some populated cells (Uint8Array defaults to 0, not undefined)
      board.cells[idx(board, createGridCoord(1), createGridCoord(0))] = 1;
      // Other cells remain 0 (empty)

      renderBoardCells(mockCtx, board, viewport);

      // Should only render the defined cell
      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it("should handle all valid piece types", () => {
      // Place all piece types on the board
      for (let i = 1; i <= 7; i++) {
        board.cells[idx(board, createGridCoord(i - 1), createGridCoord(0))] = i;
      }

      renderBoardCells(mockCtx, board, viewport);

      // Should render all 7 pieces
      expect(mockCtx.fillRect).toHaveBeenCalled();
      expect(mockCtx.strokeRect).toHaveBeenCalled();
    });
  });

  describe("renderActivePieceCells", () => {
    it("should render I piece at spawn position without tweening", () => {
      const piece: ActivePiece = {
        id: "I",
        rot: "spawn",
        x: createGridCoord(3),
        y: createGridCoord(0),
      };

      renderActivePieceCells(
        mockCtx,
        piece,
        viewport,
        asPixelY(0),
        false, // not tweening
      );

      expect(mockCtx.fillRect).toHaveBeenCalled();
      expect(mockCtx.createLinearGradient).toHaveBeenCalled();
      expect(mockCtx.strokeRect).toHaveBeenCalled();
    });

    it("should render T piece with simplified rendering during tweening", () => {
      const piece: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: createGridCoord(3),
        y: createGridCoord(1),
      };

      renderActivePieceCells(
        mockCtx,
        piece,
        viewport,
        asPixelY(15), // tween offset
        true, // tweening
      );

      expect(mockCtx.fillRect).toHaveBeenCalled();
      expect(mockCtx.createLinearGradient).toHaveBeenCalled();
      // Should not stroke during tweening (simplified rendering)
      expect(mockCtx.strokeRect).not.toHaveBeenCalled();
    });

    it("should handle piece with vertical tween offset", () => {
      const piece: ActivePiece = {
        id: "O",
        rot: "spawn",
        x: createGridCoord(4),
        y: createGridCoord(5),
      };

      const verticalOffset = asPixelY(10); // 10 pixels down
      renderActivePieceCells(mockCtx, piece, viewport, verticalOffset, true);

      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it("should only render cells within bounds", () => {
      // Place piece partially outside bounds
      const piece: ActivePiece = {
        id: "I",
        rot: "spawn",
        x: createGridCoord(8), // Will extend to x=11 (outside bounds)
        y: createGridCoord(0),
      };

      renderActivePieceCells(mockCtx, piece, viewport, asPixelY(0), false);

      // Should still render (only cells within bounds will be drawn)
      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it("should handle piece in vanish zone", () => {
      const piece: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: createGridCoord(3),
        y: createGridCoord(-1), // In vanish zone
      };

      renderActivePieceCells(mockCtx, piece, viewport, asPixelY(0), false);

      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it("should handle all piece types and rotations", () => {
      const pieceIds = ["I", "J", "L", "O", "S", "T", "Z"] as const;
      const rotations = ["spawn", "right", "left"] as const;

      for (const id of pieceIds) {
        for (const rot of rotations) {
          // Skip invalid rotations (O piece only has spawn)
          if (id === "O" && rot !== "spawn") continue;

          const piece: ActivePiece = {
            id,
            rot,
            x: createGridCoord(3),
            y: createGridCoord(5),
          };

          renderActivePieceCells(mockCtx, piece, viewport, asPixelY(0), false);

          expect(mockCtx.fillRect).toHaveBeenCalled();
        }
      }
    });

    it("should handle edge case with zero-sized tween offset", () => {
      const piece: ActivePiece = {
        id: "S",
        rot: "spawn",
        x: createGridCoord(2),
        y: createGridCoord(3),
      };

      renderActivePieceCells(
        mockCtx,
        piece,
        viewport,
        asPixelY(0), // No offset
        false,
      );

      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it("should handle negative tween offset", () => {
      const piece: ActivePiece = {
        id: "Z",
        rot: "spawn",
        x: createGridCoord(1),
        y: createGridCoord(2),
      };

      renderActivePieceCells(
        mockCtx,
        piece,
        viewport,
        asPixelY(-5), // Negative offset (upward motion)
        true,
      );

      expect(mockCtx.fillRect).toHaveBeenCalled();
    });
  });

  describe("integration tests", () => {
    it("should handle complex board state with active piece", () => {
      const board = createEmptyBoard();

      // Fill bottom row
      for (let x = 0; x < 10; x++) {
        board.cells[idx(board, createGridCoord(x), createGridCoord(19))] =
          (x % 7) + 1;
      }

      const activePiece: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: createGridCoord(3),
        y: createGridCoord(0),
      };

      // Render both board and active piece
      renderBoardCells(mockCtx, board, viewport);
      renderActivePieceCells(
        mockCtx,
        activePiece,
        viewport,
        asPixelY(0),
        false,
      );

      // Both should have been rendered
      expect(mockCtx.fillRect).toHaveBeenCalled();
      expect(mockCtx.strokeRect).toHaveBeenCalled();
    });

    it("should handle viewport with different vanish zone", () => {
      const diffVanishViewport: BoardViewport = {
        cell: asCellSizePx(25),
        cols: asBoardCols(10),
        vanishRows: asVanishRows(2), // Different from board's 3 vanish rows
        visibleRows: asVisibleRows(20),
      };

      const piece: ActivePiece = {
        id: "I",
        rot: "spawn",
        x: createGridCoord(3),
        y: createGridCoord(0),
      };

      renderActivePieceCells(
        mockCtx,
        piece,
        diffVanishViewport,
        asPixelY(0),
        false,
      );

      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it("should maintain type safety with branded coordinates", () => {
      // Test should compile without type errors when using branded types
      const piece: ActivePiece = {
        id: "L",
        rot: "right",
        x: createGridCoord(5),
        y: createGridCoord(10),
      };

      const pixelOffset = asPixelY(7.5); // Fractional pixel offset

      expect(() => {
        renderActivePieceCells(mockCtx, piece, viewport, pixelOffset, true);
      }).not.toThrow();
    });
  });
});
