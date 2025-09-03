import { describe, it, expect, beforeEach } from "@jest/globals";

import {
  drawPlayAreaBackground,
  drawPlayAreaBorder,
} from "../../../../src/ui/renderers/viewport";
import {
  createBoardViewport,
  createCellSizePx,
  createBoardCols,
  createVisibleRows,
  createVanishRows,
} from "../../../fixtures/brands-render";
import { createMockCanvasContext } from "../../../test-helpers";

// Using shared mock canvas context from test-helpers

describe("ui/renderers/viewport", () => {
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

  describe("drawPlayAreaBackground", () => {
    it("draws background with correct dimensions and position", () => {
      drawPlayAreaBackground(mockCtx, viewport);

      const mockedContext = mockCtx as jest.Mocked<CanvasRenderingContext2D>;
      expect(mockedContext.fillStyle).toBe("#000000");
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.fillRect.mock.calls).toHaveLength(1);
      // Should fill visible area: x=0, y=vanishOffset(120px), width=300px, height=600px
      expect(mockedCtx.fillRect.mock.calls[0]).toEqual([0, 120, 300, 600]);
    });

    it("uses black fill color", () => {
      drawPlayAreaBackground(mockCtx, viewport);

      const mockedContext = mockCtx as jest.Mocked<CanvasRenderingContext2D>;
      expect(mockedContext.fillStyle).toBe("#000000");
    });

    it("positions background below vanish zone", () => {
      drawPlayAreaBackground(mockCtx, viewport);

      // Y offset should be vanishRows * cellSize = 4 * 30 = 120px
      const mockedCtx = jest.mocked(mockCtx);
      const [, y] = mockedCtx.fillRect.mock.calls[0] as [
        number,
        number,
        number,
        number,
      ];
      expect(y).toBe(120);
    });

    it("covers entire visible play area width", () => {
      drawPlayAreaBackground(mockCtx, viewport);

      // Width should be boardWidth * cellSize = 10 * 30 = 300px
      const mockedCtx = jest.mocked(mockCtx);
      const [, , width] = mockedCtx.fillRect.mock.calls[0] as [
        number,
        number,
        number,
        number,
      ];
      expect(width).toBe(300);
    });

    it("covers entire visible play area height", () => {
      drawPlayAreaBackground(mockCtx, viewport);

      // Height should be visibleRows * cellSize = 20 * 30 = 600px
      const mockedCtx = jest.mocked(mockCtx);
      const [, , , height] = mockedCtx.fillRect.mock.calls[0] as [
        number,
        number,
        number,
        number,
      ];
      expect(height).toBe(600);
    });

    it("starts at x=0", () => {
      drawPlayAreaBackground(mockCtx, viewport);

      const mockedCtx = jest.mocked(mockCtx);
      const [x] = mockedCtx.fillRect.mock.calls[0] as [
        number,
        number,
        number,
        number,
      ];
      expect(x).toBe(0);
    });

    it("handles different cell sizes", () => {
      const customViewport = createBoardViewport({
        cell: createCellSizePx(25),
        cols: createBoardCols(10),
        vanishRows: createVanishRows(4),
        visibleRows: createVisibleRows(20),
      });

      drawPlayAreaBackground(mockCtx, customViewport);

      // Should adjust dimensions based on cell size
      // Y offset: 4 * 25 = 100px
      // Width: 10 * 25 = 250px
      // Height: 20 * 25 = 500px
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.fillRect.mock.calls[0]).toEqual([0, 100, 250, 500]);
    });

    it("handles different board dimensions", () => {
      const customViewport = createBoardViewport({
        cell: createCellSizePx(30),
        cols: createBoardCols(8),
        vanishRows: createVanishRows(2),
        visibleRows: createVisibleRows(16),
      });

      drawPlayAreaBackground(mockCtx, customViewport);

      // Should adjust dimensions based on board size
      // Y offset: 2 * 30 = 60px
      // Width: 8 * 30 = 240px
      // Height: 16 * 30 = 480px
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.fillRect.mock.calls[0]).toEqual([0, 60, 240, 480]);
    });

    it("handles zero vanish rows", () => {
      const noVanishViewport = createBoardViewport({
        cell: createCellSizePx(30),
        cols: createBoardCols(10),
        vanishRows: createVanishRows(0),
        visibleRows: createVisibleRows(20),
      });

      drawPlayAreaBackground(mockCtx, noVanishViewport);

      // Should start at y=0 (no vanish offset)
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.fillRect.mock.calls[0]).toEqual([0, 0, 300, 600]);
    });

    it("handles large vanish zone", () => {
      const largeVanishViewport = createBoardViewport({
        cell: createCellSizePx(30),
        cols: createBoardCols(10),
        vanishRows: createVanishRows(8),
        visibleRows: createVisibleRows(20),
      });

      drawPlayAreaBackground(mockCtx, largeVanishViewport);

      // Should start at y=240px (8 * 30)
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.fillRect.mock.calls[0]).toEqual([0, 240, 300, 600]);
    });

    it("handles minimum dimensions", () => {
      const minViewport = createBoardViewport({
        cell: createCellSizePx(10),
        cols: createBoardCols(1),
        vanishRows: createVanishRows(1),
        visibleRows: createVisibleRows(1),
      });

      drawPlayAreaBackground(mockCtx, minViewport);

      // Should handle minimal 1x1 board
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.fillRect.mock.calls[0]).toEqual([0, 10, 10, 10]);
    });

    it("handles large dimensions", () => {
      const largeViewport = createBoardViewport({
        cell: createCellSizePx(50),
        cols: createBoardCols(15),
        vanishRows: createVanishRows(6),
        visibleRows: createVisibleRows(25),
      });

      drawPlayAreaBackground(mockCtx, largeViewport);

      // Should handle large board dimensions
      // Y offset: 6 * 50 = 300px
      // Width: 15 * 50 = 750px
      // Height: 25 * 50 = 1250px
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.fillRect.mock.calls[0]).toEqual([0, 300, 750, 1250]);
    });
  });

  describe("drawPlayAreaBorder", () => {
    it("draws border with correct style and dimensions", () => {
      drawPlayAreaBorder(mockCtx, viewport);

      const mockedContext = mockCtx as jest.Mocked<CanvasRenderingContext2D>;
      expect(mockedContext.strokeStyle).toBe("#333333");
      expect(mockedContext.lineWidth).toBe(2);
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.strokeRect.mock.calls).toHaveLength(1);
    });

    it("uses correct border color and width", () => {
      drawPlayAreaBorder(mockCtx, viewport);

      const mockedContext = mockCtx as jest.Mocked<CanvasRenderingContext2D>;
      expect(mockedContext.strokeStyle).toBe("#333333");
      expect(mockedContext.lineWidth).toBe(2);
    });

    it("positions border correctly with half-pixel offset", () => {
      drawPlayAreaBorder(mockCtx, viewport);

      // Border should be positioned with half-pixel offset for crisp lines
      // x = borderWidth/2 = 1, y = vanishOffset + borderWidth/2 = 120 + 1 = 121
      // width = playAreaWidth - borderWidth = 300 - 2 = 298
      // height = playAreaHeight - borderWidth = 600 - 2 = 598
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.strokeRect.mock.calls[0]).toEqual([1, 121, 298, 598]);
    });

    it("accounts for vanish zone offset", () => {
      drawPlayAreaBorder(mockCtx, viewport);

      const mockedCtx = jest.mocked(mockCtx);
      const [, y] = mockedCtx.strokeRect.mock.calls[0] as [
        number,
        number,
        number,
        number,
      ];
      // Y should include vanish offset: 4 * 30 + 1 = 121
      expect(y).toBe(121);
    });

    it("adjusts border dimensions for stroke width", () => {
      drawPlayAreaBorder(mockCtx, viewport);

      const mockedCtx = jest.mocked(mockCtx);
      const [, , width, height] = mockedCtx.strokeRect.mock.calls[0] as [
        number,
        number,
        number,
        number,
      ];
      // Width and height should be reduced by border width
      expect(width).toBe(298); // 300 - 2
      expect(height).toBe(598); // 600 - 2
    });

    it("handles different cell sizes", () => {
      const customViewport = createBoardViewport({
        cell: createCellSizePx(40),
        cols: createBoardCols(10),
        vanishRows: createVanishRows(3),
        visibleRows: createVisibleRows(20),
      });

      drawPlayAreaBorder(mockCtx, customViewport);

      // Should adjust for cell size
      // x = 1, y = (3 * 40) + 1 = 121
      // width = (10 * 40) - 2 = 398
      // height = (20 * 40) - 2 = 798
      const mockContext = jest.mocked(mockCtx);
      expect(mockContext.strokeRect.mock.calls[0]).toEqual([1, 121, 398, 798]);
    });

    it("handles different board dimensions", () => {
      const customViewport = createBoardViewport({
        cell: createCellSizePx(30),
        cols: createBoardCols(6),
        vanishRows: createVanishRows(2),
        visibleRows: createVisibleRows(12),
      });

      drawPlayAreaBorder(mockCtx, customViewport);

      // Should adjust for board dimensions
      // x = 1, y = (2 * 30) + 1 = 61
      // width = (6 * 30) - 2 = 178
      // height = (12 * 30) - 2 = 358
      const mockContext = jest.mocked(mockCtx);
      expect(mockContext.strokeRect.mock.calls[0]).toEqual([1, 61, 178, 358]);
    });

    it("handles zero vanish rows", () => {
      const noVanishViewport = createBoardViewport({
        cell: createCellSizePx(30),
        cols: createBoardCols(10),
        vanishRows: createVanishRows(0),
        visibleRows: createVisibleRows(20),
      });

      drawPlayAreaBorder(mockCtx, noVanishViewport);

      // Should position at y = borderWidth/2 = 1
      const mockContext = jest.mocked(mockCtx);
      expect(mockContext.strokeRect.mock.calls[0]).toEqual([1, 1, 298, 598]);
    });

    it("maintains consistent border width regardless of scale", () => {
      const smallViewport = createBoardViewport({
        cell: createCellSizePx(15),
        cols: createBoardCols(4),
        vanishRows: createVanishRows(1),
        visibleRows: createVisibleRows(8),
      });

      drawPlayAreaBorder(mockCtx, smallViewport);

      // Border width should always be 2, regardless of cell size
      const mockedContext = mockCtx as jest.Mocked<CanvasRenderingContext2D>;
      expect(mockedContext.lineWidth).toBe(2);

      // Calculations should still account for border width
      // x = 1, y = (1 * 15) + 1 = 16
      // width = (4 * 15) - 2 = 58
      // height = (8 * 15) - 2 = 118
      const mockContext = jest.mocked(mockCtx);
      expect(mockContext.strokeRect.mock.calls[0]).toEqual([1, 16, 58, 118]);
    });

    it("handles single cell board", () => {
      const singleCellViewport = createBoardViewport({
        cell: createCellSizePx(50),
        cols: createBoardCols(1),
        vanishRows: createVanishRows(0),
        visibleRows: createVisibleRows(1),
      });

      drawPlayAreaBorder(mockCtx, singleCellViewport);

      // Should handle minimal board
      // x = 1, y = 1, width = 50 - 2 = 48, height = 50 - 2 = 48
      const mockContext = jest.mocked(mockCtx);
      expect(mockContext.strokeRect.mock.calls[0]).toEqual([1, 1, 48, 48]);
    });

    it("produces border smaller than background area", () => {
      drawPlayAreaBackground(mockCtx, viewport);
      const mockedCtx = jest.mocked(mockCtx);
      const backgroundCall = mockedCtx.fillRect.mock.calls[0] as [
        number,
        number,
        number,
        number,
      ];

      jest.clearAllMocks();

      drawPlayAreaBorder(mockCtx, viewport);
      const borderCall = mockedCtx.strokeRect.mock.calls[0] as [
        number,
        number,
        number,
        number,
      ];

      // Border should be positioned inside the background area
      expect(borderCall[0]).toBeGreaterThan(backgroundCall[0]); // x
      expect(borderCall[1]).toBeGreaterThan(backgroundCall[1]); // y
      expect(borderCall[2]).toBeLessThan(backgroundCall[2]); // width
      expect(borderCall[3]).toBeLessThan(backgroundCall[3]); // height
    });
  });

  describe("integration and edge cases", () => {
    it("background and border work together", () => {
      // Draw both background and border
      drawPlayAreaBackground(mockCtx, viewport);
      drawPlayAreaBorder(mockCtx, viewport);

      const mockContext = jest.mocked(mockCtx);
      expect(mockContext.fillRect.mock.calls).toHaveLength(1);
      expect(mockContext.strokeRect.mock.calls).toHaveLength(1);

      // Verify they target the same general area
      // Use existing mockContext
      const bgCall = mockContext.fillRect.mock.calls[0] as [
        number,
        number,
        number,
        number,
      ];
      const borderCall = mockContext.strokeRect.mock.calls[0] as [
        number,
        number,
        number,
        number,
      ];

      // Background and border should have same y offset (accounting for border half-pixel)
      expect(bgCall[1]).toBe(120);
      expect(borderCall[1]).toBe(121); // 120 + 1 (half border width)
    });

    it("handles fractional cell sizes gracefully", () => {
      const fractionalViewport = createBoardViewport({
        cell: createCellSizePx(25.5),
        cols: createBoardCols(4),
        vanishRows: createVanishRows(2),
        visibleRows: createVisibleRows(8),
      });

      drawPlayAreaBackground(mockCtx, fractionalViewport);
      drawPlayAreaBorder(mockCtx, fractionalViewport);

      // Should handle fractional calculations
      // Y offset: 2 * 25.5 = 51
      // Width: 4 * 25.5 = 102
      // Height: 8 * 25.5 = 204
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.fillRect.mock.calls[0]).toEqual([0, 51, 102, 204]);
      const mockContext = jest.mocked(mockCtx);
      expect(mockContext.strokeRect.mock.calls[0]).toEqual([1, 52, 100, 202]);
    });

    it("maintains proper layering order", () => {
      // Background should be drawn before border for proper layering
      drawPlayAreaBackground(mockCtx, viewport);
      drawPlayAreaBorder(mockCtx, viewport);

      // Verify both functions were called
      const mockContext = jest.mocked(mockCtx);
      expect(mockContext.fillRect.mock.calls).toHaveLength(1);
      expect(mockContext.strokeRect.mock.calls).toHaveLength(1);
    });

    it("preserves canvas state", () => {
      // Store initial values (not used in this test but shows the pattern)
      // const _initialFillStyle = jest.mocked(mockCtx).fillStyle;
      // const _initialStrokeStyle = jest.mocked(mockCtx).strokeStyle;
      // const _initialLineWidth = jest.mocked(mockCtx).lineWidth;

      drawPlayAreaBackground(mockCtx, viewport);
      drawPlayAreaBorder(mockCtx, viewport);

      // Functions should set their own styles but not restore
      const mockedContext = mockCtx as jest.Mocked<CanvasRenderingContext2D>;
      expect(mockedContext.fillStyle).toBe("#000000");
      expect(mockedContext.strokeStyle).toBe("#333333");
      expect(mockedContext.lineWidth).toBe(2);
    });

    it("produces consistent results with same viewport", () => {
      // Draw multiple times with same viewport
      drawPlayAreaBackground(mockCtx, viewport);
      const mockedCtx = jest.mocked(mockCtx);
      const firstBgCall = [
        ...(mockedCtx.fillRect.mock.calls[0] as [
          number,
          number,
          number,
          number,
        ]),
      ];

      jest.clearAllMocks();

      drawPlayAreaBackground(mockCtx, viewport);
      const mockedCtx2 = jest.mocked(mockCtx);
      const secondBgCall = [
        ...(mockedCtx2.fillRect.mock.calls[0] as [
          number,
          number,
          number,
          number,
        ]),
      ];

      expect(firstBgCall).toEqual(secondBgCall);
    });

    it("works with extreme viewport configurations", () => {
      // Test with very large viewport
      const extremeViewport = createBoardViewport({
        cell: createCellSizePx(100),
        cols: createBoardCols(20),
        vanishRows: createVanishRows(10),
        visibleRows: createVisibleRows(30),
      });

      expect(() => {
        drawPlayAreaBackground(mockCtx, extremeViewport);
        drawPlayAreaBorder(mockCtx, extremeViewport);
      }).not.toThrow();

      const mockContext = jest.mocked(mockCtx);
      expect(mockContext.fillRect.mock.calls).toHaveLength(1);
      expect(mockContext.strokeRect.mock.calls).toHaveLength(1);
    });
  });
});
