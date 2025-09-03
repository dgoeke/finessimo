import { describe, it, expect, beforeEach } from "@jest/globals";

import { Z } from "../../../src/engine/ui/overlays";
import { createGridCoord } from "../../../src/types/brands";
import { renderOverlays } from "../../../src/ui/renderers/overlays";
import {
  asCellSizePx,
  asBoardCols,
  asVisibleRows,
  asVanishRows,
} from "../../../src/ui/types/brands-render";

import type { RenderOverlay } from "../../../src/engine/ui/overlays";
import type { OutlineCache } from "../../../src/ui/renderers/outline-cache";
import type { BoardViewport } from "../../../src/ui/types/brands-render";
import type { OutlinePath } from "../../../src/ui/utils/outlines";

describe("overlays renderer", () => {
  let mockCtx: CanvasRenderingContext2D;
  let viewport: BoardViewport;
  let mockOutlineCache: OutlineCache;

  beforeEach(() => {
    // Create comprehensive mock canvas context
    const arc = jest.fn();
    const beginPath = jest.fn();
    const createLinearGradient = jest.fn().mockReturnValue({
      addColorStop: jest.fn(),
    });
    const fill = jest.fn();
    const fillRect = jest.fn();
    const restore = jest.fn();
    const save = jest.fn();
    const stroke = jest.fn();
    const strokeRect = jest.fn();

    mockCtx = {
      arc,
      beginPath,
      createLinearGradient,
      fill,
      fillRect,
      // Drawing properties
      fillStyle: "#000000",
      filter: "none",
      globalAlpha: 1,
      globalCompositeOperation: "source-over" as GlobalCompositeOperation,
      lineCap: "butt" as CanvasLineCap,
      lineJoin: "miter" as CanvasLineJoin,
      lineWidth: 1,
      restore,
      save,
      stroke,
      strokeRect,
      strokeStyle: "#000000",
    } as unknown as CanvasRenderingContext2D;

    viewport = {
      cell: asCellSizePx(30),
      cols: asBoardCols(10),
      vanishRows: asVanishRows(2),
      visibleRows: asVisibleRows(20),
    } as const;

    // Mock outline cache
    mockOutlineCache = {
      get: jest.fn().mockReturnValue([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ] as OutlinePath),
    };
  });

  describe("renderOverlays", () => {
    it("should handle empty overlay array", () => {
      renderOverlays(mockCtx, [], viewport, mockOutlineCache);

      // Should not perform any drawing operations
      expect(mockCtx.fillRect).not.toHaveBeenCalled();
      expect(mockCtx.strokeRect).not.toHaveBeenCalled();
    });

    it("should render overlays in provided order", () => {
      const overlays: Array<RenderOverlay> = [
        {
          cells: [[createGridCoord(3), createGridCoord(5)]],
          id: "ghost-1",
          kind: "ghost",
          pieceId: "T",
          z: Z.ghost,
        },
        {
          cells: [[createGridCoord(4), createGridCoord(6)]],
          id: "target-1",
          kind: "target",
          style: "glow",
          z: Z.target,
        },
      ];

      renderOverlays(mockCtx, overlays, viewport, mockOutlineCache);

      // Both overlays should trigger drawing operations
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it("should handle all overlay types without errors", () => {
      const overlays: Array<RenderOverlay> = [
        {
          cells: [[createGridCoord(0), createGridCoord(0)]],
          id: "ghost-1",
          kind: "ghost",
          pieceId: "I",
          z: Z.ghost,
        },
        {
          cells: [[createGridCoord(1), createGridCoord(1)]],
          id: "target-1",
          kind: "target",
          style: "outline",
          z: Z.target,
        },
        {
          id: "flash-1",
          kind: "line-flash",
          rows: [0, 1, 2],
          z: Z.effect,
        },
        {
          at: [createGridCoord(5), createGridCoord(5)],
          id: "dot-1",
          kind: "effect-dot",
          style: "pulse",
          z: Z.effect,
        },
        {
          columns: [2, 3, 4],
          id: "column-1",
          kind: "column-highlight",
          z: Z.columnHighlight,
        },
      ];

      expect(() => {
        renderOverlays(mockCtx, overlays, viewport, mockOutlineCache);
      }).not.toThrow();
    });
  });

  describe("ghost overlay", () => {
    it("should render ghost overlay with default opacity", () => {
      const overlay: RenderOverlay = {
        cells: [[createGridCoord(3), createGridCoord(5)]],
        id: "ghost-1",
        kind: "ghost",
        pieceId: "T",
        z: Z.ghost,
      };

      renderOverlays(mockCtx, [overlay], viewport, mockOutlineCache);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      expect(mockCtx.globalAlpha).toBe(0.35); // default opacity
      expect(mockCtx.fillRect).toHaveBeenCalled();
      expect(mockCtx.strokeRect).toHaveBeenCalled();
    });

    it("should render ghost overlay with custom opacity", () => {
      const overlay: RenderOverlay = {
        cells: [[createGridCoord(3), createGridCoord(5)]],
        id: "ghost-1",
        kind: "ghost",
        opacity: 0.5,
        pieceId: "T",
        z: Z.ghost,
      };

      renderOverlays(mockCtx, [overlay], viewport, mockOutlineCache);

      expect(mockCtx.globalAlpha).toBe(0.5);
    });

    it("should only render cells within bounds", () => {
      const overlay: RenderOverlay = {
        cells: [
          [createGridCoord(3), createGridCoord(5)], // valid
          [createGridCoord(-1), createGridCoord(5)], // invalid x
          [createGridCoord(15), createGridCoord(5)], // invalid x
          [createGridCoord(3), createGridCoord(25)], // invalid y
        ],
        id: "ghost-1",
        kind: "ghost",
        pieceId: "T",
        z: Z.ghost,
      };

      renderOverlays(mockCtx, [overlay], viewport, mockOutlineCache);

      // Should only draw valid cells
      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it("should handle cells in vanish zone", () => {
      const overlay: RenderOverlay = {
        cells: [
          [createGridCoord(3), createGridCoord(-1)], // in vanish zone
          [createGridCoord(5), createGridCoord(-2)], // at vanish boundary
        ],
        id: "ghost-1",
        kind: "ghost",
        pieceId: "I",
        z: Z.ghost,
      };

      renderOverlays(mockCtx, [overlay], viewport, mockOutlineCache);

      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it("should handle empty cell arrays", () => {
      const overlay: RenderOverlay = {
        cells: [],
        id: "ghost-1",
        kind: "ghost",
        pieceId: "O",
        z: Z.ghost,
      };

      renderOverlays(mockCtx, [overlay], viewport, mockOutlineCache);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      // No drawing should occur for empty cells
    });
  });

  describe("target overlay", () => {
    it("should render target overlay with outline style", () => {
      const overlay: RenderOverlay = {
        alpha: 0.4,
        cells: [[createGridCoord(2), createGridCoord(3)]],
        color: "#FF0000",
        id: "target-1",
        kind: "target",
        style: "outline",
        z: Z.target,
      };

      renderOverlays(mockCtx, [overlay], viewport, mockOutlineCache);

      expect(mockOutlineCache.get).toHaveBeenCalled();
      expect(mockCtx.fillRect).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it("should render target overlay with glow style", () => {
      const overlay: RenderOverlay = {
        alpha: 0.3,
        cells: [[createGridCoord(2), createGridCoord(3)]],
        color: "#00FF00",
        id: "target-1",
        kind: "target",
        style: "glow", // non-outline style
        z: Z.target,
      };

      renderOverlays(mockCtx, [overlay], viewport, mockOutlineCache);

      expect(mockCtx.fillRect).toHaveBeenCalled();
      expect(mockCtx.strokeRect).toHaveBeenCalled();
    });

    it("should use default values for optional properties", () => {
      const overlay: RenderOverlay = {
        cells: [[createGridCoord(2), createGridCoord(3)]],
        id: "target-1",
        kind: "target",
        style: "hint",
        z: Z.target,
      };

      renderOverlays(mockCtx, [overlay], viewport, mockOutlineCache);

      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it("should handle multiple cells", () => {
      const overlay: RenderOverlay = {
        cells: [
          [createGridCoord(2), createGridCoord(3)],
          [createGridCoord(3), createGridCoord(3)],
          [createGridCoord(4), createGridCoord(3)],
        ],
        id: "target-1",
        kind: "target",
        style: "dashed",
        z: Z.target,
      };

      renderOverlays(mockCtx, [overlay], viewport, mockOutlineCache);

      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it("should not render if no valid cells", () => {
      const overlay: RenderOverlay = {
        cells: [
          [createGridCoord(-5), createGridCoord(3)], // out of bounds
          [createGridCoord(15), createGridCoord(3)], // out of bounds
        ],
        id: "target-1",
        kind: "target",
        style: "outline",
        z: Z.target,
      };

      renderOverlays(mockCtx, [overlay], viewport, mockOutlineCache);

      // Should not call outline cache or drawing methods for invalid cells
      expect(mockOutlineCache.get).not.toHaveBeenCalled();
    });
  });

  describe("line-flash overlay", () => {
    it("should render line flash overlay with default values", () => {
      const overlay: RenderOverlay = {
        id: "flash-1",
        kind: "line-flash",
        rows: [0, 1, 19],
        z: Z.effect,
      };

      renderOverlays(mockCtx, [overlay], viewport, mockOutlineCache);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      expect(mockCtx.globalCompositeOperation).toBe("lighter");
      expect(mockCtx.fillRect).toHaveBeenCalledTimes(3); // one for each row
    });

    it("should render line flash with custom color and intensity", () => {
      const overlay: RenderOverlay = {
        color: "#FF00FF",
        id: "flash-1",
        intensity: 0.8,
        kind: "line-flash",
        rows: [5],
        z: Z.effect,
      };

      renderOverlays(mockCtx, [overlay], viewport, mockOutlineCache);

      expect(mockCtx.fillStyle).toBe("#FF00FF");
      expect(mockCtx.globalAlpha).toBe(0.8);
      expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 210, 300, 30); // row 5 + vanish offset
    });

    it("should only render visible rows", () => {
      const overlay: RenderOverlay = {
        id: "flash-1",
        kind: "line-flash",
        rows: [-1, 0, 19, 20, 25], // mix of valid and invalid
        z: Z.effect,
      };

      renderOverlays(mockCtx, [overlay], viewport, mockOutlineCache);

      // Should only call fillRect for valid rows (0 and 19)
      expect(mockCtx.fillRect).toHaveBeenCalledTimes(2);
    });

    it("should handle empty rows array", () => {
      const overlay: RenderOverlay = {
        id: "flash-1",
        kind: "line-flash",
        rows: [],
        z: Z.effect,
      };

      renderOverlays(mockCtx, [overlay], viewport, mockOutlineCache);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      expect(mockCtx.fillRect).not.toHaveBeenCalled();
    });
  });

  describe("effect-dot overlay", () => {
    it("should render pulse effect dot", () => {
      const overlay: RenderOverlay = {
        at: [createGridCoord(5), createGridCoord(10)],
        id: "dot-1",
        kind: "effect-dot",
        style: "pulse",
        z: Z.effect,
      };

      renderOverlays(mockCtx, [overlay], viewport, mockOutlineCache);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      expect(mockCtx.globalCompositeOperation).toBe("lighter");
      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.arc).toHaveBeenCalled();
      expect(mockCtx.fill).toHaveBeenCalled();
    });

    it("should render sparkle effect dot", () => {
      const overlay: RenderOverlay = {
        at: [createGridCoord(3), createGridCoord(7)],
        color: "#00FFFF",
        id: "dot-1",
        kind: "effect-dot",
        size: 1.5,
        style: "sparkle",
        z: Z.effect,
      };

      renderOverlays(mockCtx, [overlay], viewport, mockOutlineCache);

      expect(mockCtx.globalCompositeOperation).toBe("lighter");
      expect(mockCtx.fillStyle).toBe("#00FFFF");
      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it("should render fade effect dot", () => {
      const overlay: RenderOverlay = {
        at: [createGridCoord(8), createGridCoord(15)],
        color: "#FF00FF",
        id: "dot-1",
        kind: "effect-dot",
        size: 0.5,
        style: "fade",
        z: Z.effect,
      };

      renderOverlays(mockCtx, [overlay], viewport, mockOutlineCache);

      expect(mockCtx.globalAlpha).toBe(0.7);
      expect(mockCtx.fillStyle).toBe("#FF00FF");
      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.arc).toHaveBeenCalled();
      expect(mockCtx.fill).toHaveBeenCalled();
    });

    it("should not render dot outside visible area", () => {
      const overlay: RenderOverlay = {
        at: [createGridCoord(15), createGridCoord(25)], // out of bounds
        id: "dot-1",
        kind: "effect-dot",
        style: "pulse",
        z: Z.effect,
      };

      renderOverlays(mockCtx, [overlay], viewport, mockOutlineCache);

      // Should not call save/restore or draw anything for out-of-bounds dots
      expect(mockCtx.save).not.toHaveBeenCalled();
      expect(mockCtx.restore).not.toHaveBeenCalled();
      expect(mockCtx.fillRect).not.toHaveBeenCalled();
      expect(mockCtx.arc).not.toHaveBeenCalled();
    });

    it("should handle coordinates in vanish zone as out of bounds", () => {
      const overlay: RenderOverlay = {
        at: [createGridCoord(5), createGridCoord(-1)], // in vanish zone
        id: "dot-1",
        kind: "effect-dot",
        style: "pulse",
        z: Z.effect,
      };

      renderOverlays(mockCtx, [overlay], viewport, mockOutlineCache);

      // Effect dots don't render in vanish zone (negative y not allowed)
      expect(mockCtx.arc).not.toHaveBeenCalled();
    });

    it("should use default values for optional properties", () => {
      const overlay: RenderOverlay = {
        at: [createGridCoord(5), createGridCoord(10)],
        id: "dot-1",
        kind: "effect-dot",
        style: "fade",
        z: Z.effect,
      };

      renderOverlays(mockCtx, [overlay], viewport, mockOutlineCache);

      expect(mockCtx.fillStyle).toBe("#FFFF00"); // default color
    });
  });

  describe("column-highlight overlay", () => {
    it("should render column highlight with default values", () => {
      const overlay: RenderOverlay = {
        columns: [2, 3, 4],
        id: "column-1",
        kind: "column-highlight",
        z: Z.columnHighlight,
      };

      renderOverlays(mockCtx, [overlay], viewport, mockOutlineCache);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      expect(mockCtx.globalAlpha).toBe(0.08); // default intensity
      expect(mockCtx.fillStyle).toBe("#CCCCCC"); // default color
      expect(mockCtx.fillRect).toHaveBeenCalledTimes(3); // one for each column
    });

    it("should render column highlight with custom values", () => {
      const overlay: RenderOverlay = {
        color: "#FF0000",
        columns: [1, 8],
        id: "column-1",
        intensity: 0.15,
        kind: "column-highlight",
        z: Z.columnHighlight,
      };

      renderOverlays(mockCtx, [overlay], viewport, mockOutlineCache);

      expect(mockCtx.globalAlpha).toBe(0.15);
      expect(mockCtx.fillStyle).toBe("#FF0000");
      expect(mockCtx.fillRect).toHaveBeenCalledTimes(2);
    });

    it("should only render valid columns", () => {
      const overlay: RenderOverlay = {
        columns: [-1, 0, 9, 10, 15], // mix of valid and invalid
        id: "column-1",
        kind: "column-highlight",
        z: Z.columnHighlight,
      };

      renderOverlays(mockCtx, [overlay], viewport, mockOutlineCache);

      // Should only call fillRect for valid columns (0 and 9)
      expect(mockCtx.fillRect).toHaveBeenCalledTimes(2);
    });

    it("should handle empty columns array", () => {
      const overlay: RenderOverlay = {
        columns: [],
        id: "column-1",
        kind: "column-highlight",
        z: Z.columnHighlight,
      };

      renderOverlays(mockCtx, [overlay], viewport, mockOutlineCache);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      expect(mockCtx.fillRect).not.toHaveBeenCalled();
    });

    it("should position columns correctly with vanish offset", () => {
      const overlay: RenderOverlay = {
        columns: [5],
        id: "column-1",
        kind: "column-highlight",
        z: Z.columnHighlight,
      };

      renderOverlays(mockCtx, [overlay], viewport, mockOutlineCache);

      // Column 5 at x=150, vanish offset y=60, visible height=600
      expect(mockCtx.fillRect).toHaveBeenCalledWith(150, 60, 30, 600);
    });
  });

  describe("viewport edge cases", () => {
    it("should handle viewport with no vanish rows", () => {
      const noVanishViewport: BoardViewport = {
        cell: asCellSizePx(25),
        cols: asBoardCols(10),
        vanishRows: asVanishRows(0),
        visibleRows: asVisibleRows(20),
      };

      const overlay: RenderOverlay = {
        cells: [[createGridCoord(3), createGridCoord(5)]],
        id: "ghost-1",
        kind: "ghost",
        pieceId: "T",
        z: Z.ghost,
      };

      renderOverlays(mockCtx, [overlay], noVanishViewport, mockOutlineCache);

      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it("should handle small viewport dimensions", () => {
      const smallViewport: BoardViewport = {
        cell: asCellSizePx(15),
        cols: asBoardCols(5),
        vanishRows: asVanishRows(1),
        visibleRows: asVisibleRows(10),
      };

      const overlay: RenderOverlay = {
        id: "flash-1",
        kind: "line-flash",
        rows: [0, 9],
        z: Z.effect,
      };

      renderOverlays(mockCtx, [overlay], smallViewport, mockOutlineCache);

      expect(mockCtx.fillRect).toHaveBeenCalledTimes(2);
    });

    it("should handle large cell sizes", () => {
      const largeViewport: BoardViewport = {
        cell: asCellSizePx(50),
        cols: asBoardCols(10),
        vanishRows: asVanishRows(2),
        visibleRows: asVisibleRows(20),
      };

      const overlay: RenderOverlay = {
        at: [createGridCoord(2), createGridCoord(3)],
        id: "dot-1",
        kind: "effect-dot",
        style: "pulse",
        z: Z.effect,
      };

      renderOverlays(mockCtx, [overlay], largeViewport, mockOutlineCache);

      expect(mockCtx.arc).toHaveBeenCalled();
    });
  });

  describe("integration tests", () => {
    it("should render complex overlay combination", () => {
      const overlays: Array<RenderOverlay> = [
        {
          columns: [3, 4, 5],
          id: "col-1",
          kind: "column-highlight",
          z: Z.columnHighlight,
        },
        {
          cells: [
            [createGridCoord(3), createGridCoord(18)],
            [createGridCoord(4), createGridCoord(18)],
            [createGridCoord(5), createGridCoord(18)],
            [createGridCoord(4), createGridCoord(19)],
          ],
          id: "ghost-1",
          kind: "ghost",
          pieceId: "T",
          z: Z.ghost,
        },
        {
          cells: [
            [createGridCoord(3), createGridCoord(17)],
            [createGridCoord(4), createGridCoord(17)],
            [createGridCoord(5), createGridCoord(17)],
            [createGridCoord(4), createGridCoord(16)],
          ],
          color: "#00A2FF",
          id: "target-1",
          kind: "target",
          style: "outline",
          z: Z.target,
        },
        {
          at: [createGridCoord(4), createGridCoord(17)],
          color: "#FFFF00",
          id: "dot-1",
          kind: "effect-dot",
          style: "pulse",
          z: Z.effect,
        },
      ];

      renderOverlays(mockCtx, overlays, viewport, mockOutlineCache);

      // All overlays should be rendered
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      expect(mockCtx.fillRect).toHaveBeenCalled();
      expect(mockCtx.arc).toHaveBeenCalled();
      expect(mockOutlineCache.get).toHaveBeenCalled();
    });

    it("should maintain type safety with discriminated unions", () => {
      // This test ensures the exhaustive switch works correctly
      const validOverlays: Array<RenderOverlay> = [
        {
          cells: [[createGridCoord(0), createGridCoord(0)]],
          id: "g1",
          kind: "ghost",
          pieceId: "I",
          z: Z.ghost,
        },
        {
          cells: [[createGridCoord(1), createGridCoord(1)]],
          id: "t1",
          kind: "target",
          style: "glow",
          z: Z.target,
        },
        {
          id: "f1",
          kind: "line-flash",
          rows: [0],
          z: Z.effect,
        },
        {
          at: [createGridCoord(2), createGridCoord(2)],
          id: "d1",
          kind: "effect-dot",
          style: "fade",
          z: Z.effect,
        },
        {
          columns: [0],
          id: "c1",
          kind: "column-highlight",
          z: Z.columnHighlight,
        },
      ];

      expect(() => {
        renderOverlays(mockCtx, validOverlays, viewport, mockOutlineCache);
      }).not.toThrow();
    });

    it("should handle mixed boundary conditions", () => {
      const overlays: Array<RenderOverlay> = [
        {
          cells: [
            [createGridCoord(0), createGridCoord(-2)], // vanish zone
            [createGridCoord(9), createGridCoord(19)], // bottom-right corner
            [createGridCoord(-1), createGridCoord(0)], // out of bounds
          ],
          id: "ghost-1",
          kind: "ghost",
          pieceId: "I",
          z: Z.ghost,
        },
        {
          id: "flash-1",
          kind: "line-flash",
          rows: [-1, 0, 19, 20], // mix of valid/invalid
          z: Z.effect,
        },
        {
          columns: [-1, 0, 9, 10], // mix of valid/invalid
          id: "col-1",
          kind: "column-highlight",
          z: Z.columnHighlight,
        },
      ];

      expect(() => {
        renderOverlays(mockCtx, overlays, viewport, mockOutlineCache);
      }).not.toThrow();

      // Should still perform some drawing for valid cells/rows/columns
      expect(mockCtx.fillRect).toHaveBeenCalled();
    });
  });
});
