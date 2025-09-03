/**
 * Pure tween state management for smooth piece animations.
 *
 * Provides immutable state management for vertical piece tweening during
 * soft-drop and gravity movements. All functions are pure and side-effect free.
 *
 * Note: Uses `null` for missing pieces instead of `undefined` to avoid the complex
 * `ActivePiece | null | undefined` unions that arise from GameState's mixed usage.
 * UI boundaries convert `undefined` to `null` before calling these functions.
 */

import { gridCoordAsNumber } from "../../types/brands";
import { asPixelY, cellSizePxAsNumber } from "../types/brands-render";

import type { ActivePiece } from "../../state/types";
import type { BoardViewport, PixelY } from "../types/brands-render";

/**
 * Immutable tween state for vertical piece animations.
 *
 * When startTick is undefined, the tween is idle (no animation).
 * When startTick is defined, magnitude indicates the number of cells to animate.
 */
export type TweenState = Readonly<{
  startTick?: number; // undefined when idle
  magnitude?: 1 | 2 | 3; // cells to animate, capped at 3
}>;

/**
 * Duration of tween animation in ticks (60Hz).
 * 3 ticks = ~50ms for smooth but quick animations.
 */
const TWEEN_DURATION_TICKS = 3;

/**
 * Advances tween state based on piece movement detection.
 *
 * Starts a new tween when detecting downward movement (dy >= 1).
 * Returns idle state when no relevant movement is detected.
 *
 * @param prev - Previous active piece position (null if no piece)
 * @param next - Current active piece position (null if no piece)
 * @param tick - Current game tick
 * @param prevState - Previous tween state
 * @returns New tween state (immutable)
 */
export const advanceTween = (
  prev: ActivePiece | null,
  next: ActivePiece | null,
  tick: number,
  prevState: TweenState,
): TweenState => {
  // Reset tween if either piece is missing
  if (!prev || !next) {
    return {};
  }

  // Calculate vertical movement
  const dy = gridCoordAsNumber(next.y) - gridCoordAsNumber(prev.y);

  // Only tween on downward movement of 1 or more cells
  if (dy >= 1) {
    return {
      magnitude: Math.min(dy, 3) as 1 | 2 | 3, // Cap at 3 cells
      startTick: tick,
    };
  }

  // Return previous state if no downward movement
  return prevState;
};

/**
 * Calculates vertical pixel offset for active piece rendering.
 *
 * Uses easeOutQuad easing for smooth deceleration and quantizes
 * to integer pixels to prevent visual shimmer.
 *
 * @param tween - Current tween state
 * @param tick - Current game tick
 * @param viewport - Viewport configuration for cell size
 * @returns Vertical offset in pixels (negative = upward offset)
 */
export const verticalOffsetPx = (
  tween: TweenState,
  tick: number,
  viewport: BoardViewport,
): PixelY => {
  // No animation when idle
  if (tween.startTick === undefined) {
    return asPixelY(0);
  }

  const elapsed = tick - tween.startTick;

  // Animation finished - return to idle
  if (elapsed >= TWEEN_DURATION_TICKS) {
    return asPixelY(0);
  }

  // Calculate eased progress (0 to 1)
  const t = elapsed / TWEEN_DURATION_TICKS;
  const easeOutQuad = 1 - (1 - t) * (1 - t);

  // Calculate pixel offset
  const magnitude = tween.magnitude ?? 1;
  const cellSize = cellSizePxAsNumber(viewport.cell);
  const rawOffset = -cellSize * magnitude * (1 - easeOutQuad);

  // Quantize to integer pixels to prevent shimmer
  return asPixelY(Math.round(rawOffset));
};

/**
 * Checks if a tween is currently active (animating).
 *
 * @param tween - Tween state to check
 * @param tick - Current game tick
 * @returns true if animation is in progress
 */
export const isTweenActive = (tween: TweenState, tick: number): boolean => {
  if (tween.startTick === undefined) {
    return false;
  }

  const elapsed = tick - tween.startTick;
  return elapsed >= 0 && elapsed < TWEEN_DURATION_TICKS;
};
