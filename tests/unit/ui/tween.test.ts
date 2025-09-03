import { describe, it, expect } from "@jest/globals";

import { createGridCoord } from "../../../src/types/brands";
import {
  advanceTween,
  verticalOffsetPx,
  isTweenActive,
} from "../../../src/ui/renderers/tween";
import {
  asCellSizePx,
  asBoardCols,
  asVisibleRows,
  asVanishRows,
  pixelYAsNumber,
} from "../../../src/ui/types/brands-render";

import type { ActivePiece } from "../../../src/state/types";
import type { TweenState } from "../../../src/ui/renderers/tween";
import type { BoardViewport } from "../../../src/ui/types/brands-render";

describe("tween renderer", () => {
  let viewport: BoardViewport;

  beforeEach(() => {
    viewport = {
      cell: asCellSizePx(30),
      cols: asBoardCols(10),
      vanishRows: asVanishRows(2),
      visibleRows: asVisibleRows(20),
    } as const;
  });

  describe("advanceTween", () => {
    it("should return idle state when both pieces are null", () => {
      const prevState: TweenState = { magnitude: 2, startTick: 100 };

      const result = advanceTween(null, null, 105, prevState);

      expect(result).toEqual({});
    });

    it("should return idle state when previous piece is null", () => {
      const next: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: createGridCoord(3),
        y: createGridCoord(5),
      };
      const prevState: TweenState = {};

      const result = advanceTween(null, next, 100, prevState);

      expect(result).toEqual({});
    });

    it("should return idle state when next piece is null", () => {
      const prev: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: createGridCoord(3),
        y: createGridCoord(5),
      };
      const prevState: TweenState = {};

      const result = advanceTween(prev, null, 100, prevState);

      expect(result).toEqual({});
    });

    it("should start new tween on downward movement of 1 cell", () => {
      const prev: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: createGridCoord(3),
        y: createGridCoord(5),
      };
      const next: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: createGridCoord(3),
        y: createGridCoord(6), // moved down 1
      };
      const prevState: TweenState = {};

      const result = advanceTween(prev, next, 100, prevState);

      expect(result).toEqual({
        magnitude: 1,
        startTick: 100,
      });
    });

    it("should start new tween on downward movement of 2 cells", () => {
      const prev: ActivePiece = {
        id: "I",
        rot: "spawn",
        x: createGridCoord(4),
        y: createGridCoord(3),
      };
      const next: ActivePiece = {
        id: "I",
        rot: "spawn",
        x: createGridCoord(4),
        y: createGridCoord(5), // moved down 2
      };
      const prevState: TweenState = {};

      const result = advanceTween(prev, next, 200, prevState);

      expect(result).toEqual({
        magnitude: 2,
        startTick: 200,
      });
    });

    it("should cap magnitude at 3 for large downward movements", () => {
      const prev: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: createGridCoord(5),
        y: createGridCoord(2),
      };
      const next: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: createGridCoord(5),
        y: createGridCoord(8), // moved down 6
      };
      const prevState: TweenState = {};

      const result = advanceTween(prev, next, 300, prevState);

      expect(result).toEqual({
        magnitude: 3,
        startTick: 300,
      });
    });

    it("should return previous state when no downward movement", () => {
      const prev: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: createGridCoord(3),
        y: createGridCoord(5),
      };
      const next: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: createGridCoord(3),
        y: createGridCoord(5), // same position
      };
      const prevState: TweenState = { magnitude: 1, startTick: 100 };

      const result = advanceTween(prev, next, 105, prevState);

      expect(result).toBe(prevState); // should return exact same reference
    });

    it("should return previous state on horizontal movement only", () => {
      const prev: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: createGridCoord(3),
        y: createGridCoord(5),
      };
      const next: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: createGridCoord(4), // moved right
        y: createGridCoord(5),
      };
      const prevState: TweenState = { magnitude: 2, startTick: 50 };

      const result = advanceTween(prev, next, 55, prevState);

      expect(result).toBe(prevState);
    });

    it("should return previous state on upward movement", () => {
      const prev: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: createGridCoord(3),
        y: createGridCoord(5),
      };
      const next: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: createGridCoord(3),
        y: createGridCoord(4), // moved up
      };
      const prevState: TweenState = {};

      const result = advanceTween(prev, next, 100, prevState);

      expect(result).toBe(prevState);
    });

    it("should handle different piece types and rotations", () => {
      const prev: ActivePiece = {
        id: "I",
        rot: "right",
        x: createGridCoord(4),
        y: createGridCoord(10),
      };
      const next: ActivePiece = {
        id: "I", // same piece, different rotation
        rot: "left",
        x: createGridCoord(4),
        y: createGridCoord(11), // moved down 1
      };
      const prevState: TweenState = {};

      const result = advanceTween(prev, next, 150, prevState);

      expect(result).toEqual({
        magnitude: 1,
        startTick: 150,
      });
    });

    it("should handle piece identity changes with downward movement", () => {
      const prev: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: createGridCoord(3),
        y: createGridCoord(5),
      };
      const next: ActivePiece = {
        id: "O", // different piece at lower position
        rot: "spawn",
        x: createGridCoord(3),
        y: createGridCoord(7), // moved down 2
      };
      const prevState: TweenState = {};

      const result = advanceTween(prev, next, 120, prevState);

      expect(result).toEqual({
        magnitude: 2,
        startTick: 120,
      });
    });

    it("should handle edge case with zero movement", () => {
      const prev: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: createGridCoord(3),
        y: createGridCoord(0),
      };
      const next: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: createGridCoord(3),
        y: createGridCoord(0), // dy = 0
      };
      const prevState: TweenState = { magnitude: 3, startTick: 80 };

      const result = advanceTween(prev, next, 85, prevState);

      expect(result).toBe(prevState);
    });
  });

  describe("verticalOffsetPx", () => {
    it("should return 0 offset when tween is idle", () => {
      const tween: TweenState = {}; // no startTick

      const offset = verticalOffsetPx(tween, 100, viewport);

      expect(pixelYAsNumber(offset)).toBe(0);
    });

    it("should return 0 offset when animation is finished", () => {
      const tween: TweenState = {
        magnitude: 1,
        startTick: 100,
      };
      const tick = 103; // 3 ticks elapsed (animation duration)

      const offset = verticalOffsetPx(tween, tick, viewport);

      expect(pixelYAsNumber(offset)).toBe(0);
    });

    it("should return 0 offset when animation is past finished", () => {
      const tween: TweenState = {
        magnitude: 2,
        startTick: 100,
      };
      const tick = 110; // way past animation duration

      const offset = verticalOffsetPx(tween, tick, viewport);

      expect(pixelYAsNumber(offset)).toBe(0);
    });

    it("should calculate offset at start of animation (t=0)", () => {
      const tween: TweenState = {
        magnitude: 1,
        startTick: 100,
      };
      const tick = 100; // elapsed = 0

      const offset = verticalOffsetPx(tween, tick, viewport);

      // At t=0, easeOutQuad = 0, so offset should be -cellSize * magnitude * 1 = -30
      expect(pixelYAsNumber(offset)).toBe(-30);
    });

    it("should calculate offset at middle of animation (t=0.5)", () => {
      const tween: TweenState = {
        magnitude: 1,
        startTick: 100,
      };
      const tick = 101.5; // elapsed = 1.5, t = 0.5

      // Note: In practice tick will be integer, but test the math
      const offset = verticalOffsetPx(tween, tick, viewport);

      // At t=0.5, easeOutQuad = 1 - 0.5^2 = 0.75, offset = -30 * (1 - 0.75) = -7.5 ≈ -8
      expect(Math.abs(pixelYAsNumber(offset))).toBeGreaterThan(0);
      expect(Math.abs(pixelYAsNumber(offset))).toBeLessThan(30);
    });

    it("should calculate offset near end of animation", () => {
      const tween: TweenState = {
        magnitude: 1,
        startTick: 100,
      };
      const tick = 102; // elapsed = 2, t = 2/3

      const offset = verticalOffsetPx(tween, tick, viewport);

      // Near end, offset should be close to 0 but still negative
      const offsetValue = pixelYAsNumber(offset);
      expect(offsetValue).toBeLessThanOrEqual(0);
      expect(Math.abs(offsetValue)).toBeLessThan(15); // less than half of -30
    });

    it("should handle magnitude of 2 cells", () => {
      const tween: TweenState = {
        magnitude: 2,
        startTick: 50,
      };
      const tick = 50; // start of animation

      const offset = verticalOffsetPx(tween, tick, viewport);

      // At start: offset = -30 * 2 * 1 = -60
      expect(pixelYAsNumber(offset)).toBe(-60);
    });

    it("should handle magnitude of 3 cells", () => {
      const tween: TweenState = {
        magnitude: 3,
        startTick: 200,
      };
      const tick = 200; // start of animation

      const offset = verticalOffsetPx(tween, tick, viewport);

      // At start: offset = -30 * 3 * 1 = -90
      expect(pixelYAsNumber(offset)).toBe(-90);
    });

    it("should handle missing magnitude (defaults to 1)", () => {
      const tween: TweenState = {
        startTick: 100,
        // magnitude undefined, should default to 1
      };
      const tick = 100;

      const offset = verticalOffsetPx(tween, tick, viewport);

      // Should behave like magnitude: 1
      expect(pixelYAsNumber(offset)).toBe(-30);
    });

    it("should quantize to integer pixels", () => {
      const tween: TweenState = {
        magnitude: 1,
        startTick: 100,
      };

      // Test multiple tick values to ensure all offsets are integers
      for (let elapsed = 0; elapsed < 3; elapsed++) {
        const tick = 100 + elapsed;
        const offset = verticalOffsetPx(tween, tick, viewport);
        const offsetValue = pixelYAsNumber(offset);

        expect(Number.isInteger(offsetValue)).toBe(true);
      }
    });

    it("should work with different cell sizes", () => {
      const smallViewport: BoardViewport = {
        cell: asCellSizePx(20), // smaller cells
        cols: asBoardCols(10),
        vanishRows: asVanishRows(2),
        visibleRows: asVisibleRows(20),
      };

      const tween: TweenState = {
        magnitude: 1,
        startTick: 100,
      };
      const tick = 100;

      const offset = verticalOffsetPx(tween, tick, smallViewport);

      // At start: offset = -20 * 1 * 1 = -20
      expect(pixelYAsNumber(offset)).toBe(-20);
    });

    it("should handle large cell sizes", () => {
      const largeViewport: BoardViewport = {
        cell: asCellSizePx(50), // larger cells
        cols: asBoardCols(10),
        vanishRows: asVanishRows(2),
        visibleRows: asVisibleRows(20),
      };

      const tween: TweenState = {
        magnitude: 2,
        startTick: 100,
      };
      const tick = 100;

      const offset = verticalOffsetPx(tween, tick, largeViewport);

      // At start: offset = -50 * 2 * 1 = -100
      expect(pixelYAsNumber(offset)).toBe(-100);
    });

    it("should use easeOutQuad easing function", () => {
      const tween: TweenState = {
        magnitude: 1,
        startTick: 100,
      };

      // Test that the easing produces expected progression
      const offsets = [];
      for (let elapsed = 0; elapsed < 3; elapsed++) {
        const tick = 100 + elapsed;
        const offset = verticalOffsetPx(tween, tick, viewport);
        offsets.push(Math.abs(pixelYAsNumber(offset)));
      }

      // With easeOutQuad, offset magnitude should decrease quickly then slowly
      // At start should be at maximum (-30), then decrease towards 0
      expect(offsets[0]).toBe(30); // t=0
      expect(offsets[1]).toBeDefined();
      expect(offsets[2]).toBeDefined();

      const offset1 = offsets[1];
      const offset2 = offsets[2];

      if (offset1 !== undefined && offset2 !== undefined) {
        expect(offset1).toBeGreaterThan(0); // t=1/3
        expect(offset1).toBeLessThan(30);
        expect(offset2).toBeGreaterThan(0); // t=2/3
        expect(offset2).toBeLessThan(offset1); // should be closer to 0
      }
    });
  });

  describe("isTweenActive", () => {
    it("should return false when tween is idle", () => {
      const tween: TweenState = {}; // no startTick

      const active = isTweenActive(tween, 100);

      expect(active).toBe(false);
    });

    it("should return true when animation is in progress", () => {
      const tween: TweenState = {
        magnitude: 1,
        startTick: 100,
      };

      // Test all ticks during animation duration
      expect(isTweenActive(tween, 100)).toBe(true); // elapsed = 0
      expect(isTweenActive(tween, 101)).toBe(true); // elapsed = 1
      expect(isTweenActive(tween, 102)).toBe(true); // elapsed = 2
    });

    it("should return false when animation is finished", () => {
      const tween: TweenState = {
        magnitude: 2,
        startTick: 100,
      };

      expect(isTweenActive(tween, 103)).toBe(false); // elapsed = 3 (duration)
      expect(isTweenActive(tween, 104)).toBe(false); // elapsed = 4 (past duration)
    });

    it("should return false for negative elapsed time", () => {
      const tween: TweenState = {
        magnitude: 1,
        startTick: 100,
      };

      expect(isTweenActive(tween, 99)).toBe(false); // elapsed = -1
    });

    it("should handle edge case at exact duration boundary", () => {
      const tween: TweenState = {
        magnitude: 3,
        startTick: 50,
      };

      expect(isTweenActive(tween, 52)).toBe(true); // elapsed = 2 (< 3)
      expect(isTweenActive(tween, 53)).toBe(false); // elapsed = 3 (>= 3)
    });

    it("should work regardless of magnitude", () => {
      const tween1: TweenState = { magnitude: 1, startTick: 100 };
      const tween2: TweenState = { magnitude: 2, startTick: 100 };
      const tween3: TweenState = { magnitude: 3, startTick: 100 };

      // All should have same active duration regardless of magnitude
      expect(isTweenActive(tween1, 101)).toBe(true);
      expect(isTweenActive(tween2, 101)).toBe(true);
      expect(isTweenActive(tween3, 101)).toBe(true);

      expect(isTweenActive(tween1, 103)).toBe(false);
      expect(isTweenActive(tween2, 103)).toBe(false);
      expect(isTweenActive(tween3, 103)).toBe(false);
    });

    it("should handle missing magnitude", () => {
      const tween: TweenState = {
        startTick: 100,
        // magnitude undefined
      };

      expect(isTweenActive(tween, 101)).toBe(true);
      expect(isTweenActive(tween, 103)).toBe(false);
    });
  });

  describe("integration tests", () => {
    it("should handle complete tween lifecycle", () => {
      // Start with idle state
      let tweenState: TweenState = {};
      expect(isTweenActive(tweenState, 100)).toBe(false);
      expect(pixelYAsNumber(verticalOffsetPx(tweenState, 100, viewport))).toBe(
        0,
      );

      // Piece moves down, should start tween
      const prev: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: createGridCoord(4),
        y: createGridCoord(5),
      };
      const next: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: createGridCoord(4),
        y: createGridCoord(6),
      };

      tweenState = advanceTween(prev, next, 100, tweenState);
      expect(tweenState).toEqual({ magnitude: 1, startTick: 100 });

      // During animation
      expect(isTweenActive(tweenState, 100)).toBe(true);
      expect(isTweenActive(tweenState, 101)).toBe(true);
      expect(isTweenActive(tweenState, 102)).toBe(true);
      expect(isTweenActive(tweenState, 103)).toBe(false);

      // Offsets should progress from full negative to zero
      const offset0 = pixelYAsNumber(
        verticalOffsetPx(tweenState, 100, viewport),
      );
      const offset1 = pixelYAsNumber(
        verticalOffsetPx(tweenState, 101, viewport),
      );
      const offset2 = pixelYAsNumber(
        verticalOffsetPx(tweenState, 102, viewport),
      );
      const offset3 = pixelYAsNumber(
        verticalOffsetPx(tweenState, 103, viewport),
      );

      expect(offset0).toBe(-30); // maximum negative offset
      expect(offset1).toBeLessThan(0);
      expect(offset1).toBeGreaterThan(-30);
      expect(offset2).toBeLessThan(0);
      expect(offset2).toBeGreaterThan(offset1); // closer to 0
      expect(offset3).toBe(0); // animation finished
    });

    it("should handle rapid consecutive movements", () => {
      let tweenState: TweenState = {};

      // First movement
      const piece1a: ActivePiece = {
        id: "I",
        rot: "spawn",
        x: createGridCoord(3),
        y: createGridCoord(1),
      };
      const piece1b: ActivePiece = {
        id: "I",
        rot: "spawn",
        x: createGridCoord(3),
        y: createGridCoord(2),
      };

      tweenState = advanceTween(piece1a, piece1b, 100, tweenState);
      expect(tweenState.startTick).toBe(100);
      expect(tweenState.magnitude).toBe(1);

      // Second movement before first animation completes
      const piece2: ActivePiece = {
        id: "I",
        rot: "spawn",
        x: createGridCoord(3),
        y: createGridCoord(4),
      }; // moved down 2 more

      tweenState = advanceTween(piece1b, piece2, 101, tweenState);
      expect(tweenState.startTick).toBe(101); // new animation starts
      expect(tweenState.magnitude).toBe(2);
    });

    it("should handle tween state with different viewport configurations", () => {
      const tween: TweenState = { magnitude: 2, startTick: 100 };

      const smallViewport: BoardViewport = {
        cell: asCellSizePx(25),
        cols: asBoardCols(8),
        vanishRows: asVanishRows(1),
        visibleRows: asVisibleRows(16),
      };

      const largeViewport: BoardViewport = {
        cell: asCellSizePx(40),
        cols: asBoardCols(12),
        vanishRows: asVanishRows(3),
        visibleRows: asVisibleRows(24),
      };

      const smallOffset = pixelYAsNumber(
        verticalOffsetPx(tween, 100, smallViewport),
      );
      const largeOffset = pixelYAsNumber(
        verticalOffsetPx(tween, 100, largeViewport),
      );

      expect(smallOffset).toBe(-50); // 25 * 2 * 1
      expect(largeOffset).toBe(-80); // 40 * 2 * 1

      // Tween activity should be viewport-independent
      expect(isTweenActive(tween, 101)).toBe(true);
      expect(isTweenActive(tween, 103)).toBe(false);
    });

    it("should handle boundary conditions gracefully", () => {
      // Test with extreme values
      const extremeTween: TweenState = { magnitude: 3, startTick: 0 };
      const extremeViewport: BoardViewport = {
        cell: asCellSizePx(1),
        cols: asBoardCols(1),
        vanishRows: asVanishRows(0),
        visibleRows: asVisibleRows(1),
      };

      expect(() => {
        const offset = verticalOffsetPx(extremeTween, 0, extremeViewport);
        expect(pixelYAsNumber(offset)).toBe(-3); // 1 * 3 * 1
        expect(isTweenActive(extremeTween, 0)).toBe(true);
        expect(isTweenActive(extremeTween, 3)).toBe(false);
      }).not.toThrow();
    });
  });
});
