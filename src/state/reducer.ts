import {
  createEmptyBoard,
  tryMove,
  dropToBottom,
  lockPiece,
  getCompletedLines,
  clearLines,
} from "../core/board";
import { PIECES } from "../core/pieces";
import { createSevenBagRng } from "../core/rng";
import { type PieceRandomGenerator } from "../core/rng-interface";
import { createActivePiece, canSpawnPiece, isTopOut } from "../core/spawning";
import { tryRotate, getNextRotation } from "../core/srs";
import { createTimestamp } from "../types/timestamp";

import {
  type GameState,
  type Action,
  type TimingConfig,
  type GameplayConfig,
  type PhysicsState,
  type PieceId,
  type ActivePiece,
  type Stats,
} from "./types";

import type { FaultType } from "../finesse/calculator";
import type { Timestamp } from "../types/timestamp";

// Type-safe action handler map for functional pattern
type ActionHandlerMap = {
  [K in Action["type"]]: (
    state: GameState,
    action: Extract<Action, { type: K }>,
  ) => GameState;
};

// Default timing configuration
const defaultTimingConfig: TimingConfig = {
  arrMs: 2,
  dasMs: 133,
  gravityEnabled: false, // Gravity OFF by default per DESIGN.md
  gravityMs: 500, // 500ms gravity for visibility
  lineClearDelayMs: 0,
  lockDelayMs: 500,
  // Default soft drop multiplier relative to gravity
  softDrop: 10,
  tickHz: 60,
};

// Default gameplay configuration
const defaultGameplayConfig: GameplayConfig = {
  finesseCancelMs: 50,
  ghostPieceEnabled: true,
  nextPieceCount: 5,
};

// Create initial physics state
function createInitialPhysics(): PhysicsState {
  return {
    isSoftDropping: false,
    lastGravityTime: 0,
    lineClearLines: [],
    lineClearStartTime: null,
    lockDelayStartTime: null,
  };
}

// Helper to calculate derived stats
function calculateDerivedStats(
  stats: GameState["stats"],
): Partial<GameState["stats"]> {
  const {
    attempts,
    optimalInputs,
    optimalPlacements,
    piecesPlaced,
    sessionLinesCleared,
    sessionPiecesPlaced,
    timePlayedMs,
    totalInputs,
  } = stats;

  const accuracyPercentage =
    attempts > 0 ? (optimalPlacements / attempts) * 100 : 0;
  const finesseAccuracy =
    totalInputs > 0
      ? Math.min(100, Math.max(0, (optimalInputs / totalInputs) * 100))
      : 0;
  const averageInputsPerPiece =
    piecesPlaced > 0 ? totalInputs / piecesPlaced : 0;

  // Calculate rates per minute using session counters for accurate session rates
  const playTimeMinutes = timePlayedMs > 0 ? timePlayedMs / (1000 * 60) : 0;
  const piecesPerMinute =
    playTimeMinutes > 0 ? sessionPiecesPlaced / playTimeMinutes : 0;
  const linesPerMinute =
    playTimeMinutes > 0 ? sessionLinesCleared / playTimeMinutes : 0;

  return {
    accuracyPercentage,
    averageInputsPerPiece,
    finesseAccuracy,
    linesPerMinute,
    piecesPerMinute,
  };
}

// Helper to apply stats base updates and recalculate derived stats
function applyStatsBaseUpdate(
  prevStats: GameState["stats"],
  delta: Partial<GameState["stats"]>,
): GameState["stats"] {
  const mergedStats = {
    ...prevStats,
    ...delta,
  };
  const derivedStats = calculateDerivedStats(mergedStats);
  return {
    ...mergedStats,
    ...derivedStats,
  };
}

// Initial game state
function createInitialState(
  seed: string,
  config: {
    timing?: Partial<TimingConfig> | undefined;
    gameplay?: Partial<GameplayConfig> | undefined;
    mode?: string | undefined;
    previousStats?: Stats | undefined;
    customRng?: PieceRandomGenerator | undefined;
  } = {},
): GameState {
  const { customRng, gameplay, mode, previousStats, timing } = config;
  const rng = customRng ?? createSevenBagRng(seed);
  const { newRng, pieces: initialQueue } = rng.getNextPieces(5); // Generate 5-piece preview

  // Create default stats with all fields zeroed
  const defaults: Stats = {
    // Comprehensive metrics
    accuracyPercentage: 0,
    attempts: 0,
    averageInputsPerPiece: 0,
    doubleLines: 0,
    faultsByType: {},
    finesseAccuracy: 0,
    incorrectPlacements: 0,

    linesCleared: 0,
    linesPerMinute: 0,

    longestSessionMs: 0,
    optimalInputs: 0,
    optimalPlacements: 0,

    // Performance data
    piecesPerMinute: 0,
    // Basic counters
    piecesPlaced: 0,
    sessionLinesCleared: 0,

    // Session-specific counters
    sessionPiecesPlaced: 0,
    // Session tracking
    sessionStartMs: 0,
    // Line clear statistics
    singleLines: 0,
    startedAtMs: 0,

    tetrisLines: 0,
    timePlayedMs: 0,

    // Fault tracking
    totalFaults: 0,
    totalInputs: 0,
    totalSessions: 1,
    tripleLines: 0,
  };

  // Merge with previous stats if provided, ensuring all new fields are normalized
  const baseStats = previousStats
    ? applyStatsBaseUpdate(
        {
          ...defaults,
          ...previousStats,
          sessionLinesCleared: 0,
          sessionPiecesPlaced: 0,
          sessionStartMs: 0,
          // Reset session-specific stats
          timePlayedMs: 0,
          totalSessions: previousStats.totalSessions + 1,
        },
        {},
      )
    : applyStatsBaseUpdate(defaults, {});

  // Recalculate derived metrics to ensure they're correct
  const initialStats = applyStatsBaseUpdate(baseStats, {});

  return {
    active: undefined,
    board: createEmptyBoard(),
    canHold: true,
    currentMode: mode ?? "freePlay",
    finesseFeedback: null,
    gameplay: { ...defaultGameplayConfig, ...gameplay },
    hold: undefined,
    modeData: null,
    modePrompt: null,
    nextQueue: initialQueue,
    physics: createInitialPhysics(),
    processedInputLog: [],
    rng: newRng,
    stats: initialStats,
    status: "playing",
    tick: 0,
    timing: { ...defaultTimingConfig, ...timing },
  };
}

// Helper functions for action handlers
const wouldTopOut = (piece: ActivePiece): boolean => {
  const shape = PIECES[piece.id];
  const cells = shape.cells[piece.rot];

  for (const [, dy] of cells) {
    const cellY = piece.y + dy;
    if (cellY < 0) {
      return true;
    }
  }
  return false;
};

const getNextPieceFromQueue = (
  holdQueue: Array<PieceId>,
  rng: PieceRandomGenerator,
): {
  newActive: ActivePiece;
  newPiece: PieceId;
  newRng: PieceRandomGenerator;
} | null => {
  if (holdQueue.length === 0) return null;

  const nextPiece = holdQueue.shift();
  if (nextPiece === undefined) return null;

  const newActive = createActivePiece(nextPiece);
  const { newRng: updatedRng, piece } = rng.getNextPiece();

  return { newActive, newPiece: piece, newRng: updatedRng };
};

const lockCurrentPiece = (
  baseState: GameState,
  piece: ActivePiece,
  timestampMs: Timestamp,
): GameState => {
  const lockedBoard = lockPiece(baseState.board, piece);
  const completedLines = getCompletedLines(lockedBoard);
  const topOut = wouldTopOut(piece);

  // Update basic piece stats and line clear type statistics
  const deltaStats: Partial<GameState["stats"]> = {
    piecesPlaced: baseState.stats.piecesPlaced + 1,
    sessionPiecesPlaced: baseState.stats.sessionPiecesPlaced + 1,
  };

  if (!topOut) {
    deltaStats.linesCleared =
      baseState.stats.linesCleared + completedLines.length;
    deltaStats.sessionLinesCleared =
      baseState.stats.sessionLinesCleared + completedLines.length;

    if (completedLines.length === 1) {
      deltaStats.singleLines = baseState.stats.singleLines + 1;
    } else if (completedLines.length === 2) {
      deltaStats.doubleLines = baseState.stats.doubleLines + 1;
    } else if (completedLines.length === 3) {
      deltaStats.tripleLines = baseState.stats.tripleLines + 1;
    } else if (completedLines.length === 4) {
      deltaStats.tetrisLines = baseState.stats.tetrisLines + 1;
    }
  }

  const newStats = applyStatsBaseUpdate(baseState.stats, deltaStats);

  const nextState: GameState = {
    ...baseState,
    active: undefined,
    board: lockedBoard,
    canHold: true,
    physics: {
      ...baseState.physics,
      lockDelayStartTime: null,
    },
    stats: newStats,
  };

  if (topOut) {
    return { ...nextState, status: "topOut" };
  }

  if (completedLines.length === 0) {
    // No lines; remain in playing state
    return nextState;
  }

  if (baseState.timing.lineClearDelayMs === 0) {
    // Immediate clear with no animation delay
    const cleared = clearLines(lockedBoard, completedLines);
    return {
      ...nextState,
      board: cleared,
      physics: {
        ...nextState.physics,
        lineClearLines: [],
        lineClearStartTime: null,
      },
      status: "playing",
    };
  }

  // Stage line clear animation
  return {
    ...nextState,
    physics: {
      ...nextState.physics,
      lineClearLines: completedLines,
      lineClearStartTime: timestampMs,
    },
    status: "lineClear",
  };
};

const updateSessionStats = (stats: Stats, timestampMs: number): Stats => {
  const sessionStartMs =
    stats.sessionStartMs === 0 ? timestampMs : stats.sessionStartMs;
  const gameStartMs = stats.startedAtMs === 0 ? timestampMs : stats.startedAtMs;
  const sessionTimeMs = timestampMs - sessionStartMs;
  const updatedTimeMs = Math.max(0, sessionTimeMs);

  return applyStatsBaseUpdate(stats, {
    longestSessionMs: Math.max(stats.longestSessionMs, updatedTimeMs),
    sessionStartMs,
    startedAtMs: gameStartMs,
    timePlayedMs: updatedTimeMs,
  });
};

const shouldApplyGravity = (currentState: GameState): boolean => {
  return (
    currentState.timing.gravityEnabled &&
    currentState.active !== undefined &&
    currentState.status === "playing"
  );
};

const calculateGravityInterval = (currentState: GameState): number => {
  let gravityInterval = currentState.timing.gravityMs;

  if (currentState.physics.isSoftDropping) {
    if (currentState.timing.softDrop === "infinite") {
      gravityInterval = 1;
    } else {
      const m = Math.max(1, currentState.timing.softDrop);
      gravityInterval = Math.max(
        1,
        Math.floor(currentState.timing.gravityMs / m),
      );
    }
  }

  return gravityInterval;
};

const processGravityDrop = (
  currentState: GameState,
  timestampMs: number,
): GameState => {
  if (!currentState.active) return currentState;

  const movedPiece = tryMove(currentState.board, currentState.active, 0, 1);

  if (movedPiece) {
    return {
      ...currentState,
      active: movedPiece,
      physics: {
        ...currentState.physics,
        lastGravityTime: timestampMs,
      },
    };
  } else if (currentState.physics.lockDelayStartTime === null) {
    return {
      ...currentState,
      physics: {
        ...currentState.physics,
        lockDelayStartTime: timestampMs,
      },
    };
  }

  return checkLockDelayTimeout(currentState, timestampMs);
};

const checkLockDelayTimeout = (
  currentState: GameState,
  timestampMs: number,
): GameState => {
  if (
    currentState.physics.lockDelayStartTime !== null &&
    timestampMs - currentState.physics.lockDelayStartTime >=
      currentState.timing.lockDelayMs
  ) {
    if (currentState.active) {
      return lockCurrentPiece(
        currentState,
        currentState.active,
        createTimestamp(timestampMs),
      );
    }
  }
  return currentState;
};

const applyGravityLogic = (
  currentState: GameState,
  timestampMs: number,
): GameState => {
  if (!currentState.active) return currentState;

  const timeSinceLastGravity =
    timestampMs - currentState.physics.lastGravityTime;
  const gravityInterval = calculateGravityInterval(currentState);

  if (timeSinceLastGravity >= gravityInterval) {
    return processGravityDrop(currentState, timestampMs);
  }

  return checkLockDelayTimeout(currentState, timestampMs);
};

// Individual action handlers - pure functions
const actionHandlers: ActionHandlerMap = {
  CancelLockDelay: (state, _action) => ({
    ...state,
    physics: {
      ...state.physics,
      lockDelayStartTime: null,
    },
  }),

  ClearInputLog: (state, _action) => ({ ...state, processedInputLog: [] }),

  ClearLines: (state, action) => ({
    ...state,
    board: clearLines(state.board, action.lines),
  }),

  CompleteLineClear: (state, _action) => {
    if (
      state.status !== "lineClear" ||
      state.physics.lineClearLines.length === 0
    ) {
      return state;
    }
    return {
      ...state,
      board: clearLines(state.board, state.physics.lineClearLines),
      physics: {
        ...state.physics,
        lineClearLines: [],
        lineClearStartTime: null,
      },
      status: "playing",
    };
  },

  CreateGarbageRow: (state, action) => {
    const newCells = new Uint8Array(200);

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

    // Update active piece position if it exists (move it up)
    const newActive = state.active
      ? { ...state.active, y: state.active.y - 1 }
      : undefined;

    return {
      ...state,
      active: newActive,
      board: { ...state.board, cells: newCells },
    };
  },

  HardDrop: (state, action) => {
    if (!state.active) return state;

    const timestampMs = action.timestampMs;
    const droppedPiece = dropToBottom(state.board, state.active);

    const stateWithHardDrop = {
      ...state,
      processedInputLog: [...state.processedInputLog, action],
    };

    const lockedState = lockCurrentPiece(
      stateWithHardDrop,
      droppedPiece,
      timestampMs,
    );
    return { ...lockedState, tick: state.tick + 1 };
  },

  // Hold system
  Hold: (state, _action) => {
    if (!state.active || !state.canHold) {
      return state;
    }

    const currentPieceId = state.active.id;
    let newActive: ActivePiece | undefined;
    const holdQueue = [...state.nextQueue];
    let newRng: PieceRandomGenerator = state.rng;

    if (state.hold !== undefined) {
      newActive = createActivePiece(state.hold);
    } else {
      const result = getNextPieceFromQueue(holdQueue, newRng);
      if (!result) return state;
      newActive = result.newActive;
      holdQueue.push(result.newPiece);
      newRng = result.newRng;
    }

    if (!canSpawnPiece(state.board, newActive.id)) {
      return { ...state, status: "topOut" };
    }

    return {
      ...state,
      active: newActive,
      canHold: false,
      hold: currentPieceId,
      nextQueue: holdQueue,
      physics: {
        ...state.physics,
        lockDelayStartTime: null,
      },
      rng: newRng,
    };
  },

  HoldMove: (state, action) => {
    // Same logic as TapMove
    if (state.active === undefined) {
      return state;
    }

    const stepped = tryMove(state.board, state.active, action.dir, 0);
    if (!stepped) {
      return state;
    }

    const newPhysics =
      state.physics.lockDelayStartTime !== null
        ? {
            ...state.physics,
            lockDelayStartTime: null,
          }
        : state.physics;

    return {
      ...state,
      active: stepped,
      physics: newPhysics,
      processedInputLog: [...state.processedInputLog, action],
    };
  },

  // Physics actions
  HoldStart: (state, _action) => state, // Analytics/logging only

  // Core game actions
  Init: (state, action) =>
    createInitialState(action.seed, {
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

    const timestampMs = action.timestampMs;
    const stateWithIncrementedTick = { ...state, tick: state.tick + 1 };
    return lockCurrentPiece(
      stateWithIncrementedTick,
      state.active,
      timestampMs,
    );
  },

  // Statistics
  RecordPieceLock: (state, action) => {
    const faultCounts: Partial<Record<FaultType, number>> = {
      ...state.stats.faultsByType,
    };

    for (const fault of action.faults) {
      faultCounts[fault] = (faultCounts[fault] ?? 0) + 1;
    }

    const newStats = applyStatsBaseUpdate(state.stats, {
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

  RepeatMove: (state, action) => {
    // Same logic as TapMove
    if (state.active === undefined) {
      return state;
    }

    const stepped = tryMove(state.board, state.active, action.dir, 0);
    if (!stepped) {
      return state;
    }

    const newPhysics =
      state.physics.lockDelayStartTime !== null
        ? {
            ...state.physics,
            lockDelayStartTime: null,
          }
        : state.physics;

    return {
      ...state,
      active: stepped,
      physics: newPhysics,
      processedInputLog: [...state.processedInputLog, action],
    };
  },

  // Rotation actions
  Rotate: (state, action) => {
    if (!state.active) return state;

    const targetRot = getNextRotation(state.active.rot, action.dir);
    const rotatedPiece = tryRotate(state.active, targetRot, state.board);

    if (!rotatedPiece) return state;

    const newPhysicsRotate =
      state.physics.lockDelayStartTime !== null
        ? { ...state.physics, lockDelayStartTime: null }
        : state.physics;

    return {
      ...state,
      active: rotatedPiece,
      physics: newPhysicsRotate,
      processedInputLog: [...state.processedInputLog, action],
    };
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
          processedInputLog: [...state.processedInputLog, action],
        };
      }

      const softDroppedPiece = tryMove(state.board, state.active, 0, 1);
      return {
        ...state,
        active: softDroppedPiece ?? state.active,
        physics: {
          ...state.physics,
          isSoftDropping: true,
          lockDelayStartTime: softDroppedPiece
            ? null
            : state.physics.lockDelayStartTime,
        },
        processedInputLog: [...state.processedInputLog, action],
      };
    }

    return {
      ...state,
      physics: { ...state.physics, isSoftDropping: false },
    };
  },

  Spawn: (state, action) => {
    if (state.active || state.status !== "playing") {
      return state;
    }

    let pieceToSpawn: PieceId;
    let spawnRng: PieceRandomGenerator = state.rng;
    const newQueue = [...state.nextQueue];

    if (action.piece !== undefined) {
      pieceToSpawn = action.piece;
    } else {
      if (newQueue.length === 0) return state;
      const nextFromQueue = newQueue.shift();
      if (nextFromQueue === undefined) return state;
      pieceToSpawn = nextFromQueue;

      while (newQueue.length < 5) {
        const { newRng: updatedRng, piece } = spawnRng.getNextPiece();
        newQueue.push(piece);
        spawnRng = updatedRng;
      }
    }

    if (isTopOut(state.board, pieceToSpawn)) {
      return { ...state, status: "topOut" };
    }

    const newPiece = createActivePiece(pieceToSpawn);
    return {
      ...state,
      active: newPiece,
      nextQueue: newQueue,
      physics: {
        ...state.physics,
        lastGravityTime: state.physics.lastGravityTime,
        lockDelayStartTime: null,
      },
      rng: spawnRng,
    };
  },

  // Line clear actions
  StartLineClear: (state, action) => ({
    ...state,
    physics: {
      ...state.physics,
      lineClearLines: action.lines,
      lineClearStartTime: action.timestampMs,
    },
    status: "lineClear",
  }),

  // Physics actions
  StartLockDelay: (state, action) => ({
    ...state,
    physics: {
      ...state.physics,
      lockDelayStartTime: action.timestampMs,
    },
  }),

  // Movement actions
  TapMove: (state, action) => {
    // Only process if we have an active piece
    if (state.active === undefined) {
      return state;
    }

    // Always apply a single-cell move; DAS/ARR repeats are produced by the Input Handler
    const stepped = tryMove(state.board, state.active, action.dir, 0);
    if (!stepped) {
      return state; // Can't move
    }

    // Cancel lock delay if piece moves
    const newPhysics =
      state.physics.lockDelayStartTime !== null
        ? {
            ...state.physics,
            lockDelayStartTime: null,
          }
        : state.physics;

    return {
      ...state,
      active: stepped,
      physics: newPhysics,
      processedInputLog: [...state.processedInputLog, action],
    };
  },

  Tick: (state, action) => {
    if (typeof state.tick !== "number") {
      return state;
    }

    const timestampMs = action.timestampMs;
    const updatedStats = updateSessionStats(state.stats, timestampMs);
    let newState = {
      ...state,
      stats: updatedStats,
      tick: state.tick + 1,
    };

    if (shouldApplyGravity(state)) {
      newState = applyGravityLogic(newState, timestampMs);
    }

    return newState;
  },

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
      return createInitialState(action.seed, {
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

  return dispatch(action.type, state, action);
};
