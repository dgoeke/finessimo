
// src/policy/pco-solver.ts
// Pluggable PCO solver interface. Wire a real solver later (e.g., solution-finder).

import type { Placement } from "./types";
import type { Board, PieceId } from "../state/types";

export type PCOSolver = {
  /**
   * Try to find a 4-line Perfect Clear in ≤ maxPieces from the current board.
   * Returns a *sequence* of placements (for the next ≤ maxPieces pieces) or null.
   * The first element corresponds to the immediate recommendation.
   */
  findFirstPC(
    board: Board,
    nextQueue: ReadonlyArray<PieceId>,
    hold: PieceId | undefined,
    maxPieces: number,
  ): ReadonlyArray<Placement> | null;
};

/**
 * Default stub: always returns null. Replace with a real solver.
 * Keep the shape to avoid touching policy/planner call sites.
 */
export const defaultPcoSolver: PCOSolver = {
  findFirstPC: (_board, _queue, _hold, _max) => null,
};
