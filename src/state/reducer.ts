import {
  GameState,
  Action,
  TimingConfig,
  GameplayConfig,
  PhysicsState,
  PieceId,
  ActivePiece,
  Stats,
} from "./types";
import type { Timestamp } from "../types/timestamp";
import type { FaultType } from "../finesse/calculator";
import {
  createEmptyBoard,
  tryMove,
  dropToBottom,
  lockPiece,
  getCompletedLines,
  clearLines,
} from "../core/board";
import { PIECES } from "../core/pieces";
import { tryRotate, getNextRotation } from "../core/srs";
import {
  createRng,
  getNextPiece,
  getNextPieces,
  SevenBagRng,
} from "../core/rng";
import { createActivePiece, canSpawnPiece, isTopOut } from "../core/spawning";

// Default timing configuration
const defaultTimingConfig: TimingConfig = {
  tickHz: 60,
  dasMs: 133,
  arrMs: 2,
  // Default soft drop multiplier relative to gravity
  softDrop: 10,
  lockDelayMs: 500,
  lineClearDelayMs: 0,
  gravityEnabled: false, // Gravity OFF by default per DESIGN.md
  gravityMs: 500, // 500ms gravity for visibility
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
    lastGravityTime: 0,
    lockDelayStartTime: null,
    isSoftDropping: false,
    lineClearStartTime: null,
    lineClearLines: [],
  };
}

// Helper to calculate derived stats
function calculateDerivedStats(
  stats: GameState["stats"],
): Partial<GameState["stats"]> {
  const {
    optimalPlacements,
    attempts,
    totalInputs,
    optimalInputs,
    piecesPlaced,
    timePlayedMs,
    sessionPiecesPlaced,
    sessionLinesCleared,
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
    finesseAccuracy,
    averageInputsPerPiece,
    piecesPerMinute,
    linesPerMinute,
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
  seed?: string,
  timing?: Partial<TimingConfig>,
  gameplay?: Partial<GameplayConfig>,
  mode?: string,
  previousStats?: Stats,
): GameState {
  const rng = createRng(seed ?? "default");
  const { pieces: initialQueue, newRng } = getNextPieces(rng, 5); // Generate 5-piece preview

  // Create default stats with all fields zeroed
  const defaults: Stats = {
    // Basic counters
    piecesPlaced: 0,
    linesCleared: 0,
    optimalPlacements: 0,
    incorrectPlacements: 0,
    attempts: 0,
    startedAtMs: 0,
    timePlayedMs: 0,

    // Session-specific counters
    sessionPiecesPlaced: 0,
    sessionLinesCleared: 0,

    // Comprehensive metrics
    accuracyPercentage: 0,
    finesseAccuracy: 0,
    averageInputsPerPiece: 0,

    // Session tracking
    sessionStartMs: 0,
    totalSessions: 1,
    longestSessionMs: 0,

    // Performance data
    piecesPerMinute: 0,
    linesPerMinute: 0,
    totalInputs: 0,
    optimalInputs: 0,

    // Fault tracking
    totalFaults: 0,
    faultsByType: {},

    // Line clear statistics
    singleLines: 0,
    doubleLines: 0,
    tripleLines: 0,
    tetrisLines: 0,
  };

  // Merge with previous stats if provided, ensuring all new fields are normalized
  const baseStats = previousStats
    ? applyStatsBaseUpdate(
        {
          ...defaults,
          ...previousStats,
          // Reset session-specific stats
          timePlayedMs: 0,
          sessionStartMs: 0,
          sessionPiecesPlaced: 0,
          sessionLinesCleared: 0,
          totalSessions: (previousStats.totalSessions ?? 0) + 1,
        },
        {},
      )
    : applyStatsBaseUpdate(defaults, {});

  // Recalculate derived metrics to ensure they're correct
  const initialStats = applyStatsBaseUpdate(baseStats, {});

  return {
    board: createEmptyBoard(),
    active: undefined,
    hold: undefined,
    canHold: true,
    nextQueue: initialQueue,
    rng: newRng,
    timing: { ...defaultTimingConfig, ...timing },
    gameplay: { ...defaultGameplayConfig, ...gameplay },
    tick: 0,
    status: "playing",
    stats: initialStats,
    physics: createInitialPhysics(),
    processedInputLog: [],
    currentMode: mode ?? "freePlay",
    modeData: null,
    finesseFeedback: null,
    modePrompt: null,
  };
}

export const reducer: (
  state: Readonly<GameState> | undefined,
  action: Action,
) => GameState = (
  state: Readonly<GameState> | undefined,
  action: Action,
): GameState => {
  // Defensive: if action is malformed, return state unchanged (including undefined)
  const isValidAction =
    action &&
    typeof action === "object" &&
    "type" in (action as Record<string, unknown>);
  if (!isValidAction) {
    return state as unknown as GameState;
  }
  if (state === undefined) {
    // Only initialize on Init; otherwise preserve undefined
    if (action.type === "Init") {
      return createInitialState(
        action.seed,
        action.timing,
        action.gameplay,
        action.mode,
        undefined, // state is undefined, so no previous stats to retain
      );
    }
    return state as unknown as GameState;
  }

  // Helper: determine if locking the given piece would top-out (any cell at y < 0)
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

  // Helper: lock active piece, handle line clears (immediate if delay=0), reset piece/hold, and set status/topOut
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
      board: lockedBoard,
      active: undefined,
      canHold: true,
      stats: newStats,
      physics: {
        ...baseState.physics,
        lockDelayStartTime: null,
      },
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
        status: "playing",
        physics: {
          ...nextState.physics,
          lineClearStartTime: null,
          lineClearLines: [],
        },
      };
    }

    // Stage line clear animation
    return {
      ...nextState,
      status: "lineClear",
      physics: {
        ...nextState.physics,
        lineClearStartTime: timestampMs,
        lineClearLines: completedLines,
      },
    };
  };

  // Helper: Apply movement to the active piece
  const applyMovement = (baseState: GameState, dir: -1 | 1): GameState => {
    // Only process if we have an active piece and valid state
    if (!baseState?.active) {
      return baseState;
    }

    // Always apply a single-cell move; DAS/ARR repeats are produced by the Input Handler
    const stepped = tryMove(baseState.board, baseState.active, dir, 0);
    if (!stepped) {
      return baseState; // Can't move
    }

    // Cancel lock delay if piece moves
    const newPhysics = baseState.physics.lockDelayStartTime
      ? {
          ...baseState.physics,
          lockDelayStartTime: null,
        }
      : baseState.physics;

    return {
      ...baseState,
      active: stepped,
      physics: newPhysics,
    };
  };

  switch (action.type) {
    case "UpdateTiming":
      return {
        ...state,
        timing: { ...state.timing, ...action.timing },
      };

    case "UpdateGameplay":
      return {
        ...state,
        gameplay: { ...state.gameplay, ...action.gameplay },
      };

    case "Init":
      return createInitialState(
        action.seed,
        action.timing,
        action.gameplay,
        action.mode,
        action.retainStats ? state.stats : undefined,
      );

    case "Lock": {
      // Defensive: only process if state has valid tick property and active piece
      if (
        !state ||
        typeof state !== "object" ||
        typeof state.tick !== "number" ||
        !state.active
      ) {
        return state;
      }
      // Lock the active piece using the proper lockCurrentPiece function
      const timestampMs = action.timestampMs;
      return {
        ...lockCurrentPiece(state, state.active, timestampMs),
        tick: state.tick + 1,
      };
    }

    case "Tick": {
      // Defensive: only process if state has valid tick property
      if (
        !state ||
        typeof state !== "object" ||
        typeof state.tick !== "number"
      ) {
        return state;
      }
      const timestampMs = action.timestampMs;

      // Initialize session and game start time on first tick
      const sessionStartMs =
        state.stats.sessionStartMs === 0
          ? timestampMs
          : state.stats.sessionStartMs;
      const gameStartMs =
        state.stats.startedAtMs === 0 ? timestampMs : state.stats.startedAtMs;

      // Update session time
      const sessionTimeMs = timestampMs - sessionStartMs;
      const updatedTimeMs = Math.max(0, sessionTimeMs);

      const newStats = applyStatsBaseUpdate(state.stats, {
        startedAtMs: gameStartMs,
        sessionStartMs,
        timePlayedMs: updatedTimeMs,
        longestSessionMs: Math.max(state.stats.longestSessionMs, updatedTimeMs),
      });

      let newState = {
        ...state,
        tick: state.tick + 1,
        stats: newStats,
      };

      // Handle gravity if enabled and piece exists
      if (
        state.timing.gravityEnabled &&
        state.active &&
        state.status === "playing"
      ) {
        const timeSinceLastGravity =
          timestampMs - state.physics.lastGravityTime;
        // Compute interval considering soft drop settings
        let gravityInterval = state.timing.gravityMs;
        if (state.physics.isSoftDropping) {
          if (state.timing.softDrop === "infinite") {
            // Infinite soft-drop handled on key press
            gravityInterval = 1;
          } else {
            const m = Math.max(1, state.timing.softDrop);
            gravityInterval = Math.max(
              1,
              Math.floor(state.timing.gravityMs / m),
            );
          }
        }

        if (timeSinceLastGravity >= gravityInterval) {
          const movedPiece = tryMove(state.board, state.active, 0, 1);
          if (movedPiece) {
            newState = {
              ...newState,
              active: movedPiece,
              physics: {
                ...newState.physics,
                lastGravityTime: timestampMs,
              },
            };
          } else if (!state.physics.lockDelayStartTime) {
            // Hit bottom, start lock delay
            newState = {
              ...newState,
              physics: {
                ...newState.physics,
                lockDelayStartTime: timestampMs,
              },
            };
          }
        }

        // Check lock delay timeout
        if (
          state.physics.lockDelayStartTime &&
          timestampMs - state.physics.lockDelayStartTime >=
            state.timing.lockDelayMs
        ) {
          // Auto-lock the piece and handle line clears/top-out
          if (newState.active) {
            newState = lockCurrentPiece(newState, newState.active, timestampMs);
          }
        }
      }

      return newState;
    }

    case "Spawn": {
      // Only spawn if no active piece and game is playing
      if (state.active || state.status !== "playing") {
        return state;
      }

      let pieceToSpawn: PieceId;
      let spawnRng: SevenBagRng = state.rng;
      const newQueue = [...state.nextQueue];

      if (action.piece) {
        // Manual piece spawn (for testing) - don't advance queue/RNG
        pieceToSpawn = action.piece;
      } else {
        // Take next piece from queue for normal gameplay
        if (newQueue.length === 0) {
          return state; // No pieces available
        }
        const nextFromQueue = newQueue.shift();
        if (!nextFromQueue) return state;
        pieceToSpawn = nextFromQueue;

        // Refill queue to maintain exactly 5 pieces for preview
        while (newQueue.length < 5) {
          const { piece, newRng: updatedRng } = getNextPiece(spawnRng);
          newQueue.push(piece);
          spawnRng = updatedRng;
        }
      }

      // Check for top-out
      if (isTopOut(state.board, pieceToSpawn)) {
        return {
          ...state,
          status: "topOut",
        };
      }

      const newPiece = createActivePiece(pieceToSpawn);
      return {
        ...state,
        active: newPiece,
        nextQueue: newQueue,
        rng: spawnRng,
        physics: {
          ...state.physics,
          lockDelayStartTime: null,
          lastGravityTime: state.physics.lastGravityTime, // Keep existing time - spawning doesn't need to update gravity timer
        },
      };
    }

    // Processed move actions are appended to processedInputLog here (in the reducer).
    // Input handlers should not log separately to avoid duplication.
    case "TapMove":
    case "HoldMove":
    case "RepeatMove": {
      const newState = applyMovement(state, action.dir);
      // If movement didn't change state (no active piece or blocked), don't log the action
      if (newState === state) {
        return state;
      }
      return {
        ...newState,
        processedInputLog: [...newState.processedInputLog, action],
      };
    }

    case "HoldStart": {
      // Analytics/logging only - return state unchanged
      return state;
    }

    case "Rotate": {
      // Only process if we have an active piece
      if (!state.active) {
        return state;
      }

      const targetRot = getNextRotation(state.active.rot, action.dir);
      const rotatedPiece = tryRotate(state.active, targetRot, state.board);

      if (!rotatedPiece) {
        return state; // Can't rotate
      }

      // Cancel lock delay if piece rotates
      const newPhysicsRotate = state.physics.lockDelayStartTime
        ? {
            ...state.physics,
            lockDelayStartTime: null,
          }
        : state.physics;

      return {
        ...state,
        active: rotatedPiece,
        physics: newPhysicsRotate,
      };
    }

    case "HardDrop": {
      // Only process if we have an active piece
      if (!state.active) {
        return state;
      }

      const timestampMs = action.timestampMs;
      const droppedPiece = dropToBottom(state.board, state.active);
      return {
        ...lockCurrentPiece(state, droppedPiece, timestampMs),
        tick: state.tick + 1,
      };
    }

    case "SoftDrop": {
      // Only process if we have an active piece
      if (!state.active) {
        return state;
      }

      if (action.on) {
        // Soft drop pressed
        if (state.timing.softDrop === "infinite") {
          // Teleport piece to bottom without locking
          const toBottom = dropToBottom(state.board, state.active);
          return {
            ...state,
            active: toBottom,
            physics: {
              ...state.physics,
              isSoftDropping: true,
            },
          };
        }
        // Finite soft drop - move down one cell immediately
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

      // Soft drop off
      return {
        ...state,
        physics: {
          ...state.physics,
          isSoftDropping: false,
        },
      };
    }

    case "Hold": {
      // Only process if we have an active piece and can hold
      if (!state.active || !state.canHold) {
        return state;
      }

      const currentPieceId = state.active.id;
      let newActive: ActivePiece | undefined;
      const holdQueue = [...state.nextQueue];
      let newRng: SevenBagRng = state.rng;

      if (state.hold) {
        // Swap with held piece
        newActive = createActivePiece(state.hold);
      } else {
        // Take next piece from queue for first hold
        if (holdQueue.length === 0) {
          return state; // No pieces available
        }
        const nextPiece = holdQueue.shift();
        if (!nextPiece) return state;
        newActive = createActivePiece(nextPiece);

        // Refill queue
        const { piece, newRng: updatedRng } = getNextPiece(newRng);
        holdQueue.push(piece);
        newRng = updatedRng;
      }

      // Check if new piece can spawn
      if (!canSpawnPiece(state.board, newActive.id)) {
        return {
          ...state,
          status: "topOut",
        };
      }

      return {
        ...state,
        active: newActive,
        hold: currentPieceId,
        canHold: false,
        nextQueue: holdQueue,
        rng: newRng,
        physics: {
          ...state.physics,
          lockDelayStartTime: null,
        },
      };
    }

    case "ClearLines": {
      const clearedBoard = clearLines(state.board, action.lines);
      return {
        ...state,
        board: clearedBoard,
      };
    }

    case "SetMode": {
      return {
        ...state,
        currentMode: action.mode,
        finesseFeedback: null,
        modePrompt: null,
      };
    }

    case "UpdateFinesseFeedback": {
      return {
        ...state,
        finesseFeedback: action.feedback,
      };
    }

    case "UpdateModePrompt": {
      return {
        ...state,
        modePrompt: action.prompt,
      };
    }

    case "UpdateGuidance": {
      return {
        ...state,
        guidance: action.guidance,
      };
    }

    case "UpdateModeData": {
      return {
        ...state,
        modeData: action.data,
      };
    }

    case "StartLineClear": {
      return {
        ...state,
        status: "lineClear",
        physics: {
          ...state.physics,
          lineClearStartTime: action.timestampMs,
          lineClearLines: action.lines,
        },
      };
    }

    case "CompleteLineClear": {
      // Clear the lines and return to playing state
      if (
        state.status !== "lineClear" ||
        state.physics.lineClearLines.length === 0
      ) {
        return state;
      }

      const compactedBoard = clearLines(
        state.board,
        state.physics.lineClearLines,
      );
      return {
        ...state,
        board: compactedBoard,
        status: "playing",
        physics: {
          ...state.physics,
          lineClearStartTime: null,
          lineClearLines: [],
        },
      };
    }

    case "StartLockDelay": {
      return {
        ...state,
        physics: {
          ...state.physics,
          lockDelayStartTime: action.timestampMs,
        },
      };
    }

    case "CancelLockDelay": {
      return {
        ...state,
        physics: {
          ...state.physics,
          lockDelayStartTime: null,
        },
      };
    }

    case "RecordPieceLock": {
      const faultCounts: Partial<Record<FaultType, number>> = {
        ...(state.stats.faultsByType ?? {}),
      };

      // Count faults by type
      for (const fault of action.faults) {
        faultCounts[fault] = (faultCounts[fault] ?? 0) + 1;
      }

      const newStats = applyStatsBaseUpdate(state.stats, {
        attempts: state.stats.attempts + 1,
        optimalPlacements: action.isOptimal
          ? state.stats.optimalPlacements + 1
          : state.stats.optimalPlacements,
        incorrectPlacements: action.isOptimal
          ? state.stats.incorrectPlacements
          : state.stats.incorrectPlacements + 1,
        totalInputs: state.stats.totalInputs + action.inputCount,
        optimalInputs: state.stats.optimalInputs + action.optimalInputCount,
        totalFaults: state.stats.totalFaults + action.faults.length,
        faultsByType: faultCounts,
      });

      return {
        ...state,
        stats: newStats,
      };
    }

    case "ClearInputLog": {
      return {
        ...state,
        processedInputLog: [],
      };
    }

    default:
      // No-op default case - returns state unchanged
      return state;
  }
};
