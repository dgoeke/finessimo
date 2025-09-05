import { describe, it, expect, beforeEach } from "@jest/globals";

import {
  advanceTween,
  verticalOffsetPx,
  isTweenActive,
} from "@/ui/renderers/tween";
import { pixelYAsNumber } from "@/ui/types/brands-render";

import {
  createBoardViewport,
  createCellSizePx,
  createBoardCols,
  createVisibleRows,
  createVanishRows,
} from "../../../fixtures/brands-render";
import { createActivePiece } from "../../../fixtures/state";

import type { TweenState } from "@/ui/renderers/tween";

describe("ui/renderers/tween", () => {
  let viewport: ReturnType<typeof createBoardViewport>;

  beforeEach(() => {
    viewport = createBoardViewport({
      cell: createCellSizePx(30),
      cols: createBoardCols(10),
      vanishRows: createVanishRows(4),
      visibleRows: createVisibleRows(20),
    });
  });

  describe("advanceTween", () => {
    it("returns idle state when previous piece is null", () => {
      const next = createActivePiece({ id: "T", x: 5, y: 10 });
      const prevState: TweenState = {};

      const result = advanceTween(null, next, 100, prevState);

      expect(result).toEqual({});
    });

    it("returns idle state when next piece is null", () => {
      const prev = createActivePiece({ id: "T", x: 5, y: 10 });
      const prevState: TweenState = {};

      const result = advanceTween(prev, null, 100, prevState);

      expect(result).toEqual({});
    });

    it("returns idle state when both pieces are null", () => {
      const prevState: TweenState = {};

      const result = advanceTween(null, null, 100, prevState);

      expect(result).toEqual({});
    });

    it("starts new tween on single cell downward movement", () => {
      const prev = createActivePiece({ id: "T", x: 5, y: 10 });
      const next = createActivePiece({ id: "T", x: 5, y: 11 }); // Moved down 1 cell
      const prevState: TweenState = {};

      const result = advanceTween(prev, next, 100, prevState);

      expect(result).toEqual({
        magnitude: 1,
        startTick: 100,
      });
    });

    it("starts new tween on multi-cell downward movement", () => {
      const prev = createActivePiece({ id: "T", x: 5, y: 10 });
      const next = createActivePiece({ id: "T", x: 5, y: 12 }); // Moved down 2 cells
      const prevState: TweenState = {};

      const result = advanceTween(prev, next, 150, prevState);

      expect(result).toEqual({
        magnitude: 2,
        startTick: 150,
      });
    });

    it("caps tween magnitude at 3 cells", () => {
      const prev = createActivePiece({ id: "T", x: 5, y: 5 });
      const next = createActivePiece({ id: "T", x: 5, y: 10 }); // Moved down 5 cells
      const prevState: TweenState = {};

      const result = advanceTween(prev, next, 200, prevState);

      expect(result).toEqual({
        magnitude: 3, // Capped at 3
        startTick: 200,
      });
    });

    it("ignores horizontal movement", () => {
      const prev = createActivePiece({ id: "T", x: 5, y: 10 });
      const next = createActivePiece({ id: "T", x: 7, y: 10 }); // Moved right 2 cells
      const prevState: TweenState = {};

      const result = advanceTween(prev, next, 100, prevState);

      expect(result).toEqual(prevState); // Returns previous state unchanged
    });

    it("ignores upward movement", () => {
      const prev = createActivePiece({ id: "T", x: 5, y: 10 });
      const next = createActivePiece({ id: "T", x: 5, y: 8 }); // Moved up 2 cells
      const prevState: TweenState = {};

      const result = advanceTween(prev, next, 100, prevState);

      expect(result).toEqual(prevState); // Returns previous state unchanged
    });

    it("ignores no movement", () => {
      const prev = createActivePiece({ id: "T", x: 5, y: 10 });
      const next = createActivePiece({ id: "T", x: 5, y: 10 }); // No movement
      const prevState: TweenState = { magnitude: 1, startTick: 90 };

      const result = advanceTween(prev, next, 100, prevState);

      expect(result).toEqual(prevState); // Returns previous state unchanged
    });

    it("replaces existing tween with new movement", () => {
      const prev = createActivePiece({ id: "T", x: 5, y: 10 });
      const next = createActivePiece({ id: "T", x: 5, y: 13 }); // Moved down 3 cells
      const prevState: TweenState = { magnitude: 1, startTick: 90 };

      const result = advanceTween(prev, next, 100, prevState);

      expect(result).toEqual({
        magnitude: 3,
        startTick: 100,
      });
    });

    it("handles diagonal movement (only vertical component matters)", () => {
      const prev = createActivePiece({ id: "T", x: 5, y: 10 });
      const next = createActivePiece({ id: "T", x: 7, y: 12 }); // Moved right 2, down 2
      const prevState: TweenState = {};

      const result = advanceTween(prev, next, 100, prevState);

      expect(result).toEqual({
        magnitude: 2, // Only vertical movement counts
        startTick: 100,
      });
    });

    it("works with different piece types", () => {
      const prev = createActivePiece({ id: "I", x: 3, y: 5 });
      const next = createActivePiece({ id: "I", x: 3, y: 6 }); // Different piece type
      const prevState: TweenState = {};

      const result = advanceTween(prev, next, 100, prevState);

      expect(result).toEqual({
        magnitude: 1,
        startTick: 100,
      });
    });
  });

  describe("verticalOffsetPx", () => {
    it("returns zero offset for idle tween", () => {
      const tween: TweenState = {}; // No startTick

      const result = verticalOffsetPx(tween, 100, viewport);

      expect(pixelYAsNumber(result)).toBe(0);
    });

    it("returns zero offset when animation is finished", () => {
      const tween: TweenState = { magnitude: 1, startTick: 100 };
      const currentTick = 103; // 3 ticks elapsed (duration = 3)

      const result = verticalOffsetPx(tween, currentTick, viewport);

      expect(pixelYAsNumber(result)).toBe(0);
    });

    it("returns zero offset when animation is past finished", () => {
      const tween: TweenState = { magnitude: 1, startTick: 100 };
      const currentTick = 110; // Way past finished

      const result = verticalOffsetPx(tween, currentTick, viewport);

      expect(pixelYAsNumber(result)).toBe(0);
    });

    it("calculates offset at animation start", () => {
      const tween: TweenState = { magnitude: 1, startTick: 100 };
      const currentTick = 100; // t = 0, easeOutQuad = 0

      const result = verticalOffsetPx(tween, currentTick, viewport);

      // At t=0: rawOffset = -30 * 1 * (1 - 0) = -30
      expect(pixelYAsNumber(result)).toBe(-30);
    });

    it("calculates offset at animation middle", () => {
      const tween: TweenState = { magnitude: 1, startTick: 100 };
      const currentTick = 101; // t = 1/3, easeOutQuad = 1 - (2/3)^2 = 1 - 4/9 = 5/9

      const result = verticalOffsetPx(tween, currentTick, viewport);

      // At t=1/3: easeOutQuad = 5/9, rawOffset = -30 * 1 * (1 - 5/9) = -30 * 4/9 ≈ -13.33
      expect(pixelYAsNumber(result)).toBe(-13); // Rounded to nearest integer
    });

    it("calculates offset at animation end", () => {
      const tween: TweenState = { magnitude: 1, startTick: 100 };
      const currentTick = 102; // t = 2/3, easeOutQuad = 1 - (1/3)^2 = 1 - 1/9 = 8/9

      const result = verticalOffsetPx(tween, currentTick, viewport);

      // At t=2/3: easeOutQuad = 8/9, rawOffset = -30 * 1 * (1 - 8/9) = -30 * 1/9 ≈ -3.33
      expect(pixelYAsNumber(result)).toBe(-3); // Rounded to nearest integer
    });

    it("handles magnitude of 2 cells", () => {
      const tween: TweenState = { magnitude: 2, startTick: 100 };
      const currentTick = 100; // t = 0

      const result = verticalOffsetPx(tween, currentTick, viewport);

      // At t=0: rawOffset = -30 * 2 * (1 - 0) = -60
      expect(pixelYAsNumber(result)).toBe(-60);
    });

    it("handles magnitude of 3 cells", () => {
      const tween: TweenState = { magnitude: 3, startTick: 100 };
      const currentTick = 100; // t = 0

      const result = verticalOffsetPx(tween, currentTick, viewport);

      // At t=0: rawOffset = -30 * 3 * (1 - 0) = -90
      expect(pixelYAsNumber(result)).toBe(-90);
    });

    it("defaults to magnitude 1 when magnitude is undefined", () => {
      const tween: TweenState = { startTick: 100 }; // No magnitude specified
      const currentTick = 100; // t = 0

      const result = verticalOffsetPx(tween, currentTick, viewport);

      // Should use magnitude = 1: rawOffset = -30 * 1 * (1 - 0) = -30
      expect(pixelYAsNumber(result)).toBe(-30);
    });

    it("works with different cell sizes", () => {
      const largerViewport = createBoardViewport({
        cell: createCellSizePx(40), // Larger cells
        cols: createBoardCols(10),
        vanishRows: createVanishRows(4),
        visibleRows: createVisibleRows(20),
      });

      const tween: TweenState = { magnitude: 1, startTick: 100 };
      const currentTick = 100; // t = 0

      const result = verticalOffsetPx(tween, currentTick, largerViewport);

      // At t=0: rawOffset = -40 * 1 * (1 - 0) = -40
      expect(pixelYAsNumber(result)).toBe(-40);
    });

    it("quantizes to integer pixels", () => {
      const tween: TweenState = { magnitude: 1, startTick: 100 };
      const currentTick = 101; // This should produce a fractional offset

      const result = verticalOffsetPx(tween, currentTick, viewport);

      // Result should be an integer (no fractional pixels)
      expect(Number.isInteger(pixelYAsNumber(result))).toBe(true);
    });

    it("produces smooth easing curve progression", () => {
      const tween: TweenState = { magnitude: 1, startTick: 100 };

      const offsets = [
        verticalOffsetPx(tween, 100, viewport), // t = 0
        verticalOffsetPx(tween, 101, viewport), // t = 1/3
        verticalOffsetPx(tween, 102, viewport), // t = 2/3
      ];

      const values = offsets.map(pixelYAsNumber);

      // Offsets should be negative and decreasing in magnitude (approaching 0)
      expect(values[0]).toBe(-30); // Start at full offset
      expect(values[1]).toBe(-13); // Partially eased
      expect(values[2]).toBe(-3); // Almost complete

      // Each step should be smaller than the previous (easeOut behavior)
      const step1 = Math.abs((values[1] ?? 0) - (values[0] ?? 0)); // 17
      const step2 = Math.abs((values[2] ?? 0) - (values[1] ?? 0)); // 10
      expect(step1).toBeGreaterThan(step2); // Decelerating
    });
  });

  describe("isTweenActive", () => {
    it("returns false for idle tween", () => {
      const tween: TweenState = {}; // No startTick

      const result = isTweenActive(tween, 100);

      expect(result).toBe(false);
    });

    it("returns true at animation start", () => {
      const tween: TweenState = { magnitude: 1, startTick: 100 };
      const currentTick = 100;

      const result = isTweenActive(tween, currentTick);

      expect(result).toBe(true);
    });

    it("returns true during animation", () => {
      const tween: TweenState = { magnitude: 1, startTick: 100 };
      const currentTick = 101; // 1 tick elapsed

      const result = isTweenActive(tween, currentTick);

      expect(result).toBe(true);
    });

    it("returns true at last animation tick", () => {
      const tween: TweenState = { magnitude: 1, startTick: 100 };
      const currentTick = 102; // 2 ticks elapsed (last tick of 3-tick duration)

      const result = isTweenActive(tween, currentTick);

      expect(result).toBe(true);
    });

    it("returns false when animation is finished", () => {
      const tween: TweenState = { magnitude: 1, startTick: 100 };
      const currentTick = 103; // 3 ticks elapsed (duration is 3)

      const result = isTweenActive(tween, currentTick);

      expect(result).toBe(false);
    });

    it("returns false when animation is past finished", () => {
      const tween: TweenState = { magnitude: 1, startTick: 100 };
      const currentTick = 110; // Way past finished

      const result = isTweenActive(tween, currentTick);

      expect(result).toBe(false);
    });

    it("returns false for tick before animation start", () => {
      const tween: TweenState = { magnitude: 1, startTick: 100 };
      const currentTick = 99; // Before animation starts

      const result = isTweenActive(tween, currentTick);

      expect(result).toBe(false);
    });

    it("works regardless of magnitude", () => {
      const tween3: TweenState = { magnitude: 3, startTick: 100 };
      const tween1: TweenState = { magnitude: 1, startTick: 100 };
      const currentTick = 101;

      // Animation activity should not depend on magnitude
      expect(isTweenActive(tween3, currentTick)).toBe(true);
      expect(isTweenActive(tween1, currentTick)).toBe(true);
    });

    it("handles edge case of exactly 3 ticks duration", () => {
      const tween: TweenState = { magnitude: 1, startTick: 100 };

      // Test exact boundary conditions
      expect(isTweenActive(tween, 99)).toBe(false); // -1 tick
      expect(isTweenActive(tween, 100)).toBe(true); // 0 ticks (start)
      expect(isTweenActive(tween, 101)).toBe(true); // 1 tick
      expect(isTweenActive(tween, 102)).toBe(true); // 2 ticks (last active)
      expect(isTweenActive(tween, 103)).toBe(false); // 3 ticks (finished)
      expect(isTweenActive(tween, 104)).toBe(false); // 4 ticks
    });
  });

  describe("integration scenarios", () => {
    it("handles complete tween lifecycle", () => {
      // Start with no tween
      let tweenState: TweenState = {};

      // Piece moves down
      const prev = createActivePiece({ id: "T", x: 5, y: 10 });
      const next = createActivePiece({ id: "T", x: 5, y: 11 });

      // Advance tween
      tweenState = advanceTween(prev, next, 100, tweenState);
      expect(tweenState).toEqual({ magnitude: 1, startTick: 100 });

      // Check animation at various stages
      expect(isTweenActive(tweenState, 100)).toBe(true);
      expect(isTweenActive(tweenState, 101)).toBe(true);
      expect(isTweenActive(tweenState, 102)).toBe(true);
      expect(isTweenActive(tweenState, 103)).toBe(false);

      // Check offsets at various stages
      expect(pixelYAsNumber(verticalOffsetPx(tweenState, 100, viewport))).toBe(
        -30,
      );
      expect(pixelYAsNumber(verticalOffsetPx(tweenState, 103, viewport))).toBe(
        0,
      );
    });

    it("handles overlapping movements", () => {
      let tweenState: TweenState = {};

      // First movement
      const piece1 = createActivePiece({ id: "T", x: 5, y: 10 });
      const piece2 = createActivePiece({ id: "T", x: 5, y: 11 });
      tweenState = advanceTween(piece1, piece2, 100, tweenState);

      // Second movement before first animation finishes
      const piece3 = createActivePiece({ id: "T", x: 5, y: 13 }); // Down 2 more
      tweenState = advanceTween(piece2, piece3, 101, tweenState);

      // New tween should replace the old one
      expect(tweenState).toEqual({ magnitude: 2, startTick: 101 });
      expect(isTweenActive(tweenState, 101)).toBe(true);
    });

    it("handles piece removal during animation", () => {
      let tweenState: TweenState = { magnitude: 1, startTick: 100 };

      // Piece gets removed (next becomes null)
      const prev = createActivePiece({ id: "T", x: 5, y: 10 });
      tweenState = advanceTween(prev, null, 101, tweenState);

      // Tween should be reset
      expect(tweenState).toEqual({});
      expect(isTweenActive(tweenState, 101)).toBe(false);
    });

    it("handles rapid consecutive movements", () => {
      let tweenState: TweenState = {};

      let currentPiece = createActivePiece({ id: "T", x: 5, y: 5 });

      // Rapid downward movements
      for (let tick = 100; tick < 105; tick++) {
        const nextPiece = createActivePiece({
          id: "T",
          x: 5,
          y: currentPiece.y + 1,
        });
        tweenState = advanceTween(currentPiece, nextPiece, tick, tweenState);
        currentPiece = nextPiece;
      }

      // Should have the latest tween state
      expect(tweenState.startTick).toBe(104);
      expect(tweenState.magnitude).toBe(1);
    });
  });
});
