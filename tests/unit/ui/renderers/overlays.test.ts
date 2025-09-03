import { describe, it, expect, jest, beforeEach } from "@jest/globals";

import { createGridCoord } from "../../../../src/types/brands";
import { renderOverlays } from "../../../../src/ui/renderers/overlays";
import {
  createBoardViewport,
  createCellSizePx,
  createBoardCols,
  createVisibleRows,
  createVanishRows,
} from "../../../fixtures/brands-render";
import { createMockCanvasContext } from "../../../test-helpers";

import type { RenderOverlay } from "../../../../src/engine/ui/overlays";
import type { OutlineCache } from "../../../../src/ui/renderers/outline-cache";
import type { OutlinePath } from "../../../../src/ui/utils/outlines";

// Mock outline cache
const createMockOutlineCache = (): OutlineCache => ({
  get: jest.fn(
    () =>
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ] as OutlinePath,
  ),
});

// Using shared mock canvas context from test-helpers

// Mock pathToPath2D
jest.mock("../../../../src/ui/utils/outlines", () => ({
  pathToPath2D: jest.fn(() => new Path2D()),
}));

describe("ui/renderers/overlays", () => {
  let mockCtx: ReturnType<typeof createMockCanvasContext>;
  let viewport: ReturnType<typeof createBoardViewport>;
  let outlineCache: OutlineCache;

  beforeEach(() => {
    mockCtx = createMockCanvasContext();
    viewport = createBoardViewport({
      cell: createCellSizePx(30),
      cols: createBoardCols(10),
      vanishRows: createVanishRows(4),
      visibleRows: createVisibleRows(20),
    });
    outlineCache = createMockOutlineCache();
    jest.clearAllMocks();
  });

  describe("renderOverlays", () => {
    it("renders no overlays for empty array", () => {
      renderOverlays(mockCtx, [], viewport, outlineCache);

      // Should not call any rendering methods
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.save.mock.calls).toHaveLength(0);
      expect(mockedCtx.restore.mock.calls).toHaveLength(0);
    });

    it("handles all overlay types with exhaustive switch", () => {
      const overlays: Array<RenderOverlay> = [
        {
          cells: [[createGridCoord(5), createGridCoord(10)]],
          id: "test-ghost",
          kind: "ghost",
          pieceId: "T",
          z: 2,
        },
        {
          cells: [[createGridCoord(3), createGridCoord(5)]],
          id: "test-target",
          kind: "target",
          style: "outline",
          z: 3,
        },
        {
          id: "test-flash",
          kind: "line-flash",
          rows: [5, 10],
          z: 4,
        },
        {
          at: [createGridCoord(2), createGridCoord(8)],
          id: "test-dot",
          kind: "effect-dot",
          style: "pulse",
          z: 4,
        },
        {
          columns: [3, 4, 5],
          id: "test-column",
          kind: "column-highlight",
          z: 0.5,
        },
      ];

      renderOverlays(mockCtx, overlays, viewport, outlineCache);

      // Each overlay type should save and restore context
      // Target overlay with outline style calls save/restore twice (once for fill, once for outline)
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.save.mock.calls).toHaveLength(6);
      expect(mockedCtx.restore.mock.calls).toHaveLength(6);
    });
  });

  describe("ghost overlay", () => {
    const createGhostOverlay = (
      overrides: Partial<RenderOverlay & { kind: "ghost" }> = {},
    ): Extract<RenderOverlay, { kind: "ghost" }> => ({
      cells: [[createGridCoord(5), createGridCoord(10)]],
      id: "test-ghost",
      kind: "ghost",
      pieceId: "T",
      z: 2,
      ...overrides,
    });

    it("renders ghost cells with default opacity", () => {
      const overlay = createGhostOverlay();
      renderOverlays(mockCtx, [overlay], viewport, outlineCache);

      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.globalAlpha).toBe(0.35); // Default opacity
      expect(mockedCtx.fillRect.mock.calls.length).toBeGreaterThan(0);
    });

    it("renders ghost cells with custom opacity", () => {
      const overlay = createGhostOverlay({ opacity: 0.5 });
      renderOverlays(mockCtx, [overlay], viewport, outlineCache);

      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.globalAlpha).toBe(0.5);
    });

    it("renders multiple ghost cells", () => {
      const overlay = createGhostOverlay({
        cells: [
          [createGridCoord(1), createGridCoord(5)],
          [createGridCoord(2), createGridCoord(5)],
          [createGridCoord(3), createGridCoord(5)],
          [createGridCoord(4), createGridCoord(5)],
        ],
      });
      renderOverlays(mockCtx, [overlay], viewport, outlineCache);

      // Should render cells with gradients and highlights/shadows
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.fillRect.mock.calls.length).toBeGreaterThan(0);
      expect(mockedCtx.strokeRect.mock.calls).toHaveLength(4); // Border for each cell
    });

    it("skips cells outside viewport bounds", () => {
      const overlay = createGhostOverlay({
        cells: [
          [createGridCoord(-1), createGridCoord(5)], // Outside left
          [createGridCoord(15), createGridCoord(5)], // Outside right
          [createGridCoord(5), createGridCoord(-10)], // Outside top (beyond vanish)
          [createGridCoord(5), createGridCoord(25)], // Outside bottom
          [createGridCoord(5), createGridCoord(10)], // Valid cell
        ],
      });
      renderOverlays(mockCtx, [overlay], viewport, outlineCache);

      // Should only render the one valid cell
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.strokeRect.mock.calls).toHaveLength(1);
    });

    it("handles vanish zone cells correctly", () => {
      const overlay = createGhostOverlay({
        cells: [
          [createGridCoord(5), createGridCoord(-2)], // In vanish zone
          [createGridCoord(3), createGridCoord(-1)], // In vanish zone
        ],
      });
      renderOverlays(mockCtx, [overlay], viewport, outlineCache);

      // Should render vanish zone cells
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.strokeRect.mock.calls).toHaveLength(2);
    });
  });

  describe("target overlay", () => {
    const createTargetOverlay = (
      overrides: Partial<Extract<RenderOverlay, { kind: "target" }>> = {},
    ): Extract<RenderOverlay, { kind: "target" }> => ({
      cells: [[createGridCoord(3), createGridCoord(5)]],
      id: "test-target",
      kind: "target",
      style: "outline",
      z: 3,
      ...overrides,
    });

    it("renders target with default color and alpha", () => {
      const overlay = createTargetOverlay();
      renderOverlays(mockCtx, [overlay], viewport, outlineCache);

      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.globalAlpha).toBe(0.25); // Default alpha
      expect(mockedCtx.fillRect.mock.calls.length).toBeGreaterThan(0);
    });

    it("renders target with custom color and alpha", () => {
      const overlay = createTargetOverlay({
        alpha: 0.5,
        color: "#FF0000",
      });
      renderOverlays(mockCtx, [overlay], viewport, outlineCache);

      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.globalAlpha).toBe(0.5);
    });

    it("renders outline style target", () => {
      const overlay = createTargetOverlay({ style: "outline" });
      renderOverlays(mockCtx, [overlay], viewport, outlineCache);

      expect(outlineCache.get).toHaveBeenCalled();
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.stroke.mock.calls.length).toBeGreaterThan(0); // Outline stroke
    });

    it("renders non-outline style target with borders", () => {
      const overlay = createTargetOverlay({ style: "glow" });
      renderOverlays(mockCtx, [overlay], viewport, outlineCache);

      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.strokeRect.mock.calls.length).toBeGreaterThan(0); // Individual borders
    });

    it("handles empty cells array", () => {
      const overlay = createTargetOverlay({ cells: [] });
      renderOverlays(mockCtx, [overlay], viewport, outlineCache);

      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.fillRect.mock.calls).toHaveLength(0);
      expect(mockedCtx.stroke.mock.calls).toHaveLength(0);
    });

    it("filters out invalid cells", () => {
      const overlay = createTargetOverlay({
        cells: [
          [createGridCoord(-1), createGridCoord(5)], // Outside bounds
          [createGridCoord(15), createGridCoord(5)], // Outside bounds
          [createGridCoord(3), createGridCoord(5)], // Valid
          [createGridCoord(4), createGridCoord(6)], // Valid
        ],
      });
      renderOverlays(mockCtx, [overlay], viewport, outlineCache);

      // Should only process 2 valid cells
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.fillRect.mock.calls).toHaveLength(2);
    });
  });

  describe("line flash overlay", () => {
    const createLineFlashOverlay = (
      overrides: Partial<Extract<RenderOverlay, { kind: "line-flash" }>> = {},
    ): Extract<RenderOverlay, { kind: "line-flash" }> => ({
      id: "test-flash",
      kind: "line-flash",
      rows: [5],
      z: 4,
      ...overrides,
    });

    it("renders line flash with default color and intensity", () => {
      const overlay = createLineFlashOverlay();
      renderOverlays(mockCtx, [overlay], viewport, outlineCache);

      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.globalCompositeOperation).toBe("lighter"); // Additive blending
      expect(mockedCtx.globalAlpha).toBe(1.0); // Default intensity
      expect(mockedCtx.fillStyle).toBe("#FFFFFF"); // Default color
    });

    it("renders line flash with custom color and intensity", () => {
      const overlay = createLineFlashOverlay({
        color: "#FF0000",
        intensity: 0.7,
      });
      renderOverlays(mockCtx, [overlay], viewport, outlineCache);

      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.globalAlpha).toBe(0.7);
      expect(mockedCtx.fillStyle).toBe("#FF0000");
    });

    it("renders multiple rows", () => {
      const overlay = createLineFlashOverlay({
        rows: [2, 5, 10, 15],
      });
      renderOverlays(mockCtx, [overlay], viewport, outlineCache);

      // Should fill rectangle for each row (10 cols × 30px = 300px width)
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.fillRect.mock.calls).toHaveLength(4);
      expect(mockedCtx.fillRect.mock.calls).toContainEqual([0, 180, 300, 30]); // Row 2: y=(2+4)*30=180px
    });

    it("skips rows outside visible area", () => {
      const overlay = createLineFlashOverlay({
        rows: [-1, 25, 5], // -1 and 25 are outside, 5 is valid
      });
      renderOverlays(mockCtx, [overlay], viewport, outlineCache);

      // Should only render the valid row
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.fillRect.mock.calls).toHaveLength(1);
    });

    it("handles empty rows array", () => {
      const overlay = createLineFlashOverlay({ rows: [] });
      renderOverlays(mockCtx, [overlay], viewport, outlineCache);

      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.fillRect.mock.calls).toHaveLength(0);
    });
  });

  describe("effect dot overlay", () => {
    const createEffectDotOverlay = (
      overrides: Partial<Extract<RenderOverlay, { kind: "effect-dot" }>> = {},
    ): Extract<RenderOverlay, { kind: "effect-dot" }> => ({
      at: [createGridCoord(5), createGridCoord(10)],
      id: "test-dot",
      kind: "effect-dot",
      style: "pulse",
      z: 4,
      ...overrides,
    });

    it("renders pulse style effect dot", () => {
      const overlay = createEffectDotOverlay({ style: "pulse" });
      renderOverlays(mockCtx, [overlay], viewport, outlineCache);

      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.globalCompositeOperation).toBe("lighter");
      expect(mockedCtx.filter).toContain("blur");
      expect(mockedCtx.arc.mock.calls.length).toBeGreaterThan(0);
      expect(mockedCtx.fill.mock.calls.length).toBeGreaterThan(0);
    });

    it("renders sparkle style effect dot", () => {
      const overlay = createEffectDotOverlay({ style: "sparkle" });
      renderOverlays(mockCtx, [overlay], viewport, outlineCache);

      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.globalCompositeOperation).toBe("lighter");
      expect(mockedCtx.fillRect.mock.calls.length).toBeGreaterThan(0);
    });

    it("renders fade style effect dot", () => {
      const overlay = createEffectDotOverlay({ style: "fade" });
      renderOverlays(mockCtx, [overlay], viewport, outlineCache);

      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.globalAlpha).toBe(0.7);
      expect(mockedCtx.arc.mock.calls.length).toBeGreaterThan(0);
      expect(mockedCtx.fill.mock.calls.length).toBeGreaterThan(0);
    });

    it("uses default color and size", () => {
      const overlay = createEffectDotOverlay();
      renderOverlays(mockCtx, [overlay], viewport, outlineCache);

      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.fillStyle).toBe("#FFFF00"); // Default yellow
    });

    it("uses custom color and size", () => {
      const overlay = createEffectDotOverlay({
        color: "#00FF00",
        size: 2.0,
      });
      renderOverlays(mockCtx, [overlay], viewport, outlineCache);

      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.fillStyle).toBe("#00FF00");
      // Size affects radius calculation - should be cellSize * 0.3 * size = 30 * 0.3 * 2 = 18
    });

    it("skips effects outside visible area", () => {
      const overlay = createEffectDotOverlay({
        at: [createGridCoord(-1), createGridCoord(5)], // Outside left boundary
      });
      renderOverlays(mockCtx, [overlay], viewport, outlineCache);

      // Should not render anything
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.arc.mock.calls).toHaveLength(0);
      expect(mockedCtx.fillRect.mock.calls).toHaveLength(0);
    });

    it("skips effects in vanish zone", () => {
      const overlay = createEffectDotOverlay({
        at: [createGridCoord(5), createGridCoord(-1)], // In vanish zone (y < 0)
      });
      renderOverlays(mockCtx, [overlay], viewport, outlineCache);

      // Should not render (effect dots don't show in vanish zone)
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.arc.mock.calls).toHaveLength(0);
      expect(mockedCtx.fillRect.mock.calls).toHaveLength(0);
    });
  });

  describe("column highlight overlay", () => {
    const createColumnHighlightOverlay = (
      overrides: Partial<
        Extract<RenderOverlay, { kind: "column-highlight" }>
      > = {},
    ): Extract<RenderOverlay, { kind: "column-highlight" }> => ({
      columns: [3],
      id: "test-column",
      kind: "column-highlight",
      z: 0.5,
      ...overrides,
    });

    it("renders column highlight with default color and intensity", () => {
      const overlay = createColumnHighlightOverlay();
      renderOverlays(mockCtx, [overlay], viewport, outlineCache);

      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.globalAlpha).toBe(0.08); // Default intensity
      expect(mockedCtx.fillStyle).toBe("#CCCCCC"); // Default color
      expect(mockedCtx.fillRect.mock.calls.length).toBeGreaterThan(0);
    });

    it("renders column highlight with custom color and intensity", () => {
      const overlay = createColumnHighlightOverlay({
        color: "#FF0000",
        intensity: 0.2,
      });
      renderOverlays(mockCtx, [overlay], viewport, outlineCache);

      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.globalAlpha).toBe(0.2);
      expect(mockedCtx.fillStyle).toBe("#FF0000");
    });

    it("renders multiple columns", () => {
      const overlay = createColumnHighlightOverlay({
        columns: [1, 3, 5, 7],
      });
      renderOverlays(mockCtx, [overlay], viewport, outlineCache);

      // Should fill rectangle for each column (height = visibleRows * cellSize = 20 * 30 = 600px)
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.fillRect.mock.calls).toHaveLength(4);
      // Check one specific call: column 3 at x=90px, starting at vanish offset y=120px
      expect(mockedCtx.fillRect.mock.calls).toContainEqual([90, 120, 30, 600]);
    });

    it("skips columns outside board width", () => {
      const overlay = createColumnHighlightOverlay({
        columns: [-1, 15, 5], // -1 and 15 are outside 10-column board, 5 is valid
      });
      renderOverlays(mockCtx, [overlay], viewport, outlineCache);

      // Should only render the valid column
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.fillRect.mock.calls).toHaveLength(1);
    });

    it("handles empty columns array", () => {
      const overlay = createColumnHighlightOverlay({ columns: [] });
      renderOverlays(mockCtx, [overlay], viewport, outlineCache);

      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.fillRect.mock.calls).toHaveLength(0);
    });
  });

  describe("edge cases and error handling", () => {
    it("handles mixed valid and invalid overlays gracefully", () => {
      const overlays: Array<RenderOverlay> = [
        {
          cells: [[createGridCoord(5), createGridCoord(10)]],
          id: "valid-ghost",
          kind: "ghost",
          pieceId: "T",
          z: 2,
        },
        {
          cells: [], // Empty cells
          id: "empty-target",
          kind: "target",
          style: "outline",
          z: 3,
        },
        {
          at: [createGridCoord(-5), createGridCoord(-5)], // Way outside
          id: "outside-dot",
          kind: "effect-dot",
          style: "pulse",
          z: 4,
        },
      ];

      expect(() => {
        renderOverlays(mockCtx, overlays, viewport, outlineCache);
      }).not.toThrow();

      // Should render all overlay types (even if some are empty/invalid)
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.save.mock.calls.length).toBeGreaterThan(0);
      expect(mockedCtx.restore.mock.calls.length).toBeGreaterThan(0);
    });

    it("preserves context state with save/restore", () => {
      const overlay: RenderOverlay = {
        cells: [[createGridCoord(5), createGridCoord(10)]],
        id: "test-ghost",
        kind: "ghost",
        pieceId: "T",
        z: 2,
      };

      renderOverlays(mockCtx, [overlay], viewport, outlineCache);

      // Verify save and restore are called in pairs
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.save.mock.calls).toHaveLength(1);
      expect(mockedCtx.restore.mock.calls).toHaveLength(1);
    });

    it("handles different viewport configurations", () => {
      const smallViewport = createBoardViewport({
        cell: createCellSizePx(20),
        cols: createBoardCols(6),
        vanishRows: createVanishRows(2),
        visibleRows: createVisibleRows(12),
      });

      const overlay: RenderOverlay = {
        columns: [2, 8], // 8 is outside 6-column board
        id: "test-column",
        kind: "column-highlight",
        z: 0.5,
      };

      renderOverlays(mockCtx, [overlay], smallViewport, outlineCache);

      // Should only render column 2 (8 is outside bounds)
      const mockedCtx = jest.mocked(mockCtx);
      expect(mockedCtx.fillRect.mock.calls).toHaveLength(1);
      // Column 2: x=40px (2*20), height=240px (12*20)
      expect(mockedCtx.fillRect.mock.calls).toContainEqual([40, 40, 20, 240]);
    });
  });
});
