/* eslint-disable sonarjs/todo-tag */
import { createActivePiece } from "../../core/spawning";
import { Airborne } from "../../engine/physics/lock-delay.machine";

import type { GameState, Action, PieceId } from "../../state/types";

export const handlers = {
  Spawn: (
    state: GameState,
    action: Extract<Action, { type: "Spawn" }>,
  ): GameState => {
    // Spawn only when no active piece exists and gameplay is active
    if (state.active || state.status !== "playing") {
      return state;
    }

    let pieceToSpawn: PieceId;
    const newQueue = [...state.nextQueue];

    if (action.piece !== undefined) {
      pieceToSpawn = action.piece;
    } else {
      if (newQueue.length === 0) return state;
      const nextFromQueue = newQueue.shift();
      if (nextFromQueue === undefined) return state;
      pieceToSpawn = nextFromQueue;
    }

    // TODO: Re-implement topout detection for spawn

    // This check was removed to allow pieces to spawn even when board is full
    // Original logic: checked isTopOut(state.board, pieceToSpawn) and returned topOut state

    const newPiece = createActivePiece(pieceToSpawn);
    return {
      ...state,
      active: newPiece,
      nextQueue: newQueue,
      physics: {
        ...state.physics,
        activePieceSpawnedAt: action.timestampMs,
        lockDelay: Airborne(),
      },
    };
  },
} as const;
