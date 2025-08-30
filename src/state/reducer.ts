import {
  createEmptyBoard,
  tryMove,
  dropToBottom,
  clearLines,
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
import { createGridCoord, gridCoordAsNumber } from "../types/brands";

import {
  type GameState,
  type Action,
  type LockSource,
  createBoardCells,
  type UiEffect,
  assertNever,
  buildResolvingLockState,
  buildPlayingState,
} from "./types";

import type { FaultType } from "../finesse/calculator";

// Type-safe action handler map for functional pattern
type ActionHandlerMap = {
  [K in Action["type"]]: (
    state: GameState,
    action: Extract<Action, { type: K }>,
  ) => GameState;
};

// Individual action handlers - pure functions
const actionHandlers: ActionHandlerMap = {
  ...movementHandlers,
  ...rotationHandlers,
  ...spawnHandlers,
  ...holdHandlers,
  ...lineClearHandlers,
  AppendProcessed: (state, action) => ({
    ...state,
    processedInputLog: [...state.processedInputLog, action.entry],
  }),

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
    const newCells = createBoardCells();

    // Shift all existing rows up by one
    for (let y = 0; y < 19; y++) {
      for (let x = 0; x < 10; x++) {
        const sourceIdx = (y + 1) * 10 + x;
        const destIdx = y * 10 + x;
        newCells[destIdx] = state.board.cells[sourceIdx] ?? 0;
      }
    }

    // Add the provided row at the bottom (row 19)
    for (let x = 0; x < 10; x++) {
      const bottomIdx = 19 * 10 + x;
      newCells[bottomIdx] = action.row[x] ?? 0;
    }

    const newBoard = { ...state.board, cells: newCells };

    // Handle state-specific updates
    switch (state.status) {
      case "playing": {
        // Update active piece position if it exists (move it up)
        const newActive = state.active
          ? {
              ...state.active,
              y: createGridCoord(gridCoordAsNumber(state.active.y) - 1),
            }
          : undefined;

        return {
          ...state,
          active: newActive,
          board: newBoard,
        };
      }
      case "resolvingLock":
        return {
          ...state,
          board: newBoard,
        };
      case "lineClear":
        return {
          ...state,
          board: newBoard,
        };
      case "topOut":
        return {
          ...state,
          board: newBoard,
        };
      default:
        return assertNever(state);
    }
  },

  HardDrop: (state, action) => {
    if (!state.active) return state;

    const pending = createPendingLock(
      state.board,
      state.active,
      "hardDrop",
      action.timestampMs,
    );

    const baseState = {
      ...state,
      physics: {
        ...state.physics,
        lockDelay: Airborne(),
        // Keep activePieceSpawnedAt for timing calculation during lock resolution
      },
      tick: state.tick + 1,
    };

    return buildResolvingLockState(baseState, pending);
  },

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
    if (typeof state.tick !== "number" || state.active === undefined) {
      return state;
    }

    // Determine lock source based on current state
    const lockSource: LockSource = state.physics.isSoftDropping
      ? "softDrop"
      : "gravity";
    const pending = createPendingLock(
      state.board,
      state.active,
      lockSource,
      action.timestampMs,
    );

    const baseState = {
      ...state,
      physics: {
        ...state.physics,
        lockDelay: Airborne(),
        // Keep activePieceSpawnedAt for timing calculation during lock resolution
      },
      tick: state.tick + 1,
    };

    return buildResolvingLockState(baseState, pending);
  },

  // UI overlay effects
  PushUiEffect: (state, action) => ({
    ...state,
    uiEffects: [...state.uiEffects, action.effect] as Array<UiEffect>,
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
    if (typeof state.tick !== "number") {
      return state;
    }

    const timestampMs = action.timestampMs;
    const nowNum = timestampMs as number;
    // Prune expired UI effects based on ttl
    const prunedEffects: ReadonlyArray<UiEffect> = state.uiEffects.filter(
      (e) => {
        const created = e.createdAt as number;
        const ttl = e.ttlMs as number;
        return nowNum - created < ttl;
      },
    ) as ReadonlyArray<UiEffect>;
    const updatedStats = updateSessionDurations(
      state.stats,
      timestampMs as number,
    );
    let newState: GameState = {
      ...state,
      stats: updatedStats,
      tick: state.tick + 1,
    } as GameState;
    if (state.uiEffects !== prunedEffects) {
      newState = { ...newState, uiEffects: prunedEffects } as GameState;
    }

    if (shouldApplyGravity(state)) {
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
