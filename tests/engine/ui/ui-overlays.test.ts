import { describe, it, expect } from "@jest/globals";

import {
  Z,
  hasValidZOrder,
  sortOverlaysByZOrder,
} from "../../../src/engine/ui/overlays";
import { createGridCoord } from "../../../src/types/brands";

import type {
  RenderOverlay,
  GhostOverlay,
  TargetOverlay,
  LineFlashOverlay,
  EffectDotOverlay,
  ColumnHighlightOverlay,
} from "../../../src/engine/ui/overlays";

describe("ui/overlays.ts", () => {
  describe("Z-order constants", () => {
    it("should define correct z-order hierarchy", () => {
      expect(Z.board).toBe(0);
      expect(Z.columnHighlight).toBe(0.5);
      expect(Z.placed).toBe(1);
      expect(Z.ghost).toBe(2);
      expect(Z.target).toBe(3);
      expect(Z.effect).toBe(4);
      expect(Z.cursor).toBe(5);
    });

    it("should maintain proper layering order", () => {
      // Column highlights should be behind everything
      expect(Z.columnHighlight).toBeLessThan(Z.placed);
      expect(Z.columnHighlight).toBeLessThan(Z.ghost);
      expect(Z.columnHighlight).toBeLessThan(Z.target);
      expect(Z.columnHighlight).toBeLessThan(Z.effect);

      // Ghost should be behind targets and effects
      expect(Z.ghost).toBeLessThan(Z.target);
      expect(Z.ghost).toBeLessThan(Z.effect);

      // Targets should be behind effects
      expect(Z.target).toBeLessThan(Z.effect);

      // Effects should be behind cursor
      expect(Z.effect).toBeLessThan(Z.cursor);
    });
  });

  describe("hasValidZOrder", () => {
    it("should validate overlays with correct z-order", () => {
      const ghostOverlay: GhostOverlay = {
        cells: [[createGridCoord(0), createGridCoord(0)]],
        id: "ghost-test",
        kind: "ghost",
        pieceId: "T",
        z: Z.ghost,
      };

      expect(hasValidZOrder(ghostOverlay)).toBe(true);
    });

    it("should reject overlays with invalid z-order", () => {
      const invalidOverlay = {
        cells: [[createGridCoord(0), createGridCoord(0)]],
        id: "ghost-test",
        kind: "ghost",
        pieceId: "T",
        z: 999, // Invalid z-order
      } as unknown as GhostOverlay;

      expect(hasValidZOrder(invalidOverlay)).toBe(false);
    });

    it("should validate all overlay types", () => {
      const targetOverlay: TargetOverlay = {
        cells: [[createGridCoord(1), createGridCoord(1)]],
        id: "target-test",
        kind: "target",
        style: "outline",
        z: Z.target,
      };

      const lineFlashOverlay: LineFlashOverlay = {
        id: "line-flash-test",
        kind: "line-flash",
        rows: [19],
        z: Z.effect,
      };

      const effectDotOverlay: EffectDotOverlay = {
        at: [createGridCoord(5), createGridCoord(10)],
        id: "effect-dot-test",
        kind: "effect-dot",
        style: "pulse",
        z: Z.effect,
      };

      const columnHighlightOverlay: ColumnHighlightOverlay = {
        columns: [3, 4, 5],
        id: "column-highlight-test",
        kind: "column-highlight",
        z: Z.columnHighlight,
      };

      expect(hasValidZOrder(targetOverlay)).toBe(true);
      expect(hasValidZOrder(lineFlashOverlay)).toBe(true);
      expect(hasValidZOrder(effectDotOverlay)).toBe(true);
      expect(hasValidZOrder(columnHighlightOverlay)).toBe(true);
    });
  });

  describe("sortOverlaysByZOrder", () => {
    it("should sort overlays in ascending z-order", () => {
      const overlays: Array<RenderOverlay> = [
        {
          at: [createGridCoord(0), createGridCoord(0)],
          id: "effect-1",
          kind: "effect-dot",
          style: "pulse",
          z: Z.effect, // 4
        },
        {
          cells: [[createGridCoord(1), createGridCoord(1)]],
          id: "ghost-1",
          kind: "ghost",
          pieceId: "I",
          z: Z.ghost, // 2
        },
        {
          columns: [2, 3],
          id: "column-1",
          kind: "column-highlight",
          z: Z.columnHighlight, // 0.5
        },
        {
          cells: [[createGridCoord(2), createGridCoord(2)]],
          id: "target-1",
          kind: "target",
          style: "outline",
          z: Z.target, // 3
        },
      ];

      const sorted = sortOverlaysByZOrder(overlays);

      expect(sorted).toHaveLength(4);
      expect(sorted[0]?.kind).toBe("column-highlight"); // z: 0.5
      expect(sorted[1]?.kind).toBe("ghost"); // z: 2
      expect(sorted[2]?.kind).toBe("target"); // z: 3
      expect(sorted[3]?.kind).toBe("effect-dot"); // z: 4
    });

    it("should handle empty overlay array", () => {
      const sorted = sortOverlaysByZOrder([]);
      expect(sorted).toEqual([]);
    });

    it("should handle single overlay", () => {
      const overlay: TargetOverlay = {
        cells: [[createGridCoord(0), createGridCoord(0)]],
        id: "single-target",
        kind: "target",
        style: "glow",
        z: Z.target,
      };

      const sorted = sortOverlaysByZOrder([overlay]);
      expect(sorted).toHaveLength(1);
      expect(sorted[0]).toEqual(overlay);
    });

    it("should maintain stable sort for same z-order", () => {
      const overlay1: EffectDotOverlay = {
        at: [createGridCoord(0), createGridCoord(0)],
        id: "effect-1",
        kind: "effect-dot",
        style: "pulse",
        z: Z.effect,
      };

      const overlay2: LineFlashOverlay = {
        id: "line-flash-1",
        kind: "line-flash",
        rows: [18],
        z: Z.effect, // Same z-order
      };

      const sorted = sortOverlaysByZOrder([overlay1, overlay2]);

      expect(sorted).toHaveLength(2);
      // Both should maintain their relative order since z-order is the same
      expect(sorted[0]?.id).toBe("effect-1");
      expect(sorted[1]?.id).toBe("line-flash-1");
    });

    it("should not mutate original array", () => {
      const overlays: Array<RenderOverlay> = [
        {
          cells: [[createGridCoord(0), createGridCoord(0)]],
          id: "target-1",
          kind: "target",
          style: "outline",
          z: Z.target,
        },
        {
          cells: [[createGridCoord(1), createGridCoord(1)]],
          id: "ghost-1",
          kind: "ghost",
          pieceId: "T",
          z: Z.ghost,
        },
      ];

      const originalOrder = overlays.map((o) => o.id);
      const sorted = sortOverlaysByZOrder(overlays);

      // Original array should be unchanged
      expect(overlays.map((o) => o.id)).toEqual(originalOrder);

      // Sorted should be different if z-orders differ
      expect(sorted.map((o) => o.id)).not.toEqual(originalOrder);
    });

    it("should handle mixed z-order values correctly", () => {
      const overlays: Array<RenderOverlay> = [
        {
          at: [createGridCoord(0), createGridCoord(0)],
          id: "effect-high",
          kind: "effect-dot",
          style: "fade",
          z: 4, // Use valid Z.effect value
        } as unknown as RenderOverlay,
        {
          columns: [0],
          id: "column-low",
          kind: "column-highlight",
          z: 0.5, // Use valid Z.columnHighlight value
        } as unknown as RenderOverlay,
        {
          cells: [[createGridCoord(1), createGridCoord(1)]],
          id: "ghost-mid",
          kind: "ghost",
          pieceId: "S",
          z: Z.ghost,
        },
      ];

      const sorted = sortOverlaysByZOrder(overlays);

      expect(sorted[0]?.id).toBe("column-low"); // z: 0
      expect(sorted[1]?.id).toBe("ghost-mid"); // z: 2
      expect(sorted[2]?.id).toBe("effect-high"); // z: 10
    });
  });

  describe("overlay type structure", () => {
    it("should support all required ghost overlay properties", () => {
      const ghost: GhostOverlay = {
        cells: [
          [createGridCoord(3), createGridCoord(4)],
          [createGridCoord(4), createGridCoord(4)],
        ],
        id: "ghost-structure-test",
        kind: "ghost",
        opacity: 0.7, // Optional
        pieceId: "Z",
        z: Z.ghost,
      };

      expect(ghost.kind).toBe("ghost");
      expect(ghost.z).toBe(Z.ghost);
      expect(ghost.cells).toHaveLength(2);
      expect(ghost.pieceId).toBe("Z");
      expect(ghost.opacity).toBe(0.7);
    });

    it("should support all required target overlay properties", () => {
      const target: TargetOverlay = {
        alpha: 0.5, // Optional
        cells: [[createGridCoord(1), createGridCoord(18)]],
        color: "#FF0000", // Optional
        id: "target-structure-test",
        kind: "target",
        style: "dashed",
        z: Z.target,
      };

      expect(target.kind).toBe("target");
      expect(target.style).toBe("dashed");
      expect(target.color).toBe("#FF0000");
      expect(target.alpha).toBe(0.5);
    });

    it("should support all required line flash overlay properties", () => {
      const lineFlash: LineFlashOverlay = {
        color: "#FFFFFF", // Optional
        id: "line-flash-structure-test",
        intensity: 0.9, // Optional
        kind: "line-flash",
        rows: [17, 18, 19],
        z: Z.effect,
      };

      expect(lineFlash.kind).toBe("line-flash");
      expect(lineFlash.rows).toEqual([17, 18, 19]);
      expect(lineFlash.color).toBe("#FFFFFF");
      expect(lineFlash.intensity).toBe(0.9);
    });

    it("should support all required effect dot overlay properties", () => {
      const effectDot: EffectDotOverlay = {
        at: [createGridCoord(7), createGridCoord(12)],
        color: "#FFFF00", // Optional
        id: "effect-dot-structure-test",
        kind: "effect-dot",
        size: 1.5, // Optional
        style: "sparkle",
        z: Z.effect,
      };

      expect(effectDot.kind).toBe("effect-dot");
      expect(effectDot.at).toEqual([createGridCoord(7), createGridCoord(12)]);
      expect(effectDot.style).toBe("sparkle");
      expect(effectDot.color).toBe("#FFFF00");
      expect(effectDot.size).toBe(1.5);
    });

    it("should support all required column highlight overlay properties", () => {
      const columnHighlight: ColumnHighlightOverlay = {
        color: "#CCCCCC", // Optional
        columns: [2, 3, 4, 5],
        id: "column-highlight-structure-test",
        intensity: 0.15, // Optional
        kind: "column-highlight",
        z: Z.columnHighlight,
      };

      expect(columnHighlight.kind).toBe("column-highlight");
      expect(columnHighlight.columns).toEqual([2, 3, 4, 5]);
      expect(columnHighlight.color).toBe("#CCCCCC");
      expect(columnHighlight.intensity).toBe(0.15);
    });
  });
});
