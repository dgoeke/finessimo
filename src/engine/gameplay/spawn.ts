import { lockPiece, getCompletedLines, clearLines } from "@/engine/core/board";
import { createActivePiece, isTopOut } from "@/engine/core/spawning";

import type { GameState, PhysicsState, PieceId } from "@/engine/types";

export function placeActivePiece(state: GameState): {
  state: GameState;
  pieceId: PieceId | null;
} {
  if (!state.piece) {
    return { pieceId: null, state };
  }

  const pieceId = state.piece.id;
  const newBoard = lockPiece(state.board, state.piece);

  const newState = {
    ...state,
    board: newBoard,
    hold: { ...state.hold, usedThisTurn: false }, // Reset hold when piece locks
    piece: null, // Clear active piece after locking
  };

  return { pieceId, state: newState };
}

export function clearCompletedLines(state: GameState): {
  state: GameState;
  rows: Array<number>;
} {
  const completedRows = getCompletedLines(state.board);

  if (completedRows.length === 0) {
    return { rows: [], state };
  }

  const newBoard = clearLines(state.board, completedRows);
  const newState = {
    ...state,
    board: newBoard,
  };

  return { rows: Array.from(completedRows), state: newState };
}

/**
 * Unified spawn function - single source of truth for ALL spawning
 * Handles queue management, RNG updates, physics reset, and top-out checks
 */
export function spawnPiece(
  state: GameState,
  pieceIdOverride?: PieceId,
): {
  state: GameState;
  spawnedId: PieceId | null;
  topOut: boolean;
} {
  let pieceToSpawn: PieceId;
  let newQueue = state.queue;
  let newRng = state.rng;

  if (pieceIdOverride !== undefined) {
    // Hold swap - use the provided piece
    pieceToSpawn = pieceIdOverride;
  } else {
    // Normal spawn - get next piece from queue
    if (state.queue.length === 0) {
      return { spawnedId: null, state, topOut: true };
    }

    // Safe to access [0] because we checked length > 0 above
    const firstPiece = state.queue[0];
    if (firstPiece === undefined) {
      // Should never happen due to length check above, but satisfies TS
      return { spawnedId: null, state, topOut: true };
    }
    pieceToSpawn = firstPiece;
    newQueue = state.queue.slice(1);

    // Refill queue if getting low
    if (newQueue.length < state.cfg.previewCount) {
      const queueResult = state.rng.getNextPieces(7); // Get a full bag
      newQueue = [
        ...newQueue,
        ...(queueResult.pieces as ReadonlyArray<PieceId>),
      ];
      newRng = queueResult.newRng;
    }
  }

  // Check for top-out
  if (isTopOut(state.board, pieceToSpawn)) {
    return { spawnedId: null, state, topOut: true };
  }

  // Create active piece
  const activePiece = createActivePiece(pieceToSpawn);

  // Reset physics state for new piece
  const resetPhysics: PhysicsState = {
    ...state.physics,
    gravityAccum32: 0 as typeof state.physics.gravityAccum32,
    lock: {
      deadlineTick: null,
      resetCount: 0,
    },
  };

  const newState = {
    ...state,
    hold: state.hold, // Never modify hold state during spawn
    physics: resetPhysics,
    piece: activePiece,
    queue: newQueue,
    rng: newRng,
  };

  return { spawnedId: pieceToSpawn, state: newState, topOut: false };
}
