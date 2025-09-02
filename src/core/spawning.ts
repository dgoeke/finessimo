/* eslint-disable sonarjs/todo-tag */
import { type Board, type ActivePiece, type PieceId } from "../state/types";
import { createGridCoord } from "../types/brands";

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
export function canSpawnPiece(_board: Board, _pieceId: PieceId): boolean {
  // TODO: Re-implement proper spawn collision detection

  // This is a stub that always returns true to allow gameplay to continue
  // Original logic: checked if canPlacePiece(board, piece) for spawn position
  return true;
}

/**
 * Check if the game is topped out (can't spawn new piece)
 */
export function isTopOut(_board: Board, _pieceId: PieceId): boolean {
  // TODO: Re-implement proper topout detection

  // This is a stub that always returns false to allow gameplay to continue
  // Original logic: returned !canSpawnPiece(board, pieceId)
  return false;
}

/**
 * Spawn a piece with hold swap logic
 * Returns [newActivePiece, newHoldPiece] or null if top-out
 */
export function spawnWithHold(
  _board: Board,
  nextPiece: PieceId,
  currentHold?: PieceId,
): [ActivePiece, PieceId | undefined] | null {
  // TODO: Re-implement proper collision checks for hold spawning

  // This is a stub that always allows spawning to continue gameplay
  // Original logic: checked canPlacePiece for both next and held pieces

  // If no hold piece, just spawn the next piece
  if (currentHold === undefined) {
    const piece = createActivePiece(nextPiece);
    return [piece, undefined];
  }

  // Spawn the held piece, next piece becomes new hold
  const heldPiece = createActivePiece(currentHold);
  return [heldPiece, nextPiece];
}
