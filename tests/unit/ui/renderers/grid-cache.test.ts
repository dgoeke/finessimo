import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";

import { createGridCache } from "@/ui/renderers/grid-cache";

import {
  createBoardViewport,
  createCellSizePx,
  createBoardCols,
  createVisibleRows,
  createVanishRows,
} from "../../../fixtures/brands-render";
import { createMockCanvasContext } from "../../../test-helpers";

// Mock OffscreenCanvas context
const createMockOffscreenContext = () => ({
  beginPath: jest.fn(),
  lineTo: jest.fn(),
  lineWidth: 0,
  moveTo: jest.fn(),
  stroke: jest.fn(),
  strokeStyle: "",
});

// Mock OffscreenCanvas
const createMockOffscreenCanvas = (width: number, height: number) => ({
  getContext: jest.fn(() => createMockOffscreenContext()),
  height,
  width,
});

// Use shared mock canvas context from test-helpers

// Track all created mock canvases and contexts
let mockCanvases: Array<ReturnType<typeof createMockOffscreenCanvas>> = [];
let mockContexts: Array<ReturnType<typeof createMockOffscreenContext>> = [];

// Mock global OffscreenCanvas
const originalOffscreenCanvas = global.OffscreenCanvas;
beforeEach(() => {
  mockCanvases = [];
  mockContexts = [];

  global.OffscreenCanvas = jest.fn((width: number, height: number) => {
    const canvas = createMockOffscreenCanvas(width, height);
    const context = createMockOffscreenContext();
    canvas.getContext = jest.fn(() => context);
    mockCanvases.push(canvas);
    mockContexts.push(context);
    return canvas;
  }) as unknown as typeof OffscreenCanvas;
});

afterEach(() => {
  global.OffscreenCanvas = originalOffscreenCanvas;
  jest.clearAllMocks();
});

describe("ui/renderers/grid-cache", () => {
  let viewport: ReturnType<typeof createBoardViewport>;

  beforeEach(() => {
    viewport = createBoardViewport({
      cell: createCellSizePx(30),
      cols: createBoardCols(10),
      vanishRows: createVanishRows(4),
      visibleRows: createVisibleRows(20),
    });
  });

  describe("createGridCache", () => {
    it("creates a grid cache with the correct interface", () => {
      const cache = createGridCache(viewport);

      expect(cache).toHaveProperty("drawGrid");
      expect(cache).toHaveProperty("dispose");
      expect(typeof cache.drawGrid).toBe("function");
      expect(typeof cache.dispose).toBe("function");
    });

    it("creates offscreen canvas with correct dimensions", () => {
      createGridCache(viewport);

      // The grid should be sized to the visible area (10 cols × 20 rows × 30px each)
      expect(
        (global.OffscreenCanvas as jest.MockedClass<typeof OffscreenCanvas>)
          .mock.calls[0],
      ).toEqual([300, 600]);
    });

    it("handles different viewport configurations", () => {
      const smallViewport = createBoardViewport({
        cell: createCellSizePx(20),
        cols: createBoardCols(8),
        vanishRows: createVanishRows(2),
        visibleRows: createVisibleRows(16),
      });

      createGridCache(smallViewport);

      // Should create canvas with 8 × 16 × 20px = 160 × 320
      expect(
        (global.OffscreenCanvas as jest.MockedClass<typeof OffscreenCanvas>)
          .mock.calls[0],
      ).toEqual([160, 320]);
    });

    it("throws error if offscreen context creation fails", () => {
      // Mock OffscreenCanvas to return null context
      const FailingOffscreenCanvas = class {
        constructor(
          public width: number,
          public height: number,
        ) {}
        getContext(): null {
          return null;
        }
      };
      global.OffscreenCanvas =
        FailingOffscreenCanvas as unknown as typeof OffscreenCanvas;

      expect(() => createGridCache(viewport)).toThrow(
        "Failed to get 2D context for grid canvas",
      );
    });

    it("draws grid lines to offscreen canvas during initialization", () => {
      createGridCache(viewport);

      // Should have drawn vertical and horizontal lines
      // 11 vertical lines (0 to 10) + 21 horizontal lines (0 to 20) = 32 lines
      const mockCtx = mockContexts[0];
      if (!mockCtx) {
        throw new Error("Mock context not found");
      }
      expect(mockCtx.stroke).toHaveBeenCalledTimes(32);
      expect(mockCtx.beginPath).toHaveBeenCalledTimes(32);
    });
  });

  describe("GridCache.drawGrid", () => {
    it("draws the cached grid to the target context", () => {
      const cache = createGridCache(viewport);
      const mockCtx = createMockCanvasContext();

      cache.drawGrid(mockCtx);

      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.drawImage.mock.calls).toHaveLength(1);
      // Should draw at vanish offset (4 rows × 30px = 120px down)
      expect(mockedCtx.drawImage.mock.calls[0]).toEqual([
        expect.any(Object),
        0,
        120,
      ]);
    });

    it("calculates correct vanish offset for different configurations", () => {
      const customViewport = createBoardViewport({
        cell: createCellSizePx(25),
        cols: createBoardCols(10),
        vanishRows: createVanishRows(3),
        visibleRows: createVisibleRows(20),
      });

      const cache = createGridCache(customViewport);
      const mockCtx = createMockCanvasContext();

      cache.drawGrid(mockCtx);

      // Should draw at vanish offset (3 rows × 25px = 75px down)
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.drawImage.mock.calls[0]).toEqual([
        expect.any(Object),
        0,
        75,
      ]);
    });

    it("handles zero vanish rows correctly", () => {
      const noVanishViewport = createBoardViewport({
        cell: createCellSizePx(30),
        cols: createBoardCols(10),
        vanishRows: createVanishRows(0),
        visibleRows: createVisibleRows(20),
      });

      const cache = createGridCache(noVanishViewport);
      const mockCtx = createMockCanvasContext();

      cache.drawGrid(mockCtx);

      // Should draw at y=0 (no offset)
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.drawImage.mock.calls[0]).toEqual([
        expect.any(Object),
        0,
        0,
      ]);
    });

    it("can be called multiple times", () => {
      const cache = createGridCache(viewport);
      const mockCtx = createMockCanvasContext();

      cache.drawGrid(mockCtx);
      cache.drawGrid(mockCtx);
      cache.drawGrid(mockCtx);

      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.drawImage.mock.calls).toHaveLength(3);
      // All calls should use the same parameters
      expect(mockedCtx.drawImage.mock.calls[0]).toEqual([
        expect.any(Object),
        0,
        120,
      ]);
      expect(mockedCtx.drawImage.mock.calls[1]).toEqual([
        expect.any(Object),
        0,
        120,
      ]);
      expect(mockedCtx.drawImage.mock.calls[2]).toEqual([
        expect.any(Object),
        0,
        120,
      ]);
    });
  });

  describe("GridCache.dispose", () => {
    it("cleans up offscreen canvas resources", () => {
      const cache = createGridCache(viewport);

      // Get reference to the mock canvas
      const mockCanvas = mockCanvases[0];
      expect(mockCanvas).toBeDefined();
      expect(mockCanvas?.width).toBe(300);
      expect(mockCanvas?.height).toBe(600);

      cache.dispose();

      expect(mockCanvas?.width).toBe(0);
      expect(mockCanvas?.height).toBe(0);
    });

    it("can be called multiple times safely", () => {
      const cache = createGridCache(viewport);

      const mockCanvas = mockCanvases[0];
      expect(mockCanvas).toBeDefined();

      cache.dispose();
      cache.dispose();
      cache.dispose();

      expect(mockCanvas?.width).toBe(0);
      expect(mockCanvas?.height).toBe(0);
    });

    it("dispose after drawGrid still works", () => {
      const cache = createGridCache(viewport);
      const mockCtx = createMockCanvasContext();

      cache.drawGrid(mockCtx);
      cache.dispose();

      // Should not throw, but dispose should clean up
      const mockCanvas = mockCanvases[0];
      expect(mockCanvas).toBeDefined();
      expect(mockCanvas?.width).toBe(0);
      expect(mockCanvas?.height).toBe(0);
    });
  });

  describe("grid line drawing", () => {
    it("draws correct number of grid lines for standard viewport", () => {
      createGridCache(viewport);

      const mockCtx = mockContexts[0];
      if (!mockCtx) {
        throw new Error("Mock context not found");
      }

      // 10 cols = 11 vertical lines (0-10), 20 rows = 21 horizontal lines (0-20)
      expect(mockCtx.stroke).toHaveBeenCalledTimes(32);
      expect(mockCtx.moveTo).toHaveBeenCalledTimes(32);
      expect(mockCtx.lineTo).toHaveBeenCalledTimes(32);
    });

    it("sets correct stroke style and line width", () => {
      createGridCache(viewport);

      const mockCtx = mockContexts[0];
      if (!mockCtx) {
        throw new Error("Mock context not found");
      }
      expect(mockCtx.strokeStyle).toBe("#222222");
      expect(mockCtx.lineWidth).toBe(1);
    });

    it("draws lines at correct pixel positions for vertical lines", () => {
      createGridCache(viewport);

      const mockCtx = mockContexts[0];
      if (!mockCtx) {
        throw new Error("Mock context not found");
      }

      // Check some vertical line positions (every 30px)
      expect(mockCtx.moveTo.mock.calls[0]).toEqual([0, 0]); // First vertical line
      expect(mockCtx.lineTo.mock.calls[0]).toEqual([0, 600]); // First vertical line to bottom
      expect(mockCtx.moveTo.mock.calls[1]).toEqual([30, 0]); // Second vertical line
      expect(mockCtx.lineTo.mock.calls[1]).toEqual([30, 600]); // Second vertical line to bottom
      expect(mockCtx.moveTo.mock.calls[10]).toEqual([300, 0]); // Last vertical line (10 cols = 300px)
      expect(mockCtx.lineTo.mock.calls[10]).toEqual([300, 600]); // Last vertical line to bottom
    });

    it("draws lines at correct pixel positions for horizontal lines", () => {
      createGridCache(viewport);

      const mockCtx = mockContexts[0];
      if (!mockCtx) {
        throw new Error("Mock context not found");
      }

      // Check some horizontal line positions (every 30px)
      // Horizontal lines start after vertical lines (11 vertical + index for horizontal)
      expect(mockCtx.moveTo.mock.calls[11]).toEqual([0, 0]); // Top horizontal line
      expect(mockCtx.lineTo.mock.calls[11]).toEqual([300, 0]); // Top horizontal line to right edge
      expect(mockCtx.moveTo.mock.calls[12]).toEqual([0, 30]); // Second horizontal line
      expect(mockCtx.lineTo.mock.calls[12]).toEqual([300, 30]); // Second horizontal line to right edge
      expect(mockCtx.moveTo.mock.calls[31]).toEqual([0, 600]); // Bottom horizontal line (20 rows = 600px)
      expect(mockCtx.lineTo.mock.calls[31]).toEqual([300, 600]); // Bottom horizontal line to right edge
    });

    it("adjusts grid line count for different viewport sizes", () => {
      const smallViewport = createBoardViewport({
        cell: createCellSizePx(20),
        cols: createBoardCols(6),
        vanishRows: createVanishRows(2),
        visibleRows: createVisibleRows(12),
      });

      createGridCache(smallViewport);

      const mockCtx = mockContexts[mockContexts.length - 1]; // Get the latest context
      expect(mockCtx).toBeDefined();

      // 6 cols = 7 vertical lines, 12 rows = 13 horizontal lines = 20 total
      expect(mockCtx?.stroke).toHaveBeenCalledTimes(20);
    });
  });

  describe("edge cases", () => {
    it("handles single cell viewport", () => {
      const singleCellViewport = createBoardViewport({
        cell: createCellSizePx(50),
        cols: createBoardCols(1),
        vanishRows: createVanishRows(0),
        visibleRows: createVisibleRows(1),
      });

      createGridCache(singleCellViewport);

      expect(
        (global.OffscreenCanvas as jest.MockedClass<typeof OffscreenCanvas>)
          .mock.calls[0],
      ).toEqual([50, 50]);

      const mockCtx = mockContexts[mockContexts.length - 1];
      expect(mockCtx).toBeDefined();
      // 1 col = 2 vertical lines, 1 row = 2 horizontal lines = 4 total
      expect(mockCtx?.stroke).toHaveBeenCalledTimes(4);
    });

    it("handles large viewport dimensions", () => {
      const largeViewport = createBoardViewport({
        cell: createCellSizePx(40),
        cols: createBoardCols(15),
        vanishRows: createVanishRows(5),
        visibleRows: createVisibleRows(25),
      });

      const cache = createGridCache(largeViewport);

      expect(
        (global.OffscreenCanvas as jest.MockedClass<typeof OffscreenCanvas>)
          .mock.calls[0],
      ).toEqual([600, 1000]); // 15×40, 25×40

      const mockCtx = createMockCanvasContext();
      cache.drawGrid(mockCtx);

      // Should draw at vanish offset (5 rows × 40px = 200px down)
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.drawImage.mock.calls[0]).toEqual([
        expect.any(Object),
        0,
        200,
      ]);
    });

    it("maintains immutability of GridCache interface", () => {
      const cache = createGridCache(viewport);

      // The cache should have readonly properties at the TypeScript level
      // Test that the returned cache works as expected
      const mockCtx = createMockCanvasContext();
      cache.drawGrid(mockCtx);
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.drawImage.mock.calls).toHaveLength(1);

      // Verify the cache maintains its interface after operations
      cache.dispose();
      expect(() => cache.drawGrid(createMockCanvasContext())).not.toThrow();
    });
  });
});
