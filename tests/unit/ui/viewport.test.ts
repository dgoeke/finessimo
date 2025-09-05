import { describe, it, expect, beforeEach } from "@jest/globals";

import {
  drawPlayAreaBackground,
  drawPlayAreaBorder,
} from "@/ui/renderers/viewport";
import {
  asCellSizePx,
  asBoardCols,
  asVisibleRows,
  asVanishRows,
} from "@/ui/types/brands-render";

import type { BoardViewport } from "@/ui/types/brands-render";

describe("viewport renderer", () => {
  let mockCtx: CanvasRenderingContext2D;
  let viewport: BoardViewport;

  beforeEach(() => {
    // Create mock canvas context
    const fillRect = jest.fn();
    const strokeRect = jest.fn();

    mockCtx = {
      fillRect,
      fillStyle: "#000000",
      lineWidth: 1,
      strokeRect,
      strokeStyle: "#000000",
    } as unknown as CanvasRenderingContext2D;

    viewport = {
      cell: asCellSizePx(30),
      cols: asBoardCols(10),
      vanishRows: asVanishRows(2),
      visibleRows: asVisibleRows(20),
    } as const;
  });

  describe("drawPlayAreaBackground", () => {
    it("should draw black background for play area only", () => {
      drawPlayAreaBackground(mockCtx, viewport);

      expect(mockCtx.fillStyle).toBe("#000000");
      expect(mockCtx.fillRect).toHaveBeenCalledTimes(1);
      expect(mockCtx.fillRect).toHaveBeenCalledWith(
        0, // x position
        60, // y offset (2 vanish rows * 30px = 60)
        300, // play area width (10 cols * 30px = 300)
        600, // play area height (20 visible rows * 30px = 600)
      );
    });

    it("should position background correctly with vanish offset", () => {
      drawPlayAreaBackground(mockCtx, viewport);

      const mockFillRect = jest.mocked(mockCtx.fillRect);
      const [x, y, width, height] = mockFillRect.mock.calls[0] as [
        number,
        number,
        number,
        number,
      ];

      expect(x).toBe(0);
      expect(y).toBe(60); // vanishRows * cellSize = 2 * 30
      expect(width).toBe(300); // cols * cellSize = 10 * 30
      expect(height).toBe(600); // visibleRows * cellSize = 20 * 30
    });

    it("should handle viewport with no vanish rows", () => {
      const noVanishViewport: BoardViewport = {
        cell: asCellSizePx(25),
        cols: asBoardCols(10),
        vanishRows: asVanishRows(0),
        visibleRows: asVisibleRows(20),
      };

      drawPlayAreaBackground(mockCtx, noVanishViewport);

      expect(mockCtx.fillRect).toHaveBeenCalledWith(
        0, // x position
        0, // y offset (0 vanish rows * 25px = 0)
        250, // play area width (10 cols * 25px = 250)
        500, // play area height (20 visible rows * 25px = 500)
      );
    });

    it("should handle different cell sizes", () => {
      const smallViewport: BoardViewport = {
        cell: asCellSizePx(20),
        cols: asBoardCols(8),
        vanishRows: asVanishRows(1),
        visibleRows: asVisibleRows(16),
      };

      drawPlayAreaBackground(mockCtx, smallViewport);

      expect(mockCtx.fillRect).toHaveBeenCalledWith(
        0, // x position
        20, // y offset (1 vanish row * 20px = 20)
        160, // play area width (8 cols * 20px = 160)
        320, // play area height (16 visible rows * 20px = 320)
      );
    });

    it("should handle large viewport dimensions", () => {
      const largeViewport: BoardViewport = {
        cell: asCellSizePx(50),
        cols: asBoardCols(15),
        vanishRows: asVanishRows(5),
        visibleRows: asVisibleRows(25),
      };

      drawPlayAreaBackground(mockCtx, largeViewport);

      expect(mockCtx.fillRect).toHaveBeenCalledWith(
        0, // x position
        250, // y offset (5 vanish rows * 50px = 250)
        750, // play area width (15 cols * 50px = 750)
        1250, // play area height (25 visible rows * 50px = 1250)
      );
    });

    it("should handle minimal viewport dimensions", () => {
      const minViewport: BoardViewport = {
        cell: asCellSizePx(1),
        cols: asBoardCols(1),
        vanishRows: asVanishRows(0),
        visibleRows: asVisibleRows(1),
      };

      drawPlayAreaBackground(mockCtx, minViewport);

      expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 0, 1, 1);
    });

    it("should not affect other canvas properties", () => {
      const originalStrokeStyle = mockCtx.strokeStyle;
      const originalLineWidth = mockCtx.lineWidth;

      drawPlayAreaBackground(mockCtx, viewport);

      // Only fillStyle should be modified
      expect(mockCtx.fillStyle).toBe("#000000");
      expect(mockCtx.strokeStyle).toBe(originalStrokeStyle);
      expect(mockCtx.lineWidth).toBe(originalLineWidth);
    });

    it("should be callable multiple times", () => {
      drawPlayAreaBackground(mockCtx, viewport);
      drawPlayAreaBackground(mockCtx, viewport);
      drawPlayAreaBackground(mockCtx, viewport);

      expect(mockCtx.fillRect).toHaveBeenCalledTimes(3);
      // All calls should have identical parameters
      const calls = (mockCtx.fillRect as jest.Mock).mock.calls;
      expect(calls[0]).toEqual(calls[1]);
      expect(calls[1]).toEqual(calls[2]);
    });
  });

  describe("drawPlayAreaBorder", () => {
    it("should draw border around play area with correct properties", () => {
      drawPlayAreaBorder(mockCtx, viewport);

      expect(mockCtx.strokeStyle).toBe("#333333");
      expect(mockCtx.lineWidth).toBe(2);
      expect(mockCtx.strokeRect).toHaveBeenCalledTimes(1);
    });

    it("should position border correctly accounting for border width", () => {
      drawPlayAreaBorder(mockCtx, viewport);

      const borderWidth = 2;
      const expectedX = borderWidth / 2; // 1
      const expectedY = 60 + borderWidth / 2; // vanish offset + half border = 61
      const expectedWidth = 300 - borderWidth; // play area width - border = 298
      const expectedHeight = 600 - borderWidth; // play area height - border = 598

      expect(mockCtx.strokeRect).toHaveBeenCalledWith(
        expectedX,
        expectedY,
        expectedWidth,
        expectedHeight,
      );
    });

    it("should handle viewport with no vanish rows", () => {
      const noVanishViewport: BoardViewport = {
        cell: asCellSizePx(25),
        cols: asBoardCols(10),
        vanishRows: asVanishRows(0),
        visibleRows: asVisibleRows(20),
      };

      drawPlayAreaBorder(mockCtx, noVanishViewport);

      expect(mockCtx.strokeRect).toHaveBeenCalledWith(
        1, // borderWidth / 2
        1, // 0 vanish offset + borderWidth / 2
        248, // 250 - 2
        498, // 500 - 2
      );
    });

    it("should handle different cell sizes", () => {
      const customViewport: BoardViewport = {
        cell: asCellSizePx(40),
        cols: asBoardCols(6),
        vanishRows: asVanishRows(3),
        visibleRows: asVisibleRows(12),
      };

      drawPlayAreaBorder(mockCtx, customViewport);

      expect(mockCtx.strokeRect).toHaveBeenCalledWith(
        1, // borderWidth / 2
        121, // vanishOffset + borderWidth / 2 = 120 + 1
        238, // playAreaWidth - borderWidth = 240 - 2
        478, // playAreaHeight - borderWidth = 480 - 2
      );
    });

    it("should handle large viewport dimensions", () => {
      const largeViewport: BoardViewport = {
        cell: asCellSizePx(35),
        cols: asBoardCols(20),
        vanishRows: asVanishRows(4),
        visibleRows: asVisibleRows(30),
      };

      drawPlayAreaBorder(mockCtx, largeViewport);

      expect(mockCtx.strokeRect).toHaveBeenCalledWith(
        1, // borderWidth / 2
        141, // vanishOffset + borderWidth / 2 = 140 + 1
        698, // playAreaWidth - borderWidth = 700 - 2
        1048, // playAreaHeight - borderWidth = 1050 - 2
      );
    });

    it("should handle minimal viewport dimensions", () => {
      const minViewport: BoardViewport = {
        cell: asCellSizePx(10),
        cols: asBoardCols(1),
        vanishRows: asVanishRows(0),
        visibleRows: asVisibleRows(1),
      };

      drawPlayAreaBorder(mockCtx, minViewport);

      expect(mockCtx.strokeRect).toHaveBeenCalledWith(
        1, // borderWidth / 2
        1, // 0 + borderWidth / 2
        8, // 10 - 2
        8, // 10 - 2
      );
    });

    it("should use consistent border width", () => {
      drawPlayAreaBorder(mockCtx, viewport);

      expect(mockCtx.lineWidth).toBe(2);
    });

    it("should use correct border color", () => {
      drawPlayAreaBorder(mockCtx, viewport);

      expect(mockCtx.strokeStyle).toBe("#333333");
    });

    it("should not affect fillStyle", () => {
      const originalFillStyle = mockCtx.fillStyle;

      drawPlayAreaBorder(mockCtx, viewport);

      expect(mockCtx.fillStyle).toBe(originalFillStyle);
    });

    it("should be callable multiple times", () => {
      drawPlayAreaBorder(mockCtx, viewport);
      drawPlayAreaBorder(mockCtx, viewport);

      expect(mockCtx.strokeRect).toHaveBeenCalledTimes(2);

      // All calls should have identical parameters
      const calls = (mockCtx.strokeRect as jest.Mock).mock.calls;
      expect(calls[0]).toEqual(calls[1]);
    });
  });

  describe("integration tests", () => {
    it("should draw both background and border correctly together", () => {
      drawPlayAreaBackground(mockCtx, viewport);
      drawPlayAreaBorder(mockCtx, viewport);

      // Background should be drawn
      expect(mockCtx.fillStyle).toBe("#000000");
      expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 60, 300, 600);

      // Border should be drawn
      expect(mockCtx.strokeStyle).toBe("#333333");
      expect(mockCtx.lineWidth).toBe(2);
      expect(mockCtx.strokeRect).toHaveBeenCalledWith(1, 61, 298, 598);
    });

    it("should work with standard Tetris board dimensions", () => {
      const standardViewport: BoardViewport = {
        cell: asCellSizePx(30),
        cols: asBoardCols(10),
        vanishRows: asVanishRows(2),
        visibleRows: asVisibleRows(20),
      };

      drawPlayAreaBackground(mockCtx, standardViewport);
      drawPlayAreaBorder(mockCtx, standardViewport);

      // Standard Tetris board: 10 cols x 20 visible rows with 2 vanish rows
      expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 60, 300, 600);
      expect(mockCtx.strokeRect).toHaveBeenCalledWith(1, 61, 298, 598);
    });

    it("should work with wide board configuration", () => {
      const wideViewport: BoardViewport = {
        cell: asCellSizePx(20),
        cols: asBoardCols(15),
        vanishRows: asVanishRows(1),
        visibleRows: asVisibleRows(15),
      };

      drawPlayAreaBackground(mockCtx, wideViewport);
      drawPlayAreaBorder(mockCtx, wideViewport);

      expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 20, 300, 300);
      expect(mockCtx.strokeRect).toHaveBeenCalledWith(1, 21, 298, 298);
    });

    it("should work with tall board configuration", () => {
      const tallViewport: BoardViewport = {
        cell: asCellSizePx(25),
        cols: asBoardCols(8),
        vanishRows: asVanishRows(3),
        visibleRows: asVisibleRows(25),
      };

      drawPlayAreaBackground(mockCtx, tallViewport);
      drawPlayAreaBorder(mockCtx, tallViewport);

      expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 75, 200, 625);
      expect(mockCtx.strokeRect).toHaveBeenCalledWith(1, 76, 198, 623);
    });

    it("should handle order independence", () => {
      // Drawing border first, then background
      drawPlayAreaBorder(mockCtx, viewport);
      drawPlayAreaBackground(mockCtx, viewport);

      // Both should still work correctly regardless of order
      expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 60, 300, 600);
      expect(mockCtx.strokeRect).toHaveBeenCalledWith(1, 61, 298, 598);
    });

    it("should maintain type safety with branded viewport types", () => {
      // Test should compile without type errors when using branded types correctly
      const typedViewport: BoardViewport = {
        cell: asCellSizePx(32),
        cols: asBoardCols(12),
        vanishRows: asVanishRows(2),
        visibleRows: asVisibleRows(18),
      } as const;

      expect(() => {
        drawPlayAreaBackground(mockCtx, typedViewport);
        drawPlayAreaBorder(mockCtx, typedViewport);
      }).not.toThrow();

      expect(mockCtx.fillRect).toHaveBeenCalled();
      expect(mockCtx.strokeRect).toHaveBeenCalled();
    });

    it("should handle extreme viewport configurations", () => {
      // Test with very large dimensions
      const extremeViewport: BoardViewport = {
        cell: asCellSizePx(100),
        cols: asBoardCols(50),
        vanishRows: asVanishRows(10),
        visibleRows: asVisibleRows(100),
      };

      expect(() => {
        drawPlayAreaBackground(mockCtx, extremeViewport);
        drawPlayAreaBorder(mockCtx, extremeViewport);
      }).not.toThrow();

      // Should handle large numbers without overflow
      expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 1000, 5000, 10000);
      expect(mockCtx.strokeRect).toHaveBeenCalledWith(1, 1001, 4998, 9998);
    });

    it("should handle viewport calculations consistently", () => {
      // Both functions should use identical viewport calculations
      drawPlayAreaBackground(mockCtx, viewport);
      drawPlayAreaBorder(mockCtx, viewport);

      const mockFillRectCalls = jest.mocked(mockCtx.fillRect);
      const mockStrokeRectCalls = jest.mocked(mockCtx.strokeRect);
      const fillCall = mockFillRectCalls.mock.calls[0] as [
        number,
        number,
        number,
        number,
      ];
      const strokeCall = mockStrokeRectCalls.mock.calls[0] as [
        number,
        number,
        number,
        number,
      ];

      // Background dimensions
      const bgWidth = fillCall[2];
      const bgHeight = fillCall[3];
      const bgYOffset = fillCall[1];

      // Border dimensions (accounting for border width adjustment)
      const borderWidth = strokeCall[2] + 2; // add back the border width
      const borderHeight = strokeCall[3] + 2; // add back the border width
      const borderYOffset = strokeCall[1] - 1; // subtract half border width

      // Should be identical after accounting for border adjustments
      expect(bgWidth).toBe(borderWidth);
      expect(bgHeight).toBe(borderHeight);
      expect(bgYOffset).toBe(borderYOffset);
    });
  });
});
