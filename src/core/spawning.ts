/* eslint-disable sonarjs/todo-tag */
import { type Board, type ActivePiece, type PieceId } from "../state/types";
import { createGridCoord, gridCoordAsNumber } from "../types/brands";

import { canPlacePiece } from "./board";
import { PIECES } from "./pieces";

/**
 * Create a new active piece at spawn position
 */
export function createActivePiece(pieceId: PieceId): ActivePiece {
  const shape = PIECES[pieceId];
  const [spawnX, spawnY] = shape.spawnTopLeft;

  return {
    id: pieceId,
    rot: "spawn",
    x: createGridCoord(spawnX),
    y: createGridCoord(spawnY),
  };
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

/**
 * Spawn a piece with hold swap logic
 * Returns [newActivePiece, newHoldPiece] or null if top-out
 */
export function spawnWithHold(
  board: Board,
  nextPiece: PieceId,
  currentHold?: PieceId,
): [ActivePiece, PieceId | undefined] | null {
  // If no hold piece, just spawn the next piece
  if (currentHold === undefined) {
    const piece = createActivePiece(nextPiece);
    if (!canPlacePiece(board, piece)) return null; // top-out
    return [piece, undefined];
  }

  // Spawn the held piece, next piece becomes new hold
  const heldPiece = createActivePiece(currentHold);
  if (!canPlacePiece(board, heldPiece)) return null; // top-out
  return [heldPiece, nextPiece];
}
