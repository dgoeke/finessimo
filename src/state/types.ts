// Board representation (dense array)
export interface Board {
  readonly width: 10;
  readonly height: 20;
  readonly cells: Uint8Array; // length = 200, values: 0..7 (0=empty)
}

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

export interface TetrominoShape {
  id: PieceId;
  cells: Record<Rot, readonly (readonly [number, number])[]>;
  spawnTopLeft: readonly [number, number];
  color: string;
}

export interface ActivePiece {
  id: PieceId;
  rot: Rot;
  x: number;
  y: number;
}

// Config
export interface GameplayConfig {
  finesseCancelMs: number; // default: 50
  // Visual/gameplay toggles used by UI renderers
  ghostPieceEnabled?: boolean; // default true
  nextPieceCount?: number; // default 5 (preview count)
}

export type SoftDropSpeed = number | "infinite";

export interface TimingConfig {
  tickHz: 60;
  dasMs: number;
  arrMs: number;
  // Soft drop: multiplier of gravity (number) or 'infinite' for instant drop without lock
  softDrop: SoftDropSpeed;
  lockDelayMs: number;
  lineClearDelayMs: number;
  gravityEnabled: boolean;
  gravityMs: number; // Milliseconds between gravity drops
}

// User actions at the input layer
export type KeyAction =
  | "LeftDown"
  | "LeftUp"
  | "RightDown"
  | "RightUp"
  | "SoftDropDown"
  | "SoftDropUp"
  | "HardDrop"
  | "RotateCW"
  | "RotateCCW"
  | "Hold";

export interface InputEvent {
  tMs: number;
  frame: number;
  action: KeyAction;
}

// Game mode and finesse feedback
export interface FinesseUIFeedback {
  message: string;
  isOptimal: boolean;
  timestamp: number;
}

// Generic guidance provided by game modes for UI and engine policies
export interface ModeGuidance {
  target?: { x: number; rot: Rot };
  label?: string; // prompt/description
  visual?: { highlightTarget?: boolean; showPath?: boolean };
}

// Physics timing state
export interface PhysicsState {
  lastGravityTime: number;
  lockDelayStartTime: number | null;
  isSoftDropping: boolean;
  lineClearStartTime: number | null;
  lineClearLines: number[];
}

// Game state
import type { SevenBagRng } from "../core/rng";

export interface Stats {
  // Basic counters
  piecesPlaced: number;
  linesCleared: number;
  optimalPlacements: number;
  incorrectPlacements: number;
  attempts: number;
  startedAtMs: number;
  timePlayedMs: number;

  // Comprehensive metrics
  accuracyPercentage: number; // optimalPlacements / attempts * 100
  finesseAccuracy: number; // successful finesse placements / attempts * 100
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
  faultsByType: Record<string, number>; // maps fault types to counts

  // Line clear statistics
  singleLines: number;
  doubleLines: number;
  tripleLines: number;
  tetrisLines: number;
}

export interface GameState {
  board: Board;
  active: ActivePiece | undefined;
  hold: PieceId | undefined;
  canHold: boolean;
  nextQueue: PieceId[];
  rng: SevenBagRng; // SevenBagRng state from core/rng.ts
  timing: TimingConfig;
  gameplay: GameplayConfig;
  tick: number;
  status: "playing" | "lineClear" | "topOut";
  stats: Stats; // Basic stats; extended in Iteration 6
  physics: PhysicsState;
  // Log is for the current piece only. It is cleared after the piece locks and is analyzed.
  inputLog: InputEvent[];
  // Game mode and finesse feedback
  currentMode: string;
  modeData?: unknown;
  finesseFeedback: FinesseUIFeedback | null;
  modePrompt: string | null;
  // Optional, mode-provided guidance for visualization and prompts
  guidance?: ModeGuidance | null;
}

// State transitions
export type Action =
  | {
      type: "Init";
      seed?: string;
      timing?: Partial<TimingConfig>;
      gameplay?: Partial<GameplayConfig>;
      mode?: string;
    }
  | { type: "Tick"; timestampMs: number }
  | { type: "Spawn"; piece?: PieceId }
  | { type: "Move"; dir: -1 | 1; source: "tap" | "das" }
  | { type: "SoftDrop"; on: boolean }
  | { type: "Rotate"; dir: "CW" | "CCW" }
  | { type: "HardDrop" }
  | { type: "Hold" }
  | { type: "Lock" }
  | { type: "StartLockDelay"; timestampMs: number }
  | { type: "CancelLockDelay" }
  | { type: "StartLineClear"; lines: number[]; timestampMs: number }
  | { type: "CompleteLineClear" }
  | { type: "ClearLines"; lines: number[] }
  | { type: "EnqueueInput"; event: InputEvent }
  | { type: "SetMode"; mode: string }
  | { type: "UpdateFinesseFeedback"; feedback: FinesseUIFeedback | null }
  | { type: "UpdateModePrompt"; prompt: string | null }
  // Settings updates
  | { type: "UpdateTiming"; timing: Partial<TimingConfig> }
  | { type: "UpdateGameplay"; gameplay: Partial<GameplayConfig> }
  // Mode/UI guidance
  | { type: "UpdateGuidance"; guidance: ModeGuidance | null }
  | { type: "UpdateModeData"; data: unknown }
  // Statistics tracking actions
  | {
      type: "RecordPieceLock";
      piece: PieceId;
      isOptimal: boolean;
      inputCount: number;
      optimalInputCount: number;
      faults: string[];
      timestampMs: number;
      linesCleared: number;
    }
  | { type: "UpdateSessionTime"; timestampMs: number }
  | {
      type: "RecordLineClear";
      linesCleared: number;
      lineType: "single" | "double" | "triple" | "tetris";
    };

export type Reducer = (
  s: Readonly<GameState> | undefined,
  a: Action,
) => GameState;
