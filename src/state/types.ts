// Game state
import type { PieceRandomGenerator } from "../core/rng-interface";
import type { FaultType, FinesseResult } from "../finesse/calculator";
import type { Timestamp } from "../types/timestamp";

// Board representation (dense array)
export type Board = {
  readonly width: 10;
  readonly height: 20;
  readonly cells: Uint8Array; // length = 200, values: 0..7 (0=empty)
};

// Helper for array indexing
export const idx = (x: number, y: number, width = 10): number => y * width + x;

// Collision check with negative y handling
export function isCellBlocked(board: Board, x: number, y: number): boolean {
  if (x < 0 || x >= board.width) return true;
  if (y >= board.height) return true;
  if (y < 0) return false; // above the board = empty for collision
  return board.cells[idx(x, y)] !== 0;
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
  x: number;
  y: number;
};

// Config
export type GameplayConfig = {
  finesseCancelMs: number; // default: 50
  // Visual/gameplay toggles used by UI renderers
  ghostPieceEnabled?: boolean; // default true
  nextPieceCount?: number; // default 5 (preview count)
  // Finesse toggles
  finesseFeedbackEnabled?: boolean; // default true
  finesseBoopEnabled?: boolean; // default false
  retryOnFinesseError?: boolean; // default false - retry piece on hard drop finesse errors
};

export type SoftDropSpeed = number | "infinite";

export type TimingConfig = {
  tickHz: 60;
  dasMs: number;
  arrMs: number;
  // Soft drop: multiplier of gravity (number) or 'infinite' for instant drop without lock
  softDrop: SoftDropSpeed;
  lockDelayMs: number;
  lineClearDelayMs: number;
  gravityEnabled: boolean;
  gravityMs: number; // Milliseconds between gravity drops
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
  tMs: number;
  frame: number;
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
  target?: { x: number; rot: Rot };
  label?: string; // prompt/description
  visual?: { highlightTarget?: boolean; showPath?: boolean };
};

// Physics timing state
export type PhysicsState = {
  lastGravityTime: number;
  lockDelayStartTime: number | null;
  isSoftDropping: boolean;
  lineClearStartTime: Timestamp | null;
  lineClearLines: Array<number>;
};

export type Stats = {
  // Basic counters
  piecesPlaced: number;
  linesCleared: number;
  optimalPlacements: number;
  incorrectPlacements: number;
  attempts: number;
  startedAtMs: number;
  timePlayedMs: number;

  // Session-specific counters for accurate rate calculations
  sessionPiecesPlaced: number;
  sessionLinesCleared: number;

  // Comprehensive metrics
  accuracyPercentage: number; // optimalPlacements / attempts * 100
  finesseAccuracy: number; // optimalInputs / totalInputs * 100
  averageInputsPerPiece: number; // totalInputs / piecesPlaced

  // Session tracking
  sessionStartMs: number;
  totalSessions: number;
  longestSessionMs: number;

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
  completedLines: Array<number>; // lines that would be cleared if committed
  pieceId: PieceId; // convenience for respawn/retry
  timestampMs: Timestamp; // preserve original timestamp for lockCurrentPiece
};

export type GameState = {
  board: Board;
  active: ActivePiece | undefined;
  hold: PieceId | undefined;
  canHold: boolean;
  nextQueue: Array<PieceId>;
  rng: PieceRandomGenerator; // Generic RNG interface for testability
  timing: TimingConfig;
  gameplay: GameplayConfig;
  tick: number;
  status: "playing" | "lineClear" | "topOut" | "resolvingLock";
  // Invariant: When status === "resolvingLock", pendingLock MUST be non-null
  // When status !== "resolvingLock", pendingLock MUST be null
  pendingLock: PendingLock | null;
  stats: Stats; // Basic stats; extended in Iteration 6
  physics: PhysicsState;
  // Processed actions log for finesse analysis - contains structured actions with tap/das distinction
  processedInputLog: Array<Action>;
  // Game mode and finesse feedback
  currentMode: string;
  modeData?: unknown;
  finesseFeedback: FinesseResult | null;
  modePrompt: string | null;
  // Optional, mode-provided guidance for visualization and prompts
  guidance?: ModeGuidance | null;
};

// State transitions
export type Action =
  | {
      type: "Init";
      seed: string;
      timing?: Partial<TimingConfig>;
      gameplay?: Partial<GameplayConfig>;
      mode?: string;
      retainStats?: boolean;
      rng?: PieceRandomGenerator; // Optional custom RNG for testing
    }
  | { type: "Tick"; timestampMs: Timestamp }
  | { type: "Spawn"; piece?: PieceId }
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
  | { type: "StartLineClear"; lines: Array<number>; timestampMs: Timestamp }
  | { type: "CompleteLineClear" }
  | { type: "ClearLines"; lines: Array<number> }
  | { type: "SetMode"; mode: string }
  | { type: "UpdateFinesseFeedback"; feedback: FinesseResult | null }
  | { type: "UpdateModePrompt"; prompt: string | null }
  // Externalized preview refill (mode-owned RNG)
  | {
      type: "RefillPreview";
      pieces: Array<PieceId>;
      rng: PieceRandomGenerator;
    }
  | {
      type: "ReplacePreview";
      pieces: Array<PieceId>;
      rng: PieceRandomGenerator;
    }
  // Settings updates
  | { type: "UpdateTiming"; timing: Partial<TimingConfig> }
  | { type: "UpdateGameplay"; gameplay: Partial<GameplayConfig> }
  // Mode/UI guidance
  | { type: "UpdateGuidance"; guidance: ModeGuidance | null }
  | { type: "UpdateModeData"; data: unknown }
  // Statistics tracking actions
  | {
      type: "RecordPieceLock";
      isOptimal: boolean;
      inputCount: number;
      optimalInputCount: number;
      faults: Array<FaultType>;
    }
  | { type: "ClearInputLog" }
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
  | { type: "RetryPendingLock" };

export type Reducer = (
  s: Readonly<GameState> | undefined,
  a: Action,
) => GameState;
