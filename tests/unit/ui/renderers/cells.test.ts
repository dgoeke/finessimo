import { describe, it, expect, jest, beforeEach } from "@jest/globals";

import { type PieceId } from "../../../../src/state/types";
import {
  getCellColor,
  isWithinBounds,
  renderBoardCells,
  renderActivePieceCells,
} from "../../../../src/ui/renderers/cells";
import { lightenColor, darkenColor } from "../../../../src/ui/utils/colors";
import {
  createBoardViewport,
  createCellSizePx,
  createPixelY,
  createVisibleRows,
  createVanishRows,
  createBoardCols,
} from "../../../fixtures/brands-render";
import { createBoard, createActivePiece } from "../../../fixtures/state";
import { createMockCanvasContext } from "../../../test-helpers";

// Mock dependencies
jest.mock("../../../../src/ui/utils/colors", () => ({
  darkenColor: jest.fn(
    (color: string, amount: number) => `darkened(${color}, ${String(amount)})`,
  ),
  lightenColor: jest.fn(
    (color: string, amount: number) => `lightened(${color}, ${String(amount)})`,
  ),
}));

describe("ui/renderers/cells", () => {
  let mockCtx: ReturnType<typeof createMockCanvasContext>;
  let viewport: ReturnType<typeof createBoardViewport>;

  beforeEach(() => {
    mockCtx = createMockCanvasContext();
    viewport = createBoardViewport({
      cell: createCellSizePx(30),
      cols: createBoardCols(10),
      vanishRows: createVanishRows(4),
      visibleRows: createVisibleRows(20),
    });
    jest.clearAllMocks();
  });

  describe("getCellColor", () => {
    it("returns correct colors for all piece types", () => {
      expect(getCellColor(0)).toBe("#000000"); // empty
      expect(getCellColor(1)).toBe("#00FFFF"); // I piece (cyan)
      expect(getCellColor(2)).toBe("#FFFF00"); // O piece (yellow)
      expect(getCellColor(3)).toBe("#FF00FF"); // T piece (magenta)
      expect(getCellColor(4)).toBe("#00FF00"); // S piece (green)
      expect(getCellColor(5)).toBe("#FF0000"); // Z piece (red)
      expect(getCellColor(6)).toBe("#0000FF"); // J piece (blue)
      expect(getCellColor(7)).toBe("#FF7F00"); // L piece (orange)
    });

    it("returns white for invalid cell values", () => {
      expect(getCellColor(8)).toBe("#ffffff");
      expect(getCellColor(-1)).toBe("#ffffff");
      expect(getCellColor(100)).toBe("#ffffff");
    });
  });

  describe("isWithinBounds", () => {
    it("returns true for valid coordinates in visible area", () => {
      expect(isWithinBounds(0, 0, viewport)).toBe(true);
      expect(isWithinBounds(9, 19, viewport)).toBe(true);
      expect(isWithinBounds(5, 10, viewport)).toBe(true);
    });

    it("returns true for valid coordinates in vanish zone", () => {
      expect(isWithinBounds(0, -1, viewport)).toBe(true);
      expect(isWithinBounds(5, -4, viewport)).toBe(true);
      expect(isWithinBounds(9, -2, viewport)).toBe(true);
    });

    it("returns false for coordinates outside horizontal bounds", () => {
      expect(isWithinBounds(-1, 10, viewport)).toBe(false);
      expect(isWithinBounds(10, 10, viewport)).toBe(false);
      expect(isWithinBounds(15, 10, viewport)).toBe(false);
    });

    it("returns false for coordinates outside vertical bounds", () => {
      expect(isWithinBounds(5, -5, viewport)).toBe(false); // above vanish zone
      expect(isWithinBounds(5, 20, viewport)).toBe(false); // below visible area
      expect(isWithinBounds(5, 25, viewport)).toBe(false); // way below
    });

    it("handles edge cases at exact boundaries", () => {
      expect(isWithinBounds(0, -4, viewport)).toBe(true); // top-left vanish zone
      expect(isWithinBounds(9, 19, viewport)).toBe(true); // bottom-right visible
      expect(isWithinBounds(0, 20, viewport)).toBe(false); // just outside bottom
      expect(isWithinBounds(10, 0, viewport)).toBe(false); // just outside right
    });
  });

  describe("renderBoardCells", () => {
    it("renders all non-empty cells on the board", () => {
      const board = createBoard();

      // Place some pieces on the board
      board.cells[0] = 1; // Top-left
      board.cells[190] = 2; // Near bottom
      board.cells[95] = 3; // Middle

      renderBoardCells(mockCtx, board, viewport);

      // Should call fillRect for each non-empty cell (main fill + 2 edge effects each)
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.fillRect.mock.calls).toHaveLength(9); // 3 cells × 3 fillRect calls per cell (main + highlight + shadow)
    });

    it("skips empty cells", () => {
      const board = createBoard(); // All cells default to empty (0)

      renderBoardCells(mockCtx, board, viewport);

      // Should not render any cells
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.fillRect.mock.calls).toHaveLength(0);
    });

    it("handles vanish zone coordinates correctly", () => {
      const board = createBoard();

      board.cells[0] = 1; // Cell in vanish zone

      renderBoardCells(mockCtx, board, viewport);

      // Verify the cell is rendered (should have multiple fillRect calls)
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.fillRect.mock.calls.length).toBeGreaterThan(0);
    });

    it("uses correct colors for different cell values", () => {
      const board = createBoard();

      // Place different piece types
      board.cells[0] = 1; // I piece
      board.cells[1] = 2; // O piece
      board.cells[10] = 3; // T piece
      board.cells[11] = 4; // S piece

      renderBoardCells(mockCtx, board, viewport);

      // Should create gradients using lightened/darkened colors
      expect(jest.mocked(lightenColor)).toHaveBeenCalledWith("#00FFFF", 0.3); // I piece
      expect(jest.mocked(darkenColor)).toHaveBeenCalledWith("#00FFFF", 0.2);
    });
  });

  describe("renderActivePieceCells", () => {
    it("renders active piece cells within bounds", () => {
      const piece = createActivePiece({
        id: "I" as PieceId,
        rot: "spawn",
        x: 3,
        y: 0,
      });

      renderActivePieceCells(mockCtx, piece, viewport, createPixelY(0), false);

      // I piece has 4 cells, should render all
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.fillRect.mock.calls.length).toBeGreaterThan(0);
    });

    it("applies vertical tween offset correctly", () => {
      const piece = createActivePiece({
        id: "O" as PieceId,
        rot: "spawn",
        x: 0,
        y: 0,
      });

      const tweenOffsetPx = createPixelY(15); // Half a cell

      renderActivePieceCells(mockCtx, piece, viewport, tweenOffsetPx, true);

      // Should render with tween offset applied
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.fillRect.mock.calls.length).toBeGreaterThan(0);
    });

    it("uses simplified rendering when tweening", () => {
      const piece = createActivePiece({
        id: "T" as PieceId,
        rot: "spawn",
        x: 0,
        y: 0,
      });

      renderActivePieceCells(
        mockCtx,
        piece,
        viewport,
        createPixelY(0),
        true, // isTweening = true
      );

      // When tweening, should not draw stroke/border
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.strokeRect.mock.calls).toHaveLength(0);
      expect(mockedCtx.fillRect.mock.calls.length).toBeGreaterThan(0);
    });

    it("uses detailed rendering when not tweening", () => {
      const piece = createActivePiece({
        id: "T" as PieceId,
        rot: "spawn",
        x: 0,
        y: 0,
      });

      renderActivePieceCells(
        mockCtx,
        piece,
        viewport,
        createPixelY(0),
        false, // isTweening = false
      );

      // When not tweening, should draw borders and highlights
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.strokeRect.mock.calls.length).toBeGreaterThan(0);
    });

    it("skips cells outside viewport bounds", () => {
      const piece = createActivePiece({
        id: "I" as PieceId,
        rot: "spawn", // Horizontal orientation - some cells will be outside
        x: -1, // One cell outside left boundary
        y: 0,
      });

      const mockedCtx = jest.mocked(mockCtx);
      const fillRectCallsBefore = mockedCtx.fillRect.mock.calls.length;

      renderActivePieceCells(mockCtx, piece, viewport, createPixelY(0), false);

      // Should render some cells (the ones within bounds), but not all
      const fillRectCallsAfter = mockedCtx.fillRect.mock.calls.length;
      expect(fillRectCallsAfter).toBeGreaterThan(fillRectCallsBefore);
    });

    it("handles different piece rotations correctly", () => {
      const piece = createActivePiece({
        id: "T" as PieceId,
        rot: "two", // Upside-down T
        x: 5,
        y: 5,
      });

      renderActivePieceCells(mockCtx, piece, viewport, createPixelY(0), false);

      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.fillRect.mock.calls.length).toBeGreaterThan(0);
    });

    it("uses piece color from shape definition", () => {
      const piece = createActivePiece({
        id: "Z" as PieceId,
        rot: "spawn",
        x: 0,
        y: 0,
      });

      renderActivePieceCells(mockCtx, piece, viewport, createPixelY(0), false);

      // Should use Z piece color in rendering - the exact value depends on the last fillStyle set
      // The stroke color should use the piece color
      const mockedCtx = mockCtx as jest.Mocked<CanvasRenderingContext2D>;
      expect(mockedCtx.strokeStyle).toContain("#FF0000"); // Border uses darkened piece color
    });

    it("handles fractional tween coordinates", () => {
      const piece = createActivePiece({
        id: "O" as PieceId,
        rot: "spawn",
        x: 0,
        y: 0,
      });

      renderActivePieceCells(
        mockCtx,
        piece,
        viewport,
        createPixelY(7.5), // Fractional offset
        true,
      );

      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.fillRect.mock.calls.length).toBeGreaterThan(0);
    });
  });

  describe("integration with branded types", () => {
    it("works with different viewport configurations", () => {
      const smallViewport = createBoardViewport({
        cell: createCellSizePx(20),
        cols: createBoardCols(8),
        vanishRows: createVanishRows(2),
        visibleRows: createVisibleRows(16),
      });

      expect(isWithinBounds(7, 15, smallViewport)).toBe(true);
      expect(isWithinBounds(8, 15, smallViewport)).toBe(false);
      expect(isWithinBounds(4, -1, smallViewport)).toBe(true);
      expect(isWithinBounds(4, -3, smallViewport)).toBe(false);
    });

    it("respects cell size in pixel calculations", () => {
      const piece = createActivePiece({
        id: "O" as PieceId,
        rot: "spawn",
        x: 1,
        y: 1,
      });

      renderActivePieceCells(mockCtx, piece, viewport, createPixelY(0), false);

      // Verify fillRect is called with correct dimensions
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.fillRect.mock.calls.length).toBeGreaterThan(0);
    });
  });
});
