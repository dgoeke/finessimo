/* eslint-disable sonarjs/todo-tag */
import { canPlacePiece } from "../../core/board";
import { createActivePiece } from "../../core/spawning";
import { Airborne } from "../../engine/physics/lock-delay.machine";
import { buildTopOutState } from "../../state/types";

import type {
  GameState,
  Action,
  PieceId,
  ActivePiece,
} from "../../state/types";

function getNextPieceFromQueue(holdQueue: Array<PieceId>): {
  newActive: ActivePiece;
} | null {
  if (holdQueue.length === 0) return null;

  const nextPiece = holdQueue.shift();
  if (nextPiece === undefined) return null;

  const newActive = createActivePiece(nextPiece);
  return { newActive };
}

export const handlers = {
  Hold: (
    state: GameState,
    _action: Extract<Action, { type: "Hold" }>,
  ): GameState => {
    if (!state.active || !state.canHold) {
      return state;
    }

    const currentPieceId = state.active.id;
    let newActive: ActivePiece | undefined;
    const holdQueue = [...state.nextQueue];

    // On first hold, consume from preview; thereafter swap with held piece
    if (state.hold !== undefined) {
      newActive = createActivePiece(state.hold);
    } else {
      const result = getNextPieceFromQueue(holdQueue);
      if (!result) return state;
      newActive = result.newActive;
    }

    // Check for topout - cannot place the piece being swapped in
    if (!canPlacePiece(state.board, newActive)) {
      return buildTopOutState(state);
    }

    return {
      ...state,
      active: newActive,
      canHold: false,
      hold: currentPieceId,
      nextQueue: holdQueue,
      physics: {
        ...state.physics,
        lockDelay: Airborne(),
      },
    };
  },
} as const;
