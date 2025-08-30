import { calculateGhostPosition } from "../../core/board";
import { isPlaying } from "../../state/types";
import { gridCoordAsNumber } from "../../types/brands";
import { cellsForActivePiece } from "../util/cell-projection";

import type { ExtendedModeData } from "../../modes/types";
import type { GameState } from "../../state/types";
import type { GridCoord } from "../../types/brands";
import type {
  GhostOverlay,
  RenderOverlay,
  TargetOverlay,
  Z,
} from "../ui/overlays";

/**
 * Pure selectors for frame-based overlay data derived from game state.
 *
 * These selectors transform game state into declarative overlay definitions
 * for unified rendering. All functions are pure with no side effects.
 */

/**
 * Selects ghost overlay data from active piece position.
 * Returns null if no active piece, ghost disabled, or ghost position same as active.
 */
export function selectGhostOverlay(s: GameState): GhostOverlay | null {
  // Ghost only renders during playing state
  if (!isPlaying(s)) return null;

  // Check if ghost is enabled and active piece exists
  const ghostEnabled = s.gameplay.ghostPieceEnabled ?? true;
  if (!ghostEnabled || !s.active) return null;

  // Calculate ghost position
  const ghostPosition = calculateGhostPosition(s.board, s.active);

  // Only render ghost if it differs from active piece position
  if (gridCoordAsNumber(ghostPosition.y) === gridCoordAsNumber(s.active.y)) {
    return null;
  }

  // Use cell projection utility to get coordinate tuples
  const ghostCells = cellsForActivePiece(ghostPosition);

  return {
    cells: ghostCells,
    kind: "ghost",
    opacity: 0.35,
    pieceId: ghostPosition.id,
    z: 2 satisfies typeof Z.ghost,
  } as const;
}

/**
 * Selects target overlay data from mode adapter data and legacy board decorations.
 * Prioritizes new modeData.targets structure, falls back to board decorations.
 */
export function selectTargetOverlays(
  s: GameState,
): ReadonlyArray<TargetOverlay> {
  const targets: Array<TargetOverlay> = [];

  // NEW: Read from mode adapter data (ExtendedModeData.targets)
  const modeData = s.modeData as ExtendedModeData | undefined;
  if (modeData?.targets) {
    for (const targetPattern of modeData.targets) {
      // Convert TargetCell array to coordinate tuples for overlay format
      const cells: Array<readonly [GridCoord, GridCoord]> = [];
      for (const targetCell of targetPattern) {
        cells.push([targetCell.x, targetCell.y] as const);
      }

      targets.push({
        cells,
        kind: "target",
        style: "glow", // Default style for new system
        z: 3 satisfies typeof Z.target,
      } as const);
    }
  }

  // LEGACY: Fall back to board decorations system for backward compatibility
  if (targets.length === 0 && s.boardDecorations) {
    for (const decoration of s.boardDecorations) {
      // Currently BoardDecoration only has "cellHighlight" type
      // Convert BoardDecoration to TargetOverlay with coordinate tuples
      const cells: Array<readonly [GridCoord, GridCoord]> = [];
      for (const cell of decoration.cells) {
        cells.push([cell.x, cell.y] as const);
      }

      targets.push({
        cells,
        kind: "target",
        style: "glow", // Default style for now
        z: 3 satisfies typeof Z.target,
        ...(decoration.color !== undefined && { color: decoration.color }),
        ...(decoration.alpha !== undefined && { alpha: decoration.alpha }),
      } as const);
    }
  }

  return targets;
}

/**
 * Combines all frame-based derived overlays into a single array.
 * This is the main entry point for pure, state-derived overlay data.
 */
export function selectDerivedOverlays(
  s: GameState,
): ReadonlyArray<RenderOverlay> {
  const overlays: Array<RenderOverlay> = [];

  // Add ghost overlay if available
  const ghost = selectGhostOverlay(s);
  if (ghost) {
    overlays.push(ghost);
  }

  // Add target overlays
  const targets = selectTargetOverlays(s);
  overlays.push(...targets);

  return overlays;
}
