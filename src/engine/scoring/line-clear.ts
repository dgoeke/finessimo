import { clearLines, getCompletedLines, lockPiece } from "../../core/board";
import { PIECES } from "../../core/pieces";
import {
  buildPlayingState,
  buildLineClearState,
  buildTopOutState,
} from "../../state/types";
import { durationMsAsNumber } from "../../types/brands";
import { Airborne } from "../physics/lock-delay.machine";

import { applyDelta } from "./stats";

import type {
  GameState,
  Action,
  PendingLock,
  ActivePiece,
} from "../../state/types";

function wouldTopOut(piece: ActivePiece): boolean {
  const shape = PIECES[piece.id];
  const cells = shape.cells[piece.rot];

  for (const [, dy] of cells) {
    const cellY = piece.y + dy;
    if (cellY < 0) {
      return true;
    }
  }
  return false;
}

/**
 * Applies a pending lock to the game state, handling line clears and top-out.
 * This is a pure function that directly applies the lock logic without
 * needing to temporarily set the active piece.
 */
function applyPendingLock(
  state: GameState,
  pendingLock: PendingLock,
): GameState {
  const { finalPos, timestampMs } = pendingLock;
  const lockedBoard = lockPiece(state.board, finalPos);
  const completedLines = getCompletedLines(lockedBoard);
  const topOut = wouldTopOut(finalPos);

  // Update basic piece stats
  const deltaStats: Partial<GameState["stats"]> = {
    piecesPlaced: state.stats.piecesPlaced + 1,
    sessionPiecesPlaced: state.stats.sessionPiecesPlaced + 1,
  };

  if (!topOut) {
    deltaStats.linesCleared = state.stats.linesCleared + completedLines.length;
    deltaStats.sessionLinesCleared =
      state.stats.sessionLinesCleared + completedLines.length;

    if (completedLines.length === 1) {
      deltaStats.singleLines = state.stats.singleLines + 1;
    } else if (completedLines.length === 2) {
      deltaStats.doubleLines = state.stats.doubleLines + 1;
    } else if (completedLines.length === 3) {
      deltaStats.tripleLines = state.stats.tripleLines + 1;
    } else if (completedLines.length === 4) {
      deltaStats.tetrisLines = state.stats.tetrisLines + 1;
    }
  }

  const newStats = applyDelta(state.stats, deltaStats);

  // Base shared fields for all possible next states
  const baseSharedFields = {
    ...state,
    board: lockedBoard,
    canHold: state.gameplay.holdEnabled,
    physics: {
      ...state.physics,
      activePieceSpawnedAt: null,
      lockDelay: Airborne(),
    },
    stats: newStats,
  };

  if (topOut) {
    return buildTopOutState(baseSharedFields);
  }

  if (completedLines.length === 0) {
    return buildPlayingState(baseSharedFields);
  }

  if (durationMsAsNumber(state.timing.lineClearDelayMs) === 0) {
    // Immediate clear with no animation delay
    const cleared = clearLines(lockedBoard, completedLines);
    const clearedBase = {
      ...baseSharedFields,
      board: cleared,
      physics: {
        ...baseSharedFields.physics,
        lineClearLines: [],
        lineClearStartTime: null,
      },
    };
    return buildPlayingState(clearedBase);
  }

  // Stage line clear animation
  const lineClearBase = {
    ...baseSharedFields,
    physics: {
      ...baseSharedFields.physics,
      lineClearLines: completedLines,
      lineClearStartTime: timestampMs,
      lockDelay: Airborne(),
    },
  };
  return buildLineClearState(lineClearBase);
}

export const handlers = {
  CommitLock: (
    state: GameState,
    _action: Extract<Action, { type: "CommitLock" }>,
  ): GameState => {
    if (state.status !== "resolvingLock") {
      return state;
    }

    // Type system now guarantees pendingLock exists when status is 'resolvingLock'

    // Apply the pending lock directly without temporary state manipulation
    return applyPendingLock(state, state.pendingLock);
  },

  CompleteLineClear: (
    state: GameState,
    _action: Extract<Action, { type: "CompleteLineClear" }>,
  ): GameState => {
    if (
      state.status !== "lineClear" ||
      state.physics.lineClearLines.length === 0
    ) {
      return state;
    }
    const baseState = {
      ...state,
      board: clearLines(state.board, state.physics.lineClearLines),
      physics: {
        ...state.physics,
        lineClearLines: [],
        lineClearStartTime: null,
      },
    };
    return buildPlayingState(baseState);
  },

  StartLineClear: (
    state: GameState,
    action: Extract<Action, { type: "StartLineClear" }>,
  ): GameState => {
    const baseState = {
      ...state,
      physics: {
        ...state.physics,
        lineClearLines: action.lines,
        lineClearStartTime: action.timestampMs,
      },
    };
    return buildLineClearState(baseState);
  },
} as const;
