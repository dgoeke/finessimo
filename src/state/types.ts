// Game state
import { gridCoordAsNumber } from "../types/brands";

import type { PieceRandomGenerator } from "../core/rng-interface";
import type { FaultType, FinesseResult } from "../finesse/calculator";
import type { GridCoord, DurationMs, Frame, Seed } from "../types/brands";
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

// Physics timing state
export type PhysicsState = {
  lastGravityTime: Timestamp;
  lockDelayStartTime: Timestamp | null;
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

// Shared fields common to all game states
type SharedGameFields = {
  board: Board;
  active: ActivePiece | undefined;
  hold: PieceId | undefined;
  canHold: boolean;
  nextQueue: ReadonlyArray<PieceId>;
  rng: PieceRandomGenerator; // Generic RNG interface for testability
  timing: TimingConfig;
  gameplay: GameplayConfig;
  tick: number;
  stats: Stats;
  physics: PhysicsState;
  // Processed actions log for finesse analysis - contains structured actions with tap/das distinction
  processedInputLog: ReadonlyArray<ProcessedAction>;
  // Game mode and finesse feedback
  currentMode: string;
  modeData?: unknown;
  finesseFeedback: FinesseResult | null;
  modePrompt: string | null;
  // Optional, mode-provided guidance for visualization and prompts
  guidance?: ModeGuidance | null;
  // Optional: mode-provided board overlay (pure description of cells to decorate)
  boardDecorations?: BoardDecorations | null;
};

// Playing state - normal gameplay
export type PlayingState = SharedGameFields & {
  status: "playing";
  pendingLock: null;
};

// Resolving lock state - piece is staged for lock resolution
export type ResolvingLockState = SharedGameFields & {
  status: "resolvingLock";
  pendingLock: PendingLock;
};

// Line clear state - lines are being cleared with delay
export type LineClearState = SharedGameFields & {
  status: "lineClear";
  pendingLock: null;
};

// Top out state - game over
export type TopOutState = SharedGameFields & {
  status: "topOut";
  pendingLock: null;
};

// Discriminated union of all game states
export type GameState =
  | PlayingState
  | ResolvingLockState
  | LineClearState
  | TopOutState;

// Utility function for exhaustiveness checking
export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${String(x)}`);
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
      timestampMs?: Timestamp;
    }
  | { type: "HoldMove"; dir: -1 | 1; timestampMs?: Timestamp }
  | { type: "RepeatMove"; dir: -1 | 1; timestampMs?: Timestamp }
  | { type: "HoldStart"; dir: -1 | 1; timestampMs?: Timestamp }
  | { type: "SoftDrop"; on: boolean }
  | { type: "Rotate"; dir: "CW" | "CCW" }
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
    } // Adds a row to the bottom of the board
  // Pending lock system actions
  | { type: "CommitLock" }
  | { type: "RetryPendingLock"; timestampMs: Timestamp };
// Input log management

export type Reducer = (
  s: Readonly<GameState> | undefined,
  a: Action,
) => GameState;
