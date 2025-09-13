import { tryMove } from "../core/board";
import { addQ, fracQ, floorQ } from "../utils/fixedpoint";

import type { GameState } from "../types";

/**
 * Attempts to move a piece down N times, stopping at first collision.
 * Returns the updated game state with the piece in its new position.
 */
function tryMoveDownNTimes(state: GameState, n: number): GameState {
  if (!state.piece || n <= 0) return state;

  let currentPiece = state.piece;
  let cellsMoved = 0;

  // Move down cell by cell until blocked or N moves completed
  for (let i = 0; i < n; i++) {
    const movedPiece = tryMove(state.board, currentPiece, 0, 1);
    if (!movedPiece) break; // Blocked - stop here

    currentPiece = movedPiece;
    cellsMoved++;
  }

  // Return updated state if piece moved
  if (cellsMoved > 0) {
    return { ...state, piece: currentPiece };
  }

  return state;
}

/**
 * Advance gravity/softdrop accumulator and attempt to descend piece.
 * Uses Q16.16 fixed-point arithmetic for smooth, frame-rate independent gravity.
 * This function does not emit events; it only updates state.
 */
export function gravityStep(state: GameState): { state: GameState } {
  const s = state;
  if (!s.piece) return { state: s };

  // Choose gravity or soft drop rate
  const g =
    s.physics.softDropOn && s.cfg.softDrop32 != null
      ? s.cfg.softDrop32
      : s.cfg.gravity32;

  // Accumulate gravity in Q16.16 format
  const accum = addQ(s.physics.gravityAccum32, g);

  // Extract integer part (cells to move) and fractional part (remainder)
  const cells = floorQ(accum);
  const nextAccum = fracQ(accum);

  // Attempt to move piece down by the integer number of cells
  let next = tryMoveDownNTimes(s, cells);

  // Store fractional remainder for next tick
  next = { ...next, physics: { ...next.physics, gravityAccum32: nextAccum } };

  return { state: next };
}
