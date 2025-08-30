import { dropToBottom, getCompletedLines, lockPiece } from "../core/board";

import type {
  ActivePiece,
  GameState,
  LockSource,
  PendingLock,
} from "../state/types";
import type { Timestamp } from "../types/timestamp";

/**
 * Shared utility to create a PendingLock from current game state.
 * Used by both reducer actions and physics post-processing.
 */
export function createPendingLock(
  board: GameState["board"],
  piece: ActivePiece,
  source: LockSource,
  timestampMs: Timestamp,
): PendingLock {
  const finalPos = source === "hardDrop" ? dropToBottom(board, piece) : piece;
  const simulatedBoard = lockPiece(board, finalPos);
  const completedLines = getCompletedLines(simulatedBoard);

  return {
    completedLines,
    finalPos,
    pieceId: piece.id,
    source,
    timestampMs,
  };
}
