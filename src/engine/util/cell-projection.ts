import { PIECES } from "../../core/pieces";
import { createGridCoord, gridCoordAsNumber } from "../../types/brands";

import type { ActivePiece } from "../../state/types";
import type { GridCoord } from "../../types/brands";

/**
 * Pure utility functions for projecting piece shapes to grid coordinates.
 *
 * This centralizes the logic for converting piece data (position, rotation, shape)
 * into arrays of absolute grid coordinate tuples for overlay rendering.
 */

/**
 * Projects an active piece to its absolute grid coordinates.
 *
 * Converts the piece's relative cell data to absolute [x, y] coordinate tuples
 * based on the piece's position and rotation state.
 *
 * @param piece - The active piece to project
 * @returns Array of [x, y] coordinate tuples representing occupied cells
 */
export function cellsForActivePiece(
  piece: ActivePiece,
): ReadonlyArray<readonly [GridCoord, GridCoord]> {
  const shape = PIECES[piece.id];
  const cells = shape.cells[piece.rot];

  const result: Array<readonly [GridCoord, GridCoord]> = [];

  for (const [dx, dy] of cells) {
    const absoluteX = gridCoordAsNumber(piece.x) + dx;
    const absoluteY = gridCoordAsNumber(piece.y) + dy;

    result.push([
      createGridCoord(absoluteX),
      createGridCoord(absoluteY),
    ] as const);
  }

  return result;
}
