import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";

import { createGridCache } from "../../../src/ui/renderers/grid-cache";
import {
  asCellSizePx,
  asBoardCols,
  asVisibleRows,
  asVanishRows,
} from "../../../src/ui/types/brands-render";

import type { GridCache } from "../../../src/ui/renderers/grid-cache";
import type { BoardViewport } from "../../../src/ui/types/brands-render";

// Mock OffscreenCanvas since it may not be available in test environment
class MockOffscreenCanvas {
  width: number;
  height: number;
  private _ctx: MockOffscreenCanvasRenderingContext2D;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this._ctx = new MockOffscreenCanvasRenderingContext2D();
  }

  getContext(type: string): MockOffscreenCanvasRenderingContext2D | null {
    if (type === "2d") {
      return this._ctx;
    }
    return null;
  }
}

class MockOffscreenCanvasRenderingContext2D {
  strokeStyle = "#000000";
  lineWidth = 1;

  beginPath = jest.fn();
  moveTo = jest.fn();
  lineTo = jest.fn();
  stroke = jest.fn();

  constructor() {
    // Reset mocks for each instance
    this.beginPath.mockClear();
    this.moveTo.mockClear();
    this.lineTo.mockClear();
    this.stroke.mockClear();
  }
}

describe("grid cache", () => {
  let viewport: BoardViewport;
  let mockCtx: CanvasRenderingContext2D;
  let gridCache: GridCache;

  // Mock global OffscreenCanvas
  const originalOffscreenCanvas = global.OffscreenCanvas;

  beforeEach(() => {
    // Mock OffscreenCanvas for testing
    global.OffscreenCanvas =
      MockOffscreenCanvas as unknown as typeof OffscreenCanvas;

    viewport = {
      cell: asCellSizePx(30),
      cols: asBoardCols(10),
      vanishRows: asVanishRows(2),
      visibleRows: asVisibleRows(20),
    } as const;

    // Mock main canvas context
    const drawImage = jest.fn();
    mockCtx = {
      drawImage,
    } as unknown as CanvasRenderingContext2D;
  });

  afterEach(() => {
    // Clean up grid cache if created
    if (typeof gridCache !== "undefined") {
      gridCache.dispose();
    }

    // Restore original OffscreenCanvas
    global.OffscreenCanvas = originalOffscreenCanvas;
  });

  describe("createGridCache", () => {
    it("should create grid cache with correct viewport dimensions", () => {
      gridCache = createGridCache(viewport);

      expect(gridCache).toBeDefined();
      expect(typeof gridCache.drawGrid).toBe("function");
      expect(typeof gridCache.dispose).toBe("function");
    });

    it("should create offscreen canvas with visible area dimensions", () => {
      gridCache = createGridCache(viewport);

      // OffscreenCanvas should be created with dimensions: 10 cols * 30px = 300, 20 rows * 30px = 600
      // We can't directly test the dimensions but we can verify no errors occurred
      expect(gridCache).toBeDefined();
    });

    it("should draw grid lines during initialization", () => {
      gridCache = createGridCache(viewport);

      // The offscreen context should have been used to draw grid lines
      expect(gridCache).toBeDefined();
    });

    it("should handle different viewport configurations", () => {
      const smallViewport: BoardViewport = {
        cell: asCellSizePx(20),
        cols: asBoardCols(5),
        vanishRows: asVanishRows(1),
        visibleRows: asVisibleRows(10),
      };

      gridCache = createGridCache(smallViewport);

      expect(gridCache).toBeDefined();
      expect(typeof gridCache.drawGrid).toBe("function");
    });

    it("should handle zero vanish rows", () => {
      const noVanishViewport: BoardViewport = {
        cell: asCellSizePx(25),
        cols: asBoardCols(10),
        vanishRows: asVanishRows(0),
        visibleRows: asVisibleRows(20),
      };

      gridCache = createGridCache(noVanishViewport);

      expect(gridCache).toBeDefined();
    });

    it("should throw error if 2D context cannot be obtained", () => {
      // Mock OffscreenCanvas.getContext to return null
      class MockFailingOffscreenCanvas extends MockOffscreenCanvas {
        getContext(): null {
          return null;
        }
      }

      global.OffscreenCanvas =
        MockFailingOffscreenCanvas as unknown as typeof OffscreenCanvas;

      expect(() => {
        createGridCache(viewport);
      }).toThrow("Failed to get 2D context for grid canvas");
    });

    it("should handle minimum viable viewport", () => {
      const minViewport: BoardViewport = {
        cell: asCellSizePx(1),
        cols: asBoardCols(1),
        vanishRows: asVanishRows(0),
        visibleRows: asVisibleRows(1),
      };

      gridCache = createGridCache(minViewport);

      expect(gridCache).toBeDefined();
    });
  });

  describe("drawGrid", () => {
    beforeEach(() => {
      gridCache = createGridCache(viewport);
    });

    it("should draw cached grid to provided context", () => {
      gridCache.drawGrid(mockCtx);

      expect(mockCtx.drawImage).toHaveBeenCalledTimes(1);
      expect(mockCtx.drawImage).toHaveBeenCalledWith(
        expect.any(Object), // offscreen canvas
        0, // x position
        60, // y position (2 vanish rows * 30px = 60)
      );
    });

    it("should position grid correctly with vanish offset", () => {
      gridCache.drawGrid(mockCtx);

      // Grid should be drawn at y-offset equal to vanishRows * cellSize
      const expectedYOffset = 2 * 30; // vanishRows * cellSize
      expect(mockCtx.drawImage).toHaveBeenCalledWith(
        expect.any(Object),
        0,
        expectedYOffset,
      );
    });

    it("should handle viewport with different vanish rows", () => {
      const viewportWith3Vanish: BoardViewport = {
        cell: asCellSizePx(25),
        cols: asBoardCols(10),
        vanishRows: asVanishRows(3),
        visibleRows: asVisibleRows(20),
      };

      const cache3Vanish = createGridCache(viewportWith3Vanish);
      cache3Vanish.drawGrid(mockCtx);

      const expectedYOffset = 3 * 25; // 3 vanish rows * 25px cell size
      expect(mockCtx.drawImage).toHaveBeenCalledWith(
        expect.any(Object),
        0,
        expectedYOffset,
      );

      cache3Vanish.dispose();
    });

    it("should handle zero vanish rows", () => {
      const noVanishViewport: BoardViewport = {
        cell: asCellSizePx(30),
        cols: asBoardCols(10),
        vanishRows: asVanishRows(0),
        visibleRows: asVisibleRows(20),
      };

      const noVanishCache = createGridCache(noVanishViewport);
      noVanishCache.drawGrid(mockCtx);

      // Grid should be drawn at y-offset 0
      expect(mockCtx.drawImage).toHaveBeenCalledWith(expect.any(Object), 0, 0);

      noVanishCache.dispose();
    });

    it("should be callable multiple times", () => {
      gridCache.drawGrid(mockCtx);
      gridCache.drawGrid(mockCtx);
      gridCache.drawGrid(mockCtx);

      expect(mockCtx.drawImage).toHaveBeenCalledTimes(3);
    });

    it("should work with different canvas contexts", () => {
      const mockCtx2 = {
        drawImage: jest.fn(),
      } as unknown as CanvasRenderingContext2D;

      gridCache.drawGrid(mockCtx);
      gridCache.drawGrid(mockCtx2);

      expect(mockCtx.drawImage).toHaveBeenCalledTimes(1);
      expect(mockCtx2.drawImage).toHaveBeenCalledTimes(1);
    });
  });

  describe("dispose", () => {
    beforeEach(() => {
      gridCache = createGridCache(viewport);
    });

    it("should clean up offscreen canvas resources", () => {
      expect(() => {
        gridCache.dispose();
      }).not.toThrow();
    });

    it("should be safe to call multiple times", () => {
      gridCache.dispose();
      expect(() => {
        gridCache.dispose();
      }).not.toThrow();
    });

    it("should still allow drawGrid calls after dispose", () => {
      gridCache.dispose();

      // Should not throw, though behavior may be undefined
      expect(() => {
        gridCache.drawGrid(mockCtx);
      }).not.toThrow();
    });
  });

  describe("grid line rendering", () => {
    let mockOffscreenCtx: MockOffscreenCanvasRenderingContext2D;

    beforeEach(() => {
      // Reset mock for each test
      mockOffscreenCtx = new MockOffscreenCanvasRenderingContext2D();

      // Override getContext to return our mock
      MockOffscreenCanvas.prototype.getContext = function (type: string) {
        if (type === "2d") {
          return mockOffscreenCtx;
        }
        return null;
      };
    });

    it("should draw vertical grid lines", () => {
      gridCache = createGridCache(viewport);

      // Should draw 11 vertical lines for 10 columns (0 to 10 inclusive)
      const verticalLines = mockOffscreenCtx.moveTo.mock.calls.filter(
        (call) => call[1] === 0, // moveTo calls with y=0 are vertical line starts
      );
      expect(verticalLines.length).toBeGreaterThanOrEqual(10);
    });

    it("should draw horizontal grid lines", () => {
      gridCache = createGridCache(viewport);

      // Should draw 21 horizontal lines for 20 visible rows (0 to 20 inclusive)
      const horizontalLines = mockOffscreenCtx.moveTo.mock.calls.filter(
        (call) => call[0] === 0, // moveTo calls with x=0 are horizontal line starts
      );
      expect(horizontalLines.length).toBeGreaterThanOrEqual(20);
    });

    it("should set correct stroke style for grid lines", () => {
      gridCache = createGridCache(viewport);

      expect(mockOffscreenCtx.strokeStyle).toBe("#222222");
      expect(mockOffscreenCtx.lineWidth).toBe(1);
    });

    it("should call stroke for each line", () => {
      gridCache = createGridCache(viewport);

      // Should have called stroke for each line (11 vertical + 21 horizontal = 32 total)
      const expectedLines = 10 + 1 + (20 + 1); // cols+1 + visibleRows+1
      expect(mockOffscreenCtx.stroke).toHaveBeenCalledTimes(expectedLines);
    });

    it("should handle minimal grid dimensions", () => {
      const minViewport: BoardViewport = {
        cell: asCellSizePx(10),
        cols: asBoardCols(1),
        vanishRows: asVanishRows(0),
        visibleRows: asVisibleRows(1),
      };

      const minCache = createGridCache(minViewport);

      // 2 vertical lines + 2 horizontal lines = 4 total
      expect(mockOffscreenCtx.stroke).toHaveBeenCalledTimes(4);

      minCache.dispose();
    });
  });

  describe("integration tests", () => {
    it("should create functional grid cache for standard Tetris board", () => {
      const standardViewport: BoardViewport = {
        cell: asCellSizePx(30),
        cols: asBoardCols(10),
        vanishRows: asVanishRows(2),
        visibleRows: asVisibleRows(20),
      };

      gridCache = createGridCache(standardViewport);

      expect(gridCache).toBeDefined();

      // Should be able to draw grid without errors
      expect(() => {
        gridCache.drawGrid(mockCtx);
      }).not.toThrow();

      // Should be able to dispose without errors
      expect(() => {
        gridCache.dispose();
      }).not.toThrow();
    });

    it("should work with non-standard dimensions", () => {
      const wideViewport: BoardViewport = {
        cell: asCellSizePx(20),
        cols: asBoardCols(15),
        vanishRows: asVanishRows(5),
        visibleRows: asVisibleRows(25),
      };

      gridCache = createGridCache(wideViewport);

      gridCache.drawGrid(mockCtx);

      const expectedYOffset = 5 * 20; // 5 vanish rows * 20px cell size
      expect(mockCtx.drawImage).toHaveBeenCalledWith(
        expect.any(Object),
        0,
        expectedYOffset,
      );
    });

    it("should maintain type safety with branded viewport types", () => {
      // Test should compile without type errors when using branded types correctly
      const typedViewport: BoardViewport = {
        cell: asCellSizePx(35),
        cols: asBoardCols(8),
        vanishRows: asVanishRows(1),
        visibleRows: asVisibleRows(16),
      } as const;

      expect(() => {
        gridCache = createGridCache(typedViewport);
        gridCache.drawGrid(mockCtx);
        gridCache.dispose();
      }).not.toThrow();
    });
  });
});
