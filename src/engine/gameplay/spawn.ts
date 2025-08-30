import { createActivePiece, isTopOut } from "../../core/spawning";
import { Airborne } from "../../engine/physics/lock-delay.machine";

import type {
  GameState,
  Action,
  PieceId,
  TopOutState,
} from "../../state/types";

export const handlers = {
  Spawn: (
    state: GameState,
    action: Extract<Action, { type: "Spawn" }>,
  ): GameState => {
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

    if (isTopOut(state.board, pieceToSpawn)) {
      const topOutState: TopOutState = {
        ...state,
        active: undefined,
        status: "topOut" as const,
      };
      return topOutState;
    }

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
