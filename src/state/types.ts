// Board representation (dense array)
export interface Board {
  readonly width: 10;
  readonly height: 20;
  readonly cells: Uint8Array; // length = 200, values: 0..7 (0=empty)
}

// Helper for array indexing
export const idx = (x: number, y: number, width = 10) => y * width + x;

// Collision check with negative y handling
export function isCellBlocked(board: Board, x: number, y: number): boolean {
  if (x < 0 || x >= board.width) return true;
  if (y >= board.height) return true;
  if (y < 0) return false; // above the board = empty for collision
  return board.cells[idx(x, y)] !== 0;
}

// Pieces and rotation
export type PieceId = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export type Rot = 'spawn' | 'right' | 'left';

export interface TetrominoShape {
  id: PieceId;
  cells: Record<Rot, ReadonlyArray<readonly [number, number]>>;
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
  finesseCancelMs: number;   // default: 50
}

export interface TimingConfig {
  tickHz: 60;
  dasMs: number;
  arrMs: number;
  softDropCps: number;
  lockDelayMs: number;
  lineClearDelayMs: number;
}

// User actions at the input layer
export type KeyAction =
  | 'LeftDown' | 'LeftUp'
  | 'RightDown' | 'RightUp'
  | 'SoftDropDown' | 'SoftDropUp'
  | 'HardDrop'
  | 'RotateCW'
  | 'RotateCCW'
  | 'Hold';

export interface InputEvent {
  tMs: number;
  frame: number;
  action: KeyAction;
}

// Game state
export interface GameState {
  board: Board;
  active: ActivePiece | undefined;
  hold: PieceId | undefined;
  canHold: boolean;
  nextQueue: PieceId[];
  rng: unknown; // Opaque SevenBagRng state
  timing: TimingConfig;
  gameplay: GameplayConfig;
  tick: number;
  status: 'playing' | 'lineClear' | 'topOut';
  stats: unknown; // Stats object definition
  // Log is for the current piece only. It is cleared after the piece locks and is analyzed.
  inputLog: InputEvent[];
}

// State transitions
export type Action =
  | { type: 'Init'; seed?: string; timing?: Partial<TimingConfig>; gameplay?: Partial<GameplayConfig> }
  | { type: 'Tick' }
  | { type: 'Spawn' }
  | { type: 'Move'; dir: -1 | 1; source: 'tap' | 'das' }
  | { type: 'SoftDrop'; on: boolean }
  | { type: 'Rotate'; dir: 'CW' | 'CCW' }
  | { type: 'HardDrop' }
  | { type: 'Hold' }
  | { type: 'Lock' }
  | { type: 'ClearLines'; lines: number[] }
  | { type: 'EnqueueInput'; event: InputEvent };

export type Reducer = (s: Readonly<GameState>, a: Action) => GameState;