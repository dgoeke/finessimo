import { calculateGhostPosition } from "../../core/board";
import { isExtendedModeData } from "../../modes/types";
import { isPlaying } from "../../state/types";
import { gridCoordAsNumber } from "../../types/brands";
import { Z } from "../ui/overlays";
import { cellsForActivePiece } from "../util/cell-projection";

import type { TargetCell } from "../../modes/types";
import type { GameState, BoardDecoration } from "../../state/types";
import type { GridCoord } from "../../types/brands";
import type {
  ColumnHighlightOverlay,
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

  // Check if active piece exists
  if (!s.active) return null;

  // Check ghost enabled state: mode data overrides user settings
  const modeData = isExtendedModeData(s.modeData) ? s.modeData : undefined;
  const ghostEnabled =
    modeData?.ghostEnabled ?? s.gameplay.ghostPieceEnabled ?? true;
  if (!ghostEnabled) return null;

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
    opacity: 0.8,
    pieceId: ghostPosition.id,
    z: Z.ghost,
  } as const;
}

/**
 * Convert a target pattern from TargetCell array to TargetOverlay.
 * Returns null for empty patterns to make invalid states unrepresentable.
 */
function createTargetOverlayFromPattern(
  targetPattern: ReadonlyArray<TargetCell>,
  index: number,
): TargetOverlay | null {
  // Guard against empty patterns
  if (targetPattern.length === 0) {
    return null;
  }

  // Convert TargetCell array to coordinate tuples for overlay format
  const cells: Array<readonly [GridCoord, GridCoord]> = [];

  for (const targetCell of targetPattern) {
    cells.push([targetCell.x, targetCell.y] as const);
  }

  // Since we've already checked length > 0, we know first element exists
  // All cells in a pattern should have the same color by design
  const firstCell = targetPattern[0];
  if (!firstCell) {
    // This should never happen due to length check above, but satisfy TypeScript
    return null;
  }

  return {
    cells,
    color: firstCell.color,
    id: generateCellsId(`target-mode:${String(index)}`, cells),
    kind: "target",
    style: "outline", // Use outline style for cleaner target rendering
    z: Z.target,
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
    style: "outline", // Use outline style for cleaner target rendering
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
  const modeData = isExtendedModeData(s.modeData) ? s.modeData : undefined;
  if (modeData?.targets) {
    for (const [i, targetPattern] of modeData.targets.entries()) {
      const overlay = createTargetOverlayFromPattern(targetPattern, i);
      if (overlay) {
        targets.push(overlay);
      }
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
 * Selects column highlight overlay for the active piece in guided mode.
 * Returns null if not in guided mode or no active piece.
 */
export function selectColumnHighlightOverlay(
  s: GameState,
): ColumnHighlightOverlay | null {
  // Only active in guided mode
  if (s.currentMode !== "guided") return null;

  // Check if column highlight is enabled
  if (!(s.gameplay.guidedColumnHighlightEnabled ?? true)) return null;

  // Check for active piece
  if (!isPlaying(s) || !s.active) return null;

  // Get cells for active piece
  const activeCells = cellsForActivePiece(s.active);

  // Extract unique column indices
  const columnSet = new Set<number>();
  for (const [x] of activeCells) {
    const gridX = gridCoordAsNumber(x);
    // Only include visible columns (0-9 for standard Tetris board)
    if (gridX >= 0 && gridX < 10) {
      columnSet.add(gridX);
    }
  }

  if (columnSet.size === 0) return null;

  const columns = Array.from(columnSet).sort((a, b) => a - b);

  return {
    color: "#FFFFFF", // White color for subtle highlight
    columns,
    id: `column-highlight:${s.active.id}:${columns.join(",")}`,
    intensity: 0.08, // Lower intensity since it's behind the grid
    kind: "column-highlight",
    z: Z.columnHighlight,
  } as const;
}

/**
 * Combines all frame-based derived overlays into a single array.
 * This is the main entry point for pure, state-derived overlay data.
 */
export function selectDerivedOverlays(
  s: GameState,
): ReadonlyArray<RenderOverlay> {
  const overlays: Array<RenderOverlay> = [];

  // Add column highlight overlay (renders first, behind other overlays)
  const columnHighlight = selectColumnHighlightOverlay(s);
  if (columnHighlight) {
    overlays.push(columnHighlight);
  }

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
