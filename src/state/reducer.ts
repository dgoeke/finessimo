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
import {
  createDurationMs,
  durationMsAsNumber,
  createGridCoord,
  gridCoordAsNumber,
  type Seed,
} from "../types/brands";
import { createTimestamp } from "../types/timestamp";

import {
  type GameState,
  type PlayingState,
  type LineClearState,
  type TopOutState,
  type Action,
  type TimingConfig,
  type GameplayConfig,
  type PhysicsState,
  type PieceId,
  type ActivePiece,
  type Stats,
  type PendingLock,
  type LockSource,
  createBoardCells,
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
  arrMs: createDurationMs(2),
  dasMs: createDurationMs(133),
  gravityEnabled: false, // Gravity OFF by default per DESIGN.md
  gravityMs: createDurationMs(500), // 500ms gravity for visibility
  lineClearDelayMs: createDurationMs(0),
  lockDelayMs: createDurationMs(500),
  // Default soft drop multiplier relative to gravity
  softDrop: 10,
  tickHz: 60,
};

// Default gameplay configuration
const defaultGameplayConfig: GameplayConfig = {
  finesseBoopEnabled: false,
  finesseCancelMs: createDurationMs(50),
  finesseFeedbackEnabled: true,
  ghostPieceEnabled: true,
  nextPieceCount: 5,
  retryOnFinesseError: false,
};

// Create initial physics state
function createInitialPhysics(timestampMs: Timestamp): PhysicsState {
  return {
    isSoftDropping: false,
    lastGravityTime: timestampMs,
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
  seed: Seed,
  timestampMs: Timestamp,
  config: {
    timing?: Partial<TimingConfig> | undefined;
    gameplay?: Partial<GameplayConfig> | undefined;
    mode?: string | undefined;
    previousStats?: Stats | undefined;
    customRng?: PieceRandomGenerator | undefined;
  } = {},
): PlayingState {
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

    longestSessionMs: createDurationMs(0),
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
    sessionStartMs: timestampMs,
    // Line clear statistics
    singleLines: 0,
    startedAtMs: timestampMs,

    tetrisLines: 0,
    timePlayedMs: createDurationMs(0),

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
          sessionStartMs: timestampMs,
          // Reset session-specific stats
          timePlayedMs: createDurationMs(0),
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
    guidance: null,
    hold: undefined,
    modeData: null,
    modePrompt: null,
    nextQueue: initialQueue,
    pendingLock: null,
    physics: createInitialPhysics(timestampMs),
    processedInputLog: [],
    rng: newRng,
    stats: initialStats,
    status: "playing" as const,
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
): {
  newActive: ActivePiece;
} | null => {
  if (holdQueue.length === 0) return null;

  const nextPiece = holdQueue.shift();
  if (nextPiece === undefined) return null;

  const newActive = createActivePiece(nextPiece);
  return { newActive };
};

const createPendingLock = (
  board: GameState["board"],
  piece: ActivePiece,
  source: LockSource,
  timestampMs: Timestamp,
): PendingLock => {
  const finalPos = source === "hardDrop" ? dropToBottom(board, piece) : piece;
  const simulatedBoard = lockPiece(board, finalPos);
  const completedLines = getCompletedLines(simulatedBoard);

  return {
    completedLines,
    finalPos,
    pieceId: piece.id,
    source,
    timestampMs,
  };
};

const updateSessionStats = (stats: Stats, timestampMs: Timestamp): Stats => {
  const timestampNum = timestampMs as number;
  const sessionStartNum = stats.sessionStartMs as number;
  const sessionTimeMs = timestampNum - sessionStartNum;
  const updatedTimeMs = Math.max(0, sessionTimeMs);

  return applyStatsBaseUpdate(stats, {
    longestSessionMs: createDurationMs(
      Math.max(stats.longestSessionMs as number, updatedTimeMs),
    ),
    timePlayedMs: createDurationMs(updatedTimeMs),
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
  let gravityInterval = durationMsAsNumber(currentState.timing.gravityMs);

  if (currentState.physics.isSoftDropping) {
    if (currentState.timing.softDrop === "infinite") {
      gravityInterval = 1;
    } else {
      const m = Math.max(1, currentState.timing.softDrop);
      gravityInterval = Math.max(
        1,
        Math.floor(durationMsAsNumber(currentState.timing.gravityMs) / m),
      );
    }
  }

  return gravityInterval;
};

const processGravityDrop = (
  currentState: GameState,
  timestampMs: Timestamp,
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
  timestampMs: Timestamp,
): GameState => {
  if (
    currentState.physics.lockDelayStartTime !== null &&
    (timestampMs as number) -
      (currentState.physics.lockDelayStartTime as number) >=
      durationMsAsNumber(currentState.timing.lockDelayMs)
  ) {
    if (currentState.active) {
      // Use pending lock seam for consistent lock flow
      const lockSource: LockSource = currentState.physics.isSoftDropping
        ? "softDrop"
        : "gravity";
      const pending = createPendingLock(
        currentState.board,
        currentState.active,
        lockSource,
        createTimestamp(timestampMs as number),
      );

      return {
        ...currentState,
        active: undefined, // Clear active piece during lock resolution
        pendingLock: pending,
        physics: {
          ...currentState.physics,
          lockDelayStartTime: null,
        },
        status: "resolvingLock",
      };
    }
  }
  return currentState;
};

const applyGravityLogic = (
  currentState: GameState,
  timestampMs: Timestamp,
): GameState => {
  if (!currentState.active) return currentState;

  const timestampNum = timestampMs as number;
  const lastGravityNum = currentState.physics.lastGravityTime as number;
  const timeSinceLastGravity = timestampNum - lastGravityNum;
  const gravityInterval = calculateGravityInterval(currentState);

  if (timeSinceLastGravity >= gravityInterval) {
    return processGravityDrop(currentState, timestampMs);
  }

  return checkLockDelayTimeout(currentState, timestampMs);
};

/**
 * Applies a pending lock without requiring temporary state manipulation.
 * This is a pure function that directly applies the lock logic without
 * needing to temporarily set the active piece.
 */
const applyPendingLock = (
  state: GameState,
  pendingLock: PendingLock,
): GameState => {
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

  const newStats = applyStatsBaseUpdate(state.stats, deltaStats);

  // Base shared fields for all possible next states
  const sharedFields = {
    ...state,
    active: undefined,
    board: lockedBoard,
    canHold: true,
    physics: {
      ...state.physics,
      lockDelayStartTime: null,
    },
    stats: newStats,
  };

  if (topOut) {
    const topOutState: TopOutState = {
      ...sharedFields,
      pendingLock: null,
      status: "topOut" as const,
    };
    return topOutState;
  }

  if (completedLines.length === 0) {
    const playingState: PlayingState = {
      ...sharedFields,
      pendingLock: null,
      status: "playing" as const,
    };
    return playingState;
  }

  if (durationMsAsNumber(state.timing.lineClearDelayMs) === 0) {
    // Immediate clear with no animation delay
    const cleared = clearLines(lockedBoard, completedLines);
    const clearedPlayingState: PlayingState = {
      ...sharedFields,
      board: cleared,
      pendingLock: null,
      physics: {
        ...sharedFields.physics,
        lineClearLines: [],
        lineClearStartTime: null,
      },
      status: "playing" as const,
    };
    return clearedPlayingState;
  }

  // Stage line clear animation
  const lineClearState: LineClearState = {
    ...sharedFields,
    pendingLock: null,
    physics: {
      ...sharedFields.physics,
      lineClearLines: completedLines,
      lineClearStartTime: timestampMs,
      lockDelayStartTime: null,
    },
    status: "lineClear" as const,
  };
  return lineClearState;
};

// Individual action handlers - pure functions
const actionHandlers: ActionHandlerMap = {
  AppendProcessed: (state, action) => ({
    ...state,
    processedInputLog: [...state.processedInputLog, action.entry],
  }),

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

  CommitLock: (state, _action) => {
    if (state.status !== "resolvingLock") {
      return state;
    }

    // Type system now guarantees pendingLock exists when status is 'resolvingLock'

    // Apply the pending lock directly without temporary state manipulation
    return applyPendingLock(state, state.pendingLock);
  },

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
      board: { ...state.board, cells: newCells },
    };
  },

  HardDrop: (state, action) => {
    if (!state.active) return state;

    const stateWithHardDrop = state;

    const pending = createPendingLock(
      state.board,
      state.active,
      "hardDrop",
      action.timestampMs,
    );

    return {
      ...stateWithHardDrop,
      active: undefined, // Clear active piece during lock resolution
      pendingLock: pending,
      physics: {
        ...stateWithHardDrop.physics,
        lockDelayStartTime: null,
      },
      status: "resolvingLock",
      tick: state.tick + 1,
    };
  },

  // Hold system
  Hold: (state, _action) => {
    if (!state.active || !state.canHold) {
      return state;
    }

    const currentPieceId = state.active.id;
    let newActive: ActivePiece | undefined;
    const holdQueue = [...state.nextQueue];

    // Consume from preview if first hold
    if (state.hold !== undefined) {
      newActive = createActivePiece(state.hold);
    } else {
      const result = getNextPieceFromQueue(holdQueue);
      if (!result) return state;
      newActive = result.newActive;
    }

    if (!canSpawnPiece(state.board, newActive.id)) {
      const topOutState: TopOutState = {
        ...state,
        pendingLock: null,
        status: "topOut" as const,
      };
      return topOutState;
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
    };
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

    return {
      ...state,
      active: undefined, // Clear active piece during lock resolution
      pendingLock: pending,
      physics: {
        ...state.physics,
        lockDelayStartTime: null,
      },
      status: "resolvingLock",
      tick: state.tick + 1,
    };
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

  // Append externally provided preview pieces and set RNG
  RefillPreview: (state, action) => ({
    ...state,
    nextQueue: [...state.nextQueue, ...action.pieces],
    rng: action.rng,
  }),

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
    };
  },

  // Replace preview queue and set RNG (e.g., on mode switch)
  ReplacePreview: (state, action) => ({
    ...state,
    nextQueue: [...action.pieces],
    rng: action.rng,
  }),

  RetryPendingLock: (state, _action) => {
    if (state.status !== "resolvingLock") {
      return state;
    }

    // Restore piece to spawn without committing board changes
    const pieceId = state.pendingLock.pieceId;

    return {
      ...state,
      // Restore active piece at spawn position
      active: createActivePiece(pieceId),
      // Unlock hold so player can hold again if needed
      canHold: true,
      // Clear pending lock state
      pendingLock: null,
      // Reset physics state
      physics: {
        ...state.physics,
        lineClearLines: [],
        lineClearStartTime: null,
        lockDelayStartTime: null,
      },
      // Return to playing status
      status: "playing" as const,
      // Note: board and stats remain unchanged - no commitment occurred
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
        pendingLock: null,
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
        lastGravityTime: state.physics.lastGravityTime,
        lockDelayStartTime: null,
      },
    };
  },

  // Line clear actions
  StartLineClear: (state, action) => {
    const lineClearState: LineClearState = {
      ...state,
      pendingLock: null,
      physics: {
        ...state.physics,
        lineClearLines: action.lines,
        lineClearStartTime: action.timestampMs,
      },
      status: "lineClear" as const,
    };
    return lineClearState;
  },

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

  return dispatch(action.type, state, action);
};
