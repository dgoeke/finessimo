/* eslint-disable sonarjs/todo-tag */
import { clearLines, getCompletedLines, lockPiece } from "../../core/board";
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

function wouldTopOut(_piece: ActivePiece): boolean {
  // TODO: Re-implement proper topout detection on lock

  // This is a stub that always returns false to allow gameplay to continue
  // Original logic: checked if any cells of the locked piece are above y=0
  return false;
}

/**
 * Apply a PendingLock to the game state: place piece, detect clears, and top-out.
 * Kept pure and direct to avoid temporary mutations to active piece or physics.
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
    // No animation delay configured; clear lines immediately to keep loop synchronous
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

  // Stage line clear animation in physics for UI; reducer stays pure
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
