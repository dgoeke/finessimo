import { calculateGhostPosition } from "../../core/board";
import { isPlaying } from "../../state/types";
import { gridCoordAsNumber } from "../../types/brands";
import { Z } from "../ui/overlays";
import { cellsForActivePiece } from "../util/cell-projection";

import type { ExtendedModeData, TargetCell } from "../../modes/types";
import type { GameState, BoardDecoration } from "../../state/types";
import type { GridCoord } from "../../types/brands";
import type {
  GhostOverlay,
  RenderOverlay,
  TargetOverlay,
} from "../ui/overlays";

/**
 * Pure selectors for frame-based overlay data derived from game state.
 *
 * These selectors transform game state into declarative overlay definitions
 * for unified rendering. All functions are pure with no side effects.
 */

/**
 * Generate a stable ID from a set of coordinate tuples.
 * Uses first and last cells to create a deterministic hash-like identifier.
 */
function generateCellsId(
  prefix: string,
  cells: ReadonlyArray<readonly [GridCoord, GridCoord]>,
): string {
  if (cells.length === 0) return `${prefix}:empty`;
  const first = cells[0];
  const last = cells[cells.length - 1];
  if (!first || !last) return `${prefix}:empty`; // Type guard for safety
  const firstStr = `${String(gridCoordAsNumber(first[0]))},${String(gridCoordAsNumber(first[1]))}`;
  const lastStr = `${String(gridCoordAsNumber(last[0]))},${String(gridCoordAsNumber(last[1]))}`;
  return `${prefix}:${String(cells.length)}:${firstStr}:${lastStr}`;
}

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

  // Only render ghost if it differs from active piece position (any axis)
  if (
    gridCoordAsNumber(ghostPosition.x) === gridCoordAsNumber(s.active.x) &&
    gridCoordAsNumber(ghostPosition.y) === gridCoordAsNumber(s.active.y) &&
    ghostPosition.rot === s.active.rot
  ) {
    return null;
  }

  // Use cell projection utility to get coordinate tuples
  const ghostCells = cellsForActivePiece(ghostPosition);

  return {
    cells: ghostCells,
    id: `ghost:${ghostPosition.id}:${String(gridCoordAsNumber(ghostPosition.x))},${String(gridCoordAsNumber(ghostPosition.y))},${ghostPosition.rot}`,
    kind: "ghost",
    opacity: 0.35,
    pieceId: ghostPosition.id,
    z: Z.ghost,
  } as const;
}

/**
 * Convert a target pattern from TargetCell array to TargetOverlay.
 */
function createTargetOverlayFromPattern(
  targetPattern: ReadonlyArray<TargetCell>,
  index: number,
): TargetOverlay {
  // Convert TargetCell array to coordinate tuples for overlay format
  const cells: Array<readonly [GridCoord, GridCoord]> = [];
  let patternColor: string | undefined;

  for (const targetCell of targetPattern) {
    cells.push([targetCell.x, targetCell.y] as const);
    // Use color from first cell that has one (all cells in pattern should match)
    if (patternColor === undefined && targetCell.color !== undefined) {
      patternColor = targetCell.color;
    }
  }

  return {
    cells,
    id: generateCellsId(`target-mode:${String(index)}`, cells),
    kind: "target",
    style: "glow", // Default style for new system
    z: Z.target,
    ...(patternColor !== undefined && { color: patternColor }),
  } as const;
}

/**
 * Convert a board decoration to a TargetOverlay.
 */
function createTargetOverlayFromDecoration(
  decoration: BoardDecoration,
  index: number,
): TargetOverlay {
  // Convert BoardDecoration to TargetOverlay with coordinate tuples
  const cells: Array<readonly [GridCoord, GridCoord]> = [];
  for (const cell of decoration.cells) {
    cells.push([cell.x, cell.y] as const);
  }

  return {
    cells,
    id: generateCellsId(`target-legacy:${String(index)}`, cells),
    kind: "target",
    style: "glow", // Default style for now
    z: Z.target,
    ...(decoration.color !== undefined && { color: decoration.color }),
    ...(decoration.alpha !== undefined && { alpha: decoration.alpha }),
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
    for (const [i, targetPattern] of modeData.targets.entries()) {
      targets.push(createTargetOverlayFromPattern(targetPattern, i));
    }
  }

  // LEGACY: Fall back to board decorations system for backward compatibility
  if (targets.length === 0 && s.boardDecorations) {
    for (const [i, decoration] of s.boardDecorations.entries()) {
      targets.push(createTargetOverlayFromDecoration(decoration, i));
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
