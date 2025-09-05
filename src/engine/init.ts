import { createEmptyBoard } from "../core/board";
import { createSevenBagRng } from "../core/rng";
import { createDurationMs } from "../types/brands";

import { Airborne } from "./physics/lock-delay.machine";
import { applyDelta } from "./scoring/stats";

import type { PieceRandomGenerator } from "../core/rng-interface";
import type {
  PlayingState,
  Stats,
  TimingConfig,
  GameplayConfig,
  PhysicsState,
} from "../state/types";
import type { Seed } from "../types/brands";
import type { Timestamp } from "../types/timestamp";

export const defaultTimingConfig: TimingConfig = {
  arrMs: createDurationMs(2),
  dasMs: createDurationMs(133),
  gravityEnabled: false, // Default OFF per DESIGN.md to focus on finesse
  gravityMs: createDurationMs(500), // Slower gravity for visibility in training
  lineClearDelayMs: createDurationMs(0),
  lockDelayMaxResets: 15, // Matches Tetris Guideline behavior
  lockDelayMs: createDurationMs(500),
  // Default soft drop multiplier relative to gravity
  softDrop: 10,
  tickHz: 60,
};

export const defaultGameplayConfig: GameplayConfig = {
  finesseBoopEnabled: false,
  finesseCancelMs: createDurationMs(50),
  finesseFeedbackEnabled: true,
  ghostPieceEnabled: true,
  guidedColumnHighlightEnabled: true,
  holdEnabled: true,
  nextPieceCount: 5,
  openingCoachingEnabled: false,
  retryOnFinesseError: false,
};

export function createInitialPhysics(timestampMs: Timestamp): PhysicsState {
  return {
    activePieceSpawnedAt: null,
    isSoftDropping: false,
    lastGravityTime: timestampMs,
    lineClearLines: [],
    lineClearStartTime: null,
    lockDelay: Airborne(), // Single ADT centralizes LD state instead of scattered flags
  };
}

export function createInitialState(
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
    ? applyDelta(
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
    : applyDelta(defaults, {});

  // Recalculate derived metrics to ensure they're correct
  const initialStats = applyDelta(baseStats, {});

  const finalGameplay = { ...defaultGameplayConfig, ...gameplay };

  return {
    active: undefined,
    board: createEmptyBoard(),
    boardDecorations: null,
    canHold: finalGameplay.holdEnabled,
    currentMode: mode ?? "freePlay",
    finesseFeedback: null,
    gameplay: finalGameplay,
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
    uiEffects: [],
  };
}
