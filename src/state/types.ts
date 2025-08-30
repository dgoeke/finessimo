// Game state
import { gridCoordAsNumber } from "../types/brands";

import type { PieceRandomGenerator } from "../core/rng-interface";
import type { FaultType, FinesseResult } from "../finesse/calculator";
import type {
  GridCoord,
  DurationMs,
  Frame,
  Seed,
  UiEffectId,
} from "../types/brands";
import type { Timestamp } from "../types/timestamp";

// Board representation with enforced dimensions
declare const BoardCellsBrand: unique symbol;
export type BoardCells = Uint8Array & { readonly length: 200 } & {
  readonly [BoardCellsBrand]: true;
};

// BoardCells constructor
export function createBoardCells(): BoardCells {
  return new Uint8Array(200) as BoardCells;
}

export type Board = {
  readonly width: 10;
  readonly height: 20;
  readonly cells: BoardCells; // exactly 200 cells, values: 0..8 (0=empty, 1-7=tetrominos, 8=garbage)
};

// Helper for array indexing with explicit width parameter
export const idx = (x: GridCoord, y: GridCoord, width: 10): number =>
  gridCoordAsNumber(y) * width + gridCoordAsNumber(x);

// Collision check with negative y handling and branded coordinates
export function isCellBlocked(
  board: Board,
  x: GridCoord,
  y: GridCoord,
): boolean {
  const xNum = gridCoordAsNumber(x);
  const yNum = gridCoordAsNumber(y);

  if (xNum < 0 || xNum >= board.width) return true;
  if (yNum >= board.height) return true;
  if (yNum < 0) return false; // above the board = empty for collision
  return board.cells[idx(x, y, board.width)] !== 0;
}

// Pieces and rotation
export type PieceId = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
export type Rot = "spawn" | "right" | "two" | "left";

export type TetrominoShape = {
  id: PieceId;
  cells: Record<Rot, ReadonlyArray<readonly [number, number]>>;
  spawnTopLeft: readonly [number, number];
  color: string;
};

export type ActivePiece = {
  id: PieceId;
  rot: Rot;
  x: GridCoord;
  y: GridCoord;
};

// Config
export type GameplayConfig = {
  finesseCancelMs: DurationMs; // default: 50ms
  // Visual/gameplay toggles used by UI renderers
  ghostPieceEnabled?: boolean; // default true
  nextPieceCount?: number; // default 5 (preview count)
  holdEnabled: boolean; // required - whether hold piece functionality is available
  // Finesse toggles
  finesseFeedbackEnabled?: boolean; // default true
  finesseBoopEnabled?: boolean; // default false
  retryOnFinesseError?: boolean; // default false - retry piece on hard drop finesse errors
};

export type SoftDropSpeed = number | "infinite";

export type TimingConfig = {
  tickHz: 60;
  dasMs: DurationMs;
  arrMs: DurationMs;
  // Soft drop: multiplier of gravity (number) or 'infinite' for instant drop without lock
  softDrop: SoftDropSpeed;
  lockDelayMs: DurationMs;
  lockDelayMaxResets: number; // Maximum number of lock delay resets before forced lock (default: 15)
  lineClearDelayMs: DurationMs;
  gravityEnabled: boolean;
  gravityMs: DurationMs; // Milliseconds between gravity drops
};

// Raw input events from keyboard/touch handlers
export type KeyAction =
  | "LeftDown"
  | "LeftUp"
  | "RightDown"
  | "RightUp"
  | "SoftDropDown"
  | "SoftDropUp"
  | "RotateCW"
  | "RotateCCW"
  | "HardDrop"
  | "Hold";

export type InputEvent = {
  tMs: Timestamp;
  frame: Frame;
  action: KeyAction;
};

// Finesse actions - abstract moves for optimal play analysis
// These map 1:1 to icons/suggestions and make invalid states unrepresentable
export type FinesseAction =
  | "MoveLeft"
  | "MoveRight"
  | "DASLeft"
  | "DASRight"
  | "RotateCW"
  | "RotateCCW"
  | "SoftDrop"
  | "HardDrop";

// Finesse move types for optimal play analysis

// Game mode and finesse feedback
// FinesseUIFeedback has been replaced with FinesseResult from finesse/calculator.ts

// Generic guidance provided by game modes for UI and engine policies
export type ModeGuidance = {
  target?: { x: GridCoord; rot: Rot };
  label?: string; // prompt/description
  visual?: { highlightTarget?: boolean; showPath?: boolean };
};

// Board overlay decorations supplied by game modes for board rendering (pure data)
export type BoardCell = Readonly<{ x: GridCoord; y: GridCoord }>;
export type BoardDecoration = Readonly<{
  type: "cellHighlight";
  cells: ReadonlyArray<BoardCell>;
  color?: string; // optional suggested color
  alpha?: number; // 0..1 suggested
}>;
export type BoardDecorations = ReadonlyArray<BoardDecoration>;

// UI Effects (overlay) — generic union, currently only FloatingText
export type EffectAnchor =
  | "topLeft"
  | "topRight"
  | "bottomLeft"
  | "bottomRight";
export type FloatingTextEffect = Readonly<{
  kind: "floatingText";
  id: UiEffectId;
  text: string;
  color: string;
  fontPx: number;
  fontWeight?: number | string;
  anchor: EffectAnchor;
  offsetX: number; // px from anchor corner (x)
  offsetY: number; // px from anchor corner (y)
  driftYPx: number; // upward drift in px over ttl
  scaleFrom?: number;
  scaleTo?: number;
  ttlMs: DurationMs;
  createdAt: Timestamp;
}>;

/**
 * Line flash effect - displays animated row clearing effects
 */
export type LineFlashEffect = Readonly<{
  kind: "lineFlash";
  id: UiEffectId;
  rows: ReadonlyArray<number>; // 0-based row indices
  color?: string; // hex color, defaults to white
  intensity?: number; // 0..1, flash intensity, defaults to 1.0
  ttlMs: DurationMs;
  createdAt: Timestamp;
}>;

/**
 * Finesse boop effect - displays point effects for finesse feedback
 */
export type FinesseBoopEffect = Readonly<{
  kind: "finesseBoop";
  id: UiEffectId;
  gridX: GridCoord; // grid x position
  gridY: GridCoord; // grid y position
  style: "pulse" | "sparkle" | "fade"; // visual style
  color?: string; // hex color, defaults to yellow
  size?: number; // relative size multiplier, defaults to 1.0
  ttlMs: DurationMs;
  createdAt: Timestamp;
}>;

export type UiEffect = FloatingTextEffect | LineFlashEffect | FinesseBoopEffect;

// Lock delay state ADT - makes invalid combinations unrepresentable
export type LockDelayState =
  | { tag: "Airborne"; resets: number }
  | { tag: "Grounded"; start: Timestamp; resets: number };

// Physics timing state
export type PhysicsState = {
  lastGravityTime: Timestamp;
  lockDelay: LockDelayState; // Replaces lockDelayStartTime + lockDelayResetCount pair
  isSoftDropping: boolean;
  lineClearStartTime: Timestamp | null;
  lineClearLines: ReadonlyArray<number>;
  activePieceSpawnedAt: Timestamp | null; // When current active piece was spawned, for timing analysis
};

export type Stats = {
  // Basic counters
  piecesPlaced: number;
  linesCleared: number;
  optimalPlacements: number;
  incorrectPlacements: number;
  attempts: number;
  startedAtMs: Timestamp;
  timePlayedMs: DurationMs;

  // Session-specific counters for accurate rate calculations
  sessionPiecesPlaced: number;
  sessionLinesCleared: number;

  // Comprehensive metrics
  accuracyPercentage: number; // optimalPlacements / attempts * 100
  finesseAccuracy: number; // optimalInputs / totalInputs * 100
  averageInputsPerPiece: number; // totalInputs / piecesPlaced

  // Session tracking
  sessionStartMs: Timestamp;
  totalSessions: number;
  longestSessionMs: DurationMs;

  // Performance data
  piecesPerMinute: number;
  linesPerMinute: number;
  totalInputs: number;
  optimalInputs: number;

  // Fault tracking
  totalFaults: number;
  faultsByType: Partial<Record<FaultType, number>>; // maps fault types to counts

  // Line clear statistics
  singleLines: number;
  doubleLines: number;
  tripleLines: number;
  tetrisLines: number;
};

// Pending lock system types
export type LockSource = "hardDrop" | "softDrop" | "gravity" | "force";

export type PendingLock = {
  finalPos: ActivePiece; // result of dropToBottom or last grounded pos
  source: LockSource; // origin of lock condition
  completedLines: ReadonlyArray<number>; // lines that would be cleared if committed
  pieceId: PieceId; // convenience for respawn/retry
  timestampMs: Timestamp; // preserve original timestamp for lockCurrentPiece
};

// Base fields shared by ALL game states
export type BaseShared = Readonly<{
  board: Board;
  boardDecorations: BoardDecorations | null;
  gameplay: GameplayConfig;
  guidance: ModeGuidance | null;
  hold: PieceId | undefined;
  canHold: boolean;
  nextQueue: ReadonlyArray<PieceId>;
  physics: PhysicsState;
  rng: PieceRandomGenerator;
  stats: Stats;
  timing: TimingConfig;
  currentMode: string;
  finesseFeedback: FinesseResult | null;
  modeData: unknown;
  modePrompt: string | null;
  processedInputLog: ReadonlyArray<ProcessedAction>;
  tick: number;
  uiEffects: ReadonlyArray<UiEffect>;
}>;

// Playing state - normal gameplay
export type PlayingState = BaseShared &
  Readonly<{
    status: "playing";
    active: ActivePiece | undefined; // you allow none before first spawn
    pendingLock: null;
  }>;

// Resolving lock state - piece is staged for lock resolution
export type ResolvingLockState = BaseShared &
  Readonly<{
    status: "resolvingLock";
    active: undefined;
    pendingLock: PendingLock; // guaranteed
  }>;

// Line clear state - lines are being cleared with delay
export type LineClearState = BaseShared &
  Readonly<{
    status: "lineClear";
    active: undefined;
    pendingLock: null;
  }>;

// Top out state - game over
export type TopOutState = BaseShared &
  Readonly<{
    status: "topOut";
    active: undefined;
    pendingLock: null;
  }>;

// Discriminated union of all game states
export type GameState =
  | PlayingState
  | ResolvingLockState
  | LineClearState
  | TopOutState;

// Type guards for GameState discrimination
export function isPlaying(state: GameState): state is PlayingState {
  return state.status === "playing";
}

export function isResolvingLock(state: GameState): state is ResolvingLockState {
  return state.status === "resolvingLock";
}

export function isLineClear(state: GameState): state is LineClearState {
  return state.status === "lineClear";
}

export function isTopOut(state: GameState): state is TopOutState {
  return state.status === "topOut";
}

// Utility function for exhaustiveness checking
export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${String(x)}`);
}

// Type guards for lock delay state ADT
export function isLockDelayAirborne(
  ld: LockDelayState,
): ld is Extract<LockDelayState, { tag: "Airborne" }> {
  return ld.tag === "Airborne";
}

export function isLockDelayGrounded(
  ld: LockDelayState,
): ld is Extract<LockDelayState, { tag: "Grounded" }> {
  return ld.tag === "Grounded";
}

// Helper functions to maintain compatibility during transition
export function getLockDelayStartTime(ld: LockDelayState): Timestamp | null {
  return ld.tag === "Grounded" ? ld.start : null;
}

export function getLockDelayResetCount(ld: LockDelayState): number {
  return ld.resets;
}

// Type guard to ensure lock delay state is valid (always true with ADT)
export function isValidLockDelayState(physics: PhysicsState): boolean {
  // With the ADT, validate reset count is within bounds for both states
  const resets = physics.lockDelay.resets;
  return resets >= 0 && resets <= 15;
}

// Assertion function for lock delay state validation
export function assertValidLockDelayState(
  physics: PhysicsState,
  context?: string,
): asserts physics is PhysicsState {
  if (!isValidLockDelayState(physics)) {
    throw new Error(
      `Invalid lock delay state${context !== undefined ? ` in ${context}` : ""}: ` +
        `lockDelay=${JSON.stringify(physics.lockDelay)}`,
    );
  }
}

// Type predicate to ensure active piece exists when required
export function hasActivePiece(
  state: GameState,
): state is GameState & { active: ActivePiece } {
  return state.active !== undefined;
}

// Assertion for active piece requirement
export function assertHasActivePiece(
  state: GameState,
  context?: string,
): asserts state is GameState & { active: ActivePiece } {
  if (!hasActivePiece(state)) {
    throw new Error(
      `Active piece required${context !== undefined ? ` for ${context}` : ""}`,
    );
  }
}

// ProcessedAction - normalized actions from input handler for finesse analysis
export type ProcessedAction =
  | { kind: "TapMove"; dir: -1 | 1; t: Timestamp }
  | { kind: "HoldMove"; dir: -1 | 1; t: Timestamp }
  | { kind: "RepeatMove"; dir: -1 | 1; t: Timestamp }
  | { kind: "Rotate"; dir: "CW" | "CCW"; t: Timestamp }
  | { kind: "SoftDrop"; on: boolean; t: Timestamp }
  | { kind: "HardDrop"; t: Timestamp };

// State transitions
export type Action =
  | {
      type: "Init";
      seed: Seed;
      timestampMs: Timestamp;
      timing?: Partial<TimingConfig>;
      gameplay?: Partial<GameplayConfig>;
      mode?: string;
      retainStats?: boolean;
      rng?: PieceRandomGenerator; // Optional custom RNG for testing
    }
  | { type: "Tick"; timestampMs: Timestamp }
  | { type: "Spawn"; piece?: PieceId; timestampMs: Timestamp }
  | {
      type: "TapMove";
      dir: -1 | 1;
      optimistic: boolean;
      timestampMs: Timestamp;
    }
  | { type: "HoldMove"; dir: -1 | 1; timestampMs: Timestamp }
  | { type: "RepeatMove"; dir: -1 | 1; timestampMs: Timestamp }
  | { type: "HoldStart"; dir: -1 | 1; timestampMs: Timestamp }
  | { type: "SoftDrop"; on: boolean; timestampMs: Timestamp }
  | { type: "Rotate"; dir: "CW" | "CCW"; timestampMs: Timestamp }
  | { type: "HardDrop"; timestampMs: Timestamp }
  | { type: "Hold" }
  | { type: "Lock"; timestampMs: Timestamp }
  | { type: "StartLockDelay"; timestampMs: Timestamp }
  | { type: "CancelLockDelay" }
  | {
      type: "StartLineClear";
      lines: ReadonlyArray<number>;
      timestampMs: Timestamp;
    }
  | { type: "CompleteLineClear" }
  | { type: "ClearLines"; lines: ReadonlyArray<number> }
  | { type: "ResetBoard" }
  | { type: "SetMode"; mode: string }
  | { type: "UpdateFinesseFeedback"; feedback: FinesseResult | null }
  | { type: "UpdateModePrompt"; prompt: string | null }
  // Externalized preview refill (mode-owned RNG)
  | {
      type: "RefillPreview";
      pieces: ReadonlyArray<PieceId>;
      rng: PieceRandomGenerator;
    }
  | {
      type: "ReplacePreview";
      pieces: ReadonlyArray<PieceId>;
      rng: PieceRandomGenerator;
    }
  // Settings updates
  | { type: "UpdateTiming"; timing: Partial<TimingConfig> }
  | { type: "UpdateGameplay"; gameplay: Partial<GameplayConfig> }
  // Mode/UI guidance
  | { type: "UpdateGuidance"; guidance: ModeGuidance | null }
  // Board overlay updates supplied by active mode
  | { type: "UpdateBoardDecorations"; decorations: BoardDecorations | null }
  | { type: "UpdateModeData"; data: unknown }
  // UI overlay effects
  | { type: "PushUiEffect"; effect: UiEffect }
  // Statistics tracking actions
  | {
      type: "RecordPieceLock";
      isOptimal: boolean;
      inputCount: number;
      optimalInputCount: number;
      faults: ReadonlyArray<FaultType>;
    }
  | { type: "ClearInputLog" }
  | { type: "AppendProcessed"; entry: ProcessedAction }
  | {
      type: "CreateGarbageRow";
      row: readonly [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ]; // Exactly 10 cell values (0 = empty, 1-7 = pieces, 8 = garbage)
    }
  // Adds a row to the bottom of the board
  // Pending lock system actions
  | { type: "CommitLock" }
  | { type: "RetryPendingLock"; timestampMs: Timestamp };
// Input log management

export type Reducer = (
  s: Readonly<GameState> | undefined,
  a: Action,
) => GameState;

// Builder functions for safe state construction
// These preserve variant types and avoid hybrid states from spread operations

export function buildPlayingState(
  base: BaseShared,
  overrides: Partial<Pick<PlayingState, "active">> = {},
): PlayingState {
  return {
    ...base,
    active: overrides.active ?? undefined,
    pendingLock: null,
    status: "playing",
  };
}

export function buildResolvingLockState(
  base: BaseShared,
  pendingLock: PendingLock,
): ResolvingLockState {
  return {
    ...base,
    active: undefined,
    pendingLock,
    status: "resolvingLock",
  };
}

export function buildLineClearState(base: BaseShared): LineClearState {
  return {
    ...base,
    active: undefined,
    pendingLock: null,
    status: "lineClear",
  };
}

export function buildTopOutState(base: BaseShared): TopOutState {
  return {
    ...base,
    active: undefined,
    pendingLock: null,
    status: "topOut",
  };
}

// Generic state update function that preserves variant type
export function updateGameState<T extends GameState>(
  state: T,
  updates: Partial<BaseShared>,
): T {
  const base: BaseShared = { ...state, ...updates };

  switch (state.status) {
    case "playing":
      return buildPlayingState(base, { active: state.active }) as T;
    case "resolvingLock":
      return buildResolvingLockState(base, state.pendingLock) as T;
    case "lineClear":
      return buildLineClearState(base) as T;
    case "topOut":
      return buildTopOutState(base) as T;
    default:
      return assertNever(state);
  }
}
