import { type Board, type ActivePiece, type PieceId } from "../state/types";
import { createGridCoord } from "../types/brands";

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
  const piece = createActivePiece(pieceId);
  return canPlacePiece(board, piece);
}

/**
 * Check if the game is topped out (can't spawn new piece)
 */
export function isTopOut(board: Board, pieceId: PieceId): boolean {
  return !canSpawnPiece(board, pieceId);
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
    if (!canPlacePiece(board, piece)) {
      return null; // Top out
    }
    return [piece, undefined];
  }

  // Try to spawn the held piece
  const heldPiece = createActivePiece(currentHold);
  if (!canPlacePiece(board, heldPiece)) {
    return null; // Top out
  }

  // Swap: spawn held piece, next piece becomes new hold
  return [heldPiece, nextPiece];
}
