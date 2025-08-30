import { createSevenBagRng, type SevenBagRng } from "../src/core/rng";
import { Airborne } from "../src/engine/physics/lock-delay.machine";
import { createBoardCells, buildPlayingState } from "../src/state/types";
import { createSeed, createDurationMs } from "../src/types/brands";
import { fromNow, createTimestamp } from "../src/types/timestamp";

import type {
  GameState,
  Action,
  ActivePiece,
  PhysicsState,
  PieceId,
  TimingConfig,
  BaseShared,
} from "../src/state/types";

// Assertion helper that provides runtime type narrowing
export function assertDefined<T>(
  value: T | undefined | null,
  message?: string,
): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(message ?? "Expected value to be defined");
  }
}

// Assert that a game state has an active piece
export function assertActivePiece(
  state: GameState,
  message?: string,
): asserts state is GameState & { active: ActivePiece } {
  if (!state.active) {
    throw new Error(message ?? "Expected state to have an active piece");
  }
}

// Assert that a game state has a held piece
export function assertHasPiece(
  state: GameState,
  message?: string,
): asserts state is GameState & { hold: PieceId } {
  if (state.hold === undefined) {
    throw new Error(message ?? "Expected state to have a held piece");
  }
}

// Assert that RNG has a valid current bag
export function assertValidBag(
  rng: SevenBagRng,
  message?: string,
): asserts rng is SevenBagRng & { currentBag: Array<PieceId> } {
  if (rng.currentBag.length === 0) {
    throw new Error(message ?? "Expected RNG to have a valid bag");
  }
  for (const piece of rng.currentBag) {
    if (!["I", "O", "T", "S", "Z", "J", "L"].includes(piece)) {
      throw new Error(message ?? `Invalid piece in bag: ${piece}`);
    }
  }
}

// Safe property access with default value
export function getOrDefault<T, K extends keyof T>(
  obj: T | undefined | null,
  key: K,
  defaultValue: T[K],
): T[K] {
  if (obj === undefined || obj === null) return defaultValue;
  return obj[key] ?? defaultValue;
}

// Safe array access with bounds checking
export function safeArrayAccess<T>(
  arr: Array<T> | undefined | null,
  index: number,
  defaultValue: T,
): T {
  if (!arr || index < 0 || index >= arr.length) {
    return defaultValue;
  }
  return arr[index] ?? defaultValue;
}

// Type-safe property existence check
export function hasProperty<
  T extends Record<string, unknown>,
  K extends PropertyKey,
>(obj: T, key: K): obj is T & Record<K, unknown> {
  return key in obj;
}

// Assert a value is not null or undefined with custom error
export function assertNotNull<T>(
  value: T | null | undefined,
  name: string,
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`${name} should not be null or undefined`);
  }
}

// Assert array has minimum length
export function assertArrayLength<T>(
  arr: Array<T> | undefined | null,
  minLength: number,
  message?: string,
): asserts arr is Array<T> {
  if (!arr || arr.length < minLength) {
    throw new Error(
      message ??
        `Expected array to have at least ${String(minLength)} elements, got ${String(arr?.length ?? 0)}`,
    );
  }
}

// Type guard for checking if value is a number
export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

// Type guard for checking if value is a valid tick
export function isValidTick(value: unknown): value is number {
  return isNumber(value) && value >= 0 && Number.isInteger(value);
}

// Assert that a value matches an expected type with a custom validator
export function assertType<T>(
  value: unknown,
  validator: (v: unknown) => v is T,
  message?: string,
): asserts value is T {
  if (!validator(value)) {
    throw new Error(message ?? "Value does not match expected type");
  }
}

// Helper to create test Init actions with proper timestamp
export function createTestInitAction(
  overrides: Partial<Extract<Action, { type: "Init" }>> = {},
): Extract<Action, { type: "Init" }> {
  return {
    seed: createSeed("test"),
    timestampMs: fromNow(),
    type: "Init",
    ...overrides,
  };
}

// Helper for creating properly typed Spawn actions with timestamps
export function createTestSpawnAction(
  piece?: PieceId,
  timestamp?: number,
): Extract<Action, { type: "Spawn" }> {
  const currentTime =
    timestamp !== undefined ? createTimestamp(timestamp) : fromNow();
  return {
    timestampMs: currentTime,
    type: "Spawn",
    ...(piece !== undefined ? { piece } : {}),
  };
}

// Helper for creating test PhysicsState with all required fields
export function createTestPhysicsState(
  overrides: Partial<PhysicsState> = {},
): PhysicsState {
  return {
    activePieceSpawnedAt: null,
    isSoftDropping: false,
    lastGravityTime: fromNow(),
    lineClearLines: [],
    lineClearStartTime: null,
    lockDelay: Airborne(),
    ...overrides,
  };
}

// Helper for creating test TimingConfig with all required fields
export function createTestTimingConfig(
  overrides: Partial<TimingConfig> = {},
): TimingConfig {
  return {
    arrMs: createDurationMs(2),
    dasMs: createDurationMs(133),
    gravityEnabled: false,
    gravityMs: createDurationMs(500),
    lineClearDelayMs: createDurationMs(0),
    lockDelayMaxResets: 15,
    lockDelayMs: createDurationMs(500),
    softDrop: 10,
    tickHz: 60,
    ...overrides,
  };
}

// Helper for creating RetryPendingLock actions with timestamps
export function createTestRetryAction(
  timestamp?: number,
): Extract<Action, { type: "RetryPendingLock" }> {
  const currentTime =
    timestamp !== undefined ? createTimestamp(timestamp) : fromNow();
  return {
    timestampMs: currentTime,
    type: "RetryPendingLock",
  };
}

// Helper for creating Rotate actions with timestamps
export function createTestRotateAction(
  dir: "CW" | "CCW",
  timestamp?: number,
): Extract<Action, { type: "Rotate" }> {
  const currentTime =
    timestamp !== undefined ? createTimestamp(timestamp) : fromNow();
  return {
    dir,
    timestampMs: currentTime,
    type: "Rotate",
  };
}

// Helper for creating SoftDrop actions with timestamps
export function createTestSoftDropAction(
  on: boolean,
  timestamp?: number,
): Extract<Action, { type: "SoftDrop" }> {
  const currentTime =
    timestamp !== undefined ? createTimestamp(timestamp) : fromNow();
  return {
    on,
    timestampMs: currentTime,
    type: "SoftDrop",
  };
}

// Helper for creating TapMove actions with timestamps
export function createTestTapMoveAction(
  dir: -1 | 1,
  optimistic = false,
  timestamp?: number,
): Extract<Action, { type: "TapMove" }> {
  const currentTime =
    timestamp !== undefined ? createTimestamp(timestamp) : fromNow();
  return {
    dir,
    optimistic,
    timestampMs: currentTime,
    type: "TapMove",
  };
}

// Helper for creating HoldMove actions with timestamps
export function createTestHoldMoveAction(
  dir: -1 | 1,
  timestamp?: number,
): Extract<Action, { type: "HoldMove" }> {
  const currentTime =
    timestamp !== undefined ? createTimestamp(timestamp) : fromNow();
  return {
    dir,
    timestampMs: currentTime,
    type: "HoldMove",
  };
}

// Helper for creating RepeatMove actions with timestamps
export function createTestRepeatMoveAction(
  dir: -1 | 1,
  timestamp?: number,
): Extract<Action, { type: "RepeatMove" }> {
  const currentTime =
    timestamp !== undefined ? createTimestamp(timestamp) : fromNow();
  return {
    dir,
    timestampMs: currentTime,
    type: "RepeatMove",
  };
}

// Helper for creating HoldStart actions with timestamps
export function createTestHoldStartAction(
  dir: -1 | 1,
  timestamp?: number,
): Extract<Action, { type: "HoldStart" }> {
  const currentTime =
    timestamp !== undefined ? createTimestamp(timestamp) : fromNow();
  return {
    dir,
    timestampMs: currentTime,
    type: "HoldStart",
  };
}

// Helper for creating HardDrop actions with timestamps
export function createTestHardDropAction(
  timestamp?: number,
): Extract<Action, { type: "HardDrop" }> {
  const currentTime =
    timestamp !== undefined ? createTimestamp(timestamp) : fromNow();
  return {
    timestampMs: currentTime,
    type: "HardDrop",
  };
}

// Helper for creating Tick actions with timestamps
export function createTestTickAction(
  timestamp?: number,
): Extract<Action, { type: "Tick" }> {
  const currentTime =
    timestamp !== undefined ? createTimestamp(timestamp) : fromNow();
  return {
    timestampMs: currentTime,
    type: "Tick",
  };
}

// Helper for creating a complete test GameState using builders
export function createTestGameState(
  baseOverrides: Partial<BaseShared> = {},
  activeOverrides: { active?: ActivePiece } = {},
): GameState {
  const base: BaseShared = {
    board: {
      cells: createBoardCells(),
      height: 20,
      width: 10,
    },
    boardDecorations: null,
    canHold: true,
    currentMode: "test",
    finesseFeedback: null,
    gameplay: {
      finesseCancelMs: createDurationMs(50),
      holdEnabled: true,
    },
    guidance: null,
    hold: undefined,
    modeData: null,
    modePrompt: null,
    nextQueue: [],
    physics: createTestPhysicsState(),
    processedInputLog: [],
    rng: createSevenBagRng("test"),
    stats: {
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
      piecesPerMinute: 0,
      piecesPlaced: 0,
      sessionLinesCleared: 0,
      sessionPiecesPlaced: 0,
      sessionStartMs: createTimestamp(1),
      singleLines: 0,
      startedAtMs: createTimestamp(1),
      tetrisLines: 0,
      timePlayedMs: createDurationMs(0),
      totalFaults: 0,
      totalInputs: 0,
      totalSessions: 0,
      tripleLines: 0,
    },
    tick: 0,
    timing: createTestTimingConfig(),
    uiEffects: [],
    ...baseOverrides,
  };

  return buildPlayingState(base, activeOverrides);
}
