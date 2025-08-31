import type { PieceId } from "../../state/types";
import type { GridCoord } from "../../types/brands";

/**
 * UI Overlay Type System - Strongly typed declarative overlays for unified rendering
 *
 * This system unifies all board visual overlays into a discriminated union that separates:
 * - Derived overlays (frame-based, pure, computed from state)
 * - Ephemeral effects (event-based, TTL-managed, from UI effects system)
 *
 * The game board component renders overlays in z-order without knowing their origin.
 */

// Z-order layering policy - higher numbers render on top
export const Z = {
  board: 0,
  columnHighlight: 0.5, // Behind everything including grid
  cursor: 5,
  effect: 4,
  ghost: 2,
  placed: 1,
  target: 3,
} as const;

export type ZIndex = (typeof Z)[keyof typeof Z];

/**
 * Ghost piece overlay - renders a translucent preview of where the active piece would land
 */
export type GhostOverlay = Readonly<{
  kind: "ghost";
  id: string; // Stable identifier for keyed rendering
  z: typeof Z.ghost;
  cells: ReadonlyArray<readonly [GridCoord, GridCoord]>; // Array of [x, y] coordinate tuples
  pieceId: PieceId;
  opacity?: number; // 0..1, defaults to 0.35
}>;

/**
 * Target overlay - highlights cells for guided training or mode-specific targets
 */
export type TargetOverlay = Readonly<{
  kind: "target";
  id: string; // Stable identifier for keyed rendering
  z: typeof Z.target;
  cells: ReadonlyArray<readonly [GridCoord, GridCoord]>; // Array of [x, y] coordinate tuples
  style: "glow" | "outline" | "dashed" | "hint";
  color?: string; // hex color, defaults to mode-appropriate color
  alpha?: number; // 0..1, defaults to 0.25
}>;

/**
 * Line flash overlay - animates row clearing effects
 */
export type LineFlashOverlay = Readonly<{
  kind: "line-flash";
  id: string; // Stable identifier for keyed rendering
  z: typeof Z.effect;
  rows: ReadonlyArray<number>; // 0-based row indices
  color?: string; // hex color, defaults to white
  intensity?: number; // 0..1, flash intensity
}>;

/**
 * Effect dot overlay - renders point effects for finesse feedback, scoring, etc.
 */
export type EffectDotOverlay = Readonly<{
  kind: "effect-dot";
  id: string; // Stable identifier for keyed rendering
  z: typeof Z.effect;
  at: readonly [GridCoord, GridCoord]; // single [x, y] coordinate tuple
  style: "pulse" | "sparkle" | "fade";
  color?: string; // hex color, defaults to yellow
  size?: number; // relative size multiplier, defaults to 1.0
}>;

/**
 * Column highlight overlay - highlights columns occupied by the active piece in guided mode
 */
export type ColumnHighlightOverlay = Readonly<{
  kind: "column-highlight";
  id: string; // Stable identifier for keyed rendering
  z: typeof Z.columnHighlight;
  columns: ReadonlyArray<number>; // 0-based column indices
  color?: string; // hex color, defaults to light grey
  intensity?: number; // 0..1, defaults to 0.12
}>;

/**
 * Unified overlay discriminated union - all possible overlay types
 *
 * This union enables:
 * - Exhaustive switch handling in renderers
 * - Type-safe overlay processing
 * - Z-order sorting across all overlay types
 * - Mixed overlay sources (selectors + effects)
 */
export type RenderOverlay =
  | GhostOverlay
  | TargetOverlay
  | LineFlashOverlay
  | EffectDotOverlay
  | ColumnHighlightOverlay;

/**
 * Type guard to validate overlay z-ordering
 */
export function hasValidZOrder(overlay: RenderOverlay): boolean {
  return Object.values(Z).includes(overlay.z);
}

/**
 * Sort overlays by z-order for correct rendering layering
 */
export function sortOverlaysByZOrder(
  overlays: ReadonlyArray<RenderOverlay>,
): ReadonlyArray<RenderOverlay> {
  return [...overlays].sort((a, b) => a.z - b.z);
}
