/**
 * Reducer Architecture
 *
 * Unidirectional flow: UI → Input Handler → Reducer → Physics Post-Step → State → UI
 * - Input handlers classify raw inputs (Tap/Hold/Repeat/Rotate) and attach timestamps.
 * - The reducer is pure: it updates domain state by action type, without side effects.
 * - Physics post-step (physicsPostStep) runs after each reducer pass to advance
 *   time-based mechanics (lock delay) using a deterministic state machine.
 *
 * Module layout:
 * - engine/gameplay/*: Movement, rotation, spawn, and hold handlers.
 *   Separated for clarity and to keep reducers small and testable.
 * - engine/physics/*: Gravity and lock-delay machine. Centralizes timing rules so
 *   action handlers stay local to their concerns and cannot diverge on timing.
 * - engine/scoring/*: Lock commit, line clears, and stats updates. Pure and synchronous.
 * - engine/ui/effects: Push/prune/clear ephemeral UI effects; pruning keyed to Tick.
 * - engine/init: Initial state/config builders; single source of truth for defaults.
 *
 * Why physicsPostStep exists:
 * - Ground contact and lock timing depend on both the previous and next states
 *   (e.g., moved while grounded, resume contact). Centralizing after-action keeps
 *   semantics consistent across all actions and prevents duplicated timing logic.
 * - The lock-delay machine returns (nextLD, lockNow). When lockNow, we materialize
 *   a PendingLock and transition to resolvingLock; otherwise we only update LD.
 */
import {
  createEmptyBoard,
  tryMove,
  dropToBottom,
  clearLines,
  shiftUpAndInsertRow,
} from "../core/board";
import { createActivePiece } from "../core/spawning";
import { handlers as holdHandlers } from "../engine/gameplay/hold";
import { handlers as movementHandlers } from "../engine/gameplay/movement";
import { handlers as rotationHandlers } from "../engine/gameplay/rotation";
import { handlers as spawnHandlers } from "../engine/gameplay/spawn";
import { createInitialState } from "../engine/init";
import { createPendingLock } from "../engine/lock-utils";
import {
  shouldApplyGravity,
  gravityIntervalMs,
  applyOneGravityStep,
} from "../engine/physics/gravity";
import { Airborne, Grounded } from "../engine/physics/lock-delay.machine";
import { physicsPostStep } from "../engine/physics/post-step";
import { handlers as lineClearHandlers } from "../engine/scoring/line-clear";
import { applyDelta, updateSessionDurations } from "../engine/scoring/stats";
import { pruneUiEffects } from "../engine/ui/effects";
import { createGridCoord, gridCoordAsNumber } from "../types/brands";

import {
  type GameState,
  type Action,
  type LockSource,
  type UiEffect,
  buildResolvingLockState,
  buildPlayingState,
  buildTopOutState,
  hasActivePiece,
  type ActivePiece,
  idx,
} from "./types";

import type { FaultType } from "../engine/finesse/calculator";
import type { Timestamp } from "../types/timestamp";

// Type-safe action handler map for functional pattern
type ActionHandlerMap = {
  [K in Action["type"]]: (
    state: GameState,
    action: Extract<Action, { type: K }>,
  ) => GameState;
};

// Local helpers
const MAX_PROCESSED_LOG = 200 as const;

function enterResolvingFromActive(
  s: Extract<GameState, { status: "playing" }> & { active: ActivePiece },
  ts: Timestamp,
  source: LockSource,
): GameState {
  const pending = createPendingLock(s.board, s.active, source, ts);
  const base = {
    ...s,
    physics: { ...s.physics, lockDelay: Airborne() },
    tick: s.tick + 1,
  } as GameState;
  return buildResolvingLockState(base, pending);
}

// Individual action handlers - pure functions
const actionHandlers: ActionHandlerMap = {
  ...movementHandlers,
  ...rotationHandlers,
  ...spawnHandlers,
  ...holdHandlers,
  ...lineClearHandlers,
  AppendProcessed: (state, action) => {
    const next = [...state.processedInputLog, action.entry];
    return {
      ...state,
      processedInputLog:
        next.length > MAX_PROCESSED_LOG ? next.slice(-MAX_PROCESSED_LOG) : next,
    };
  },

  CancelLockDelay: (state, _action) => ({
    ...state,
    physics: {
      ...state.physics,
      lockDelay: Airborne(),
    },
  }),

  ClearInputLog: (state, _action) => ({ ...state, processedInputLog: [] }),

  ClearLines: (state, action) => ({
    ...state,
    board: clearLines(state.board, action.lines),
  }),

  CreateGarbageRow: (state, action) => {
    const newCells = shiftUpAndInsertRow(state.board, action.row);
    const newBoard = {
      ...state.board,
      cells: newCells,
    };

    // Check if garbage pushed any blocks into vanish zone (topout condition)
    for (let y = -newBoard.vanishRows; y < 0; y++) {
      for (let x = 0; x < newBoard.width; x++) {
        if (
          newBoard.cells[
            idx(newBoard, createGridCoord(x), createGridCoord(y))
          ] !== 0
        ) {
          return buildTopOutState({ ...state, board: newBoard });
        }
      }
    }

    // Adjust active Y only while playing; otherwise just update board
    if (state.status === "playing") {
      const newActive = state.active
        ? {
            ...state.active,
            y: createGridCoord(gridCoordAsNumber(state.active.y) - 1),
          }
        : undefined;
      return { ...state, active: newActive, board: newBoard };
    }
    return { ...state, board: newBoard };
  },

  HardDrop: (state, action) =>
    !hasActivePiece(state)
      ? state
      : enterResolvingFromActive(state, action.timestampMs, "hardDrop"),

  // Physics actions
  HoldStart: (state, _action) => state, // Analytics/logging only

  // Core game actions
  Init: (state, action) =>
    createInitialState(action.seed, action.timestampMs, {
      customRng: action.rng,
      gameplay: action.gameplay,
      mode: action.mode,
      previousStats: action.retainStats === true ? state.stats : undefined,
      timing: action.timing,
    }),

  Lock: (state, action) => {
    if (!hasActivePiece(state)) return state;
    const source: LockSource = state.physics.isSoftDropping
      ? "softDrop"
      : "gravity";
    return enterResolvingFromActive(state, action.timestampMs, source);
  },

  // UI overlay effects
  PushUiEffect: (state, action) => ({
    ...state,
    uiEffects: [...state.uiEffects, action.effect] as ReadonlyArray<UiEffect>,
  }),

  // Statistics
  RecordPieceLock: (state, action) => {
    const faultCounts: Partial<Record<FaultType, number>> = {
      ...state.stats.faultsByType,
    };

    for (const fault of action.faults) {
      faultCounts[fault] = (faultCounts[fault] ?? 0) + 1;
    }

    const newStats = applyDelta(state.stats, {
      attempts: state.stats.attempts + 1,
      faultsByType: faultCounts,
      incorrectPlacements: action.isOptimal
        ? state.stats.incorrectPlacements
        : state.stats.incorrectPlacements + 1,
      optimalInputs: state.stats.optimalInputs + action.optimalInputCount,
      optimalPlacements: action.isOptimal
        ? state.stats.optimalPlacements + 1
        : state.stats.optimalPlacements,
      totalFaults: state.stats.totalFaults + action.faults.length,
      totalInputs: state.stats.totalInputs + action.inputCount,
    });

    return { ...state, stats: newStats };
  },

  // Append externally provided preview pieces and set RNG
  RefillPreview: (state, action) => ({
    ...state,
    nextQueue: [...state.nextQueue, ...action.pieces],
    rng: action.rng,
  }),

  // Replace preview queue and set RNG (e.g., on mode switch)
  ReplacePreview: (state, action) => ({
    ...state,
    nextQueue: [...action.pieces],
    rng: action.rng,
  }),

  ResetBoard: (state, _action) => ({
    ...state,
    board: createEmptyBoard(),
    physics: {
      ...state.physics,
      lineClearLines: [],
      lineClearStartTime: null,
      lockDelay: Airborne(),
    },
  }),

  RetryPendingLock: (state, action) => {
    if (state.status !== "resolvingLock") {
      return state;
    }

    // Restore piece to spawn without committing board changes
    const pieceId = state.pendingLock.pieceId;

    const baseState = {
      ...state,
      // Unlock hold so player can hold again if needed
      canHold: state.gameplay.holdEnabled,
      // Reset physics state
      physics: {
        ...state.physics,
        activePieceSpawnedAt: action.timestampMs,
        // Reset gravity timer on respawn to avoid immediate drop
        lastGravityTime: action.timestampMs,
        lineClearLines: [],
        lineClearStartTime: null,
        lockDelay: Airborne(),
      },
    };

    return buildPlayingState(baseState, {
      active: createActivePiece(pieceId),
    });
  },

  SetMode: (state, action) => ({
    ...state,
    currentMode: action.mode,
    finesseFeedback: null,
    modePrompt: null,
  }),

  // Drop actions
  SoftDrop: (state, action) => {
    if (!state.active) return state;

    if (action.on) {
      if (state.timing.softDrop === "infinite") {
        const toBottom = dropToBottom(state.board, state.active);
        return {
          ...state,
          active: toBottom,
          physics: { ...state.physics, isSoftDropping: true },
        };
      }

      const softDroppedPiece = tryMove(state.board, state.active, 0, 1);
      return {
        ...state,
        active: softDroppedPiece ?? state.active,
        physics: { ...state.physics, isSoftDropping: true },
      };
    }

    return {
      ...state,
      physics: { ...state.physics, isSoftDropping: false },
    };
  },

  // Physics actions
  StartLockDelay: (state, action) => ({
    ...state,
    physics: {
      ...state.physics,
      lockDelay: Grounded(action.timestampMs, 0),
    },
  }),

  Tick: (state, action) => {
    if (typeof (state as { tick?: unknown }).tick !== "number") {
      return state;
    }
    const timestampMs = action.timestampMs;
    const updatedStats = updateSessionDurations(
      state.stats,
      timestampMs as number,
    );
    let newState: GameState = {
      ...state,
      stats: updatedStats,
      tick: state.tick + 1,
    } as GameState;
    // Centralized TTL-based pruning for transient UI effects
    newState = pruneUiEffects(newState, timestampMs);

    if (shouldApplyGravity(newState)) {
      const timestampNum = timestampMs as number;
      const lastGravityNum = newState.physics.lastGravityTime as number;
      const timeSinceLastGravity = timestampNum - lastGravityNum;
      const gravityInterval = gravityIntervalMs(newState);

      if (timeSinceLastGravity >= gravityInterval) {
        newState = applyOneGravityStep(newState, timestampMs);
      }
      // physicsPostStep will handle lock delay timeout checking
    }
    // physicsPostStep will handle lock delay timeout checking even without gravity

    return newState;
  },

  UpdateBoardDecorations: (state, action) => ({
    ...state,
    boardDecorations: action.decorations,
  }),

  UpdateFinesseFeedback: (state, action) => ({
    ...state,
    finesseFeedback: action.feedback,
  }),

  UpdateGameplay: (state, action) => ({
    ...state,
    gameplay: { ...state.gameplay, ...action.gameplay },
  }),

  UpdateGuidance: (state, action) => ({ ...state, guidance: action.guidance }),

  UpdateModeData: (state, action) => ({ ...state, modeData: action.data }),

  UpdateModePrompt: (state, action) => ({
    ...state,
    modePrompt: action.prompt,
  }),

  // UI/Settings actions
  UpdateTiming: (state, action) => ({
    ...state,
    timing: { ...state.timing, ...action.timing },
  }),
};

export const reducer: (
  state: Readonly<GameState> | undefined,
  action: Action,
) => GameState = (
  state: Readonly<GameState> | undefined,
  action: Action,
): GameState => {
  // Defensive: if action is malformed, throw error
  const isValidAction = typeof action === "object" && "type" in action;
  if (!isValidAction) {
    throw new Error("Invalid action provided to reducer");
  }

  // Handle initialization
  if (state === undefined) {
    if (action.type === "Init") {
      return createInitialState(action.seed, action.timestampMs, {
        customRng: action.rng,
        gameplay: action.gameplay,
        mode: action.mode,
        previousStats: undefined,
        timing: action.timing,
      });
    }
    throw new Error(`Cannot process action ${action.type} without state`);
  }

  // Type-safe dispatch using the action handler map
  // TypeScript enforces exhaustiveness at compile time
  const dispatch = <T extends Action["type"]>(
    actionType: T,
    state: GameState,
    action: Extract<Action, { type: T }>,
  ): GameState => {
    const handler = actionHandlers[actionType];
    return handler(state, action);
  };

  const newState = dispatch(action.type, state, action);

  // Post-process for physics state transitions
  return physicsPostStep(state, newState, action);
};
