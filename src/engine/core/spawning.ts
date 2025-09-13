import { canPlacePiece } from "./board";
import { PIECES } from "./pieces";
import {
  type Board,
  type ActivePiece,
  type PieceId,
  createGridCoord,
  gridCoordAsNumber,
} from "./types";

// Precompute spawn ActivePiece per PieceId with branded coords
const SPAWN_ACTIVE: Readonly<Record<PieceId, ActivePiece>> = ((): Readonly<
  Record<PieceId, ActivePiece>
> => {
  const out = {} as Record<PieceId, ActivePiece>;
  (Object.keys(PIECES) as Array<PieceId>).forEach((id) => {
    const [x, y] = PIECES[id].spawnTopLeft;
    out[id] = {
      id,
      rot: "spawn",
      x: createGridCoord(x),
      y: createGridCoord(y),
    };
  });
  return out;
})();

/**
 * Create a new active piece at spawn position
 */
export function createActivePiece(pieceId: PieceId): ActivePiece {
  return SPAWN_ACTIVE[pieceId];
}

/**
 * Check if a piece can spawn at its default position
 */
export function canSpawnPiece(board: Board, pieceId: PieceId): boolean {
  return canPlacePiece(board, createActivePiece(pieceId));
}

/**
 * Check if the game is topped out (can't spawn new piece)
 */
export function isTopOut(board: Board, pieceId: PieceId): boolean {
  return !canSpawnPiece(board, pieceId);
}

/**
 * Check if a piece is entirely within the vanish zone (all cells y < 0)
 * Used for lockout detection when a piece locks entirely above the visible area
 */
export function isPieceEntirelyInVanishZone(piece: ActivePiece): boolean {
  const shape = PIECES[piece.id];
  const cells = shape.cells[piece.rot];

  for (const [, dy] of cells) {
    const y = gridCoordAsNumber(piece.y) + dy;
    if (y >= 0) {
      return false; // At least one cell is in or below the visible area
    }
  }

  return true; // All cells are in the vanish zone (y < 0)
}
