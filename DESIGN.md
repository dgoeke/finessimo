# Tetris Finesse Trainer — Design Document

Project name: Finessimo

Note: For a concise per-file overview of the current src/ codebase, see FILES.md.

## Executive Summary

A web-based training application to learn "2-step finesse" (placing any piece with minimum inputs), emphasizing correctness over speed to build durable muscle memory. Pieces are evaluated after placement for optimality, with feedback, drills, and progression.

## Background and Motivation

- At high piece-per-minute speeds, inefficient inputs cap performance; mastering minimal-input placement removes the bottleneck.
- Finesse parallels touch-typing: structured guidance, immediate feedback, targeted drills, and accuracy-first practice produce automaticity and speed as a side effect.

## Goals and Non-goals

**Goals:**

- Teach minimal-input placement using SRS with clear feedback, drills, and stats.
- Provide guided and free-play modes, desktop and mobile support, and custom scenarios.
- Maintain deterministic, testable, and extensible core.

**Non-goals (MVP):**

- Competitive scoring/versus modes.
- Online leaderboards and multiplayer.
- Non-SRS rotation variants and non-standard piece sets.

## Core Design Principles

1.  Functional architecture with immutable state and pure reducers.
2.  Strict TypeScript types.
3.  Unidirectional data flow; strict separation of stateful I/O (Input Handler) from the pure core logic.
4.  Incremental development with testable phases and extensibility via pluggable modes.

## System Architecture

**UI (Canvas board + DOM UI)** → **Input Handler (Stateful: keyboard/touch + DAS/ARR timers)** → **Reducer (Pure Function)** → **Immutable State** → **Core Logic (movement, rotation, collision, line clear, RNG)** → **Finesse Calculator (post-lock)** → **Game Modes (via hooks)**

Keybindings and Settings
- A modal Settings panel exposes tabs for Timing, Gameplay, Visual, and Controls (Keybindings).
- Keybindings are configurable and persisted locally (localStorage) under a single `finessimo` key (with both settings and keyBindings). The keyboard input handler loads these on startup and can be updated live via `setKeyBindings`.
- While rebinding, the Settings panel adds `settings-open` to `<body>` so the keyboard handler ignores keydown/keyup to prevent interference.

**Data flow:**

- User input is processed by a stateful `Input Handler` which dispatches normalized action objects. Keyboard handling uses configurable `KeyBindings` (based on `KeyboardEvent.code`) so letters, digits, symbols, and modifier keys (including L/R variants like `ShiftLeft`/`ShiftRight`) can be bound.
- Actions are processed by a pure `reducer` function: `(currentState, action) => newState`.
- The application re-renders based on the new immutable state object.

## Input Handling Architecture

To maintain a pure core reducer, all state related to physical input devices and timing (DAS/ARR) is managed exclusively within the `Input Handler` module.

- **Internal State:** The handler maintains its own internal, mutable state, such as `isLeftKeyDown`, `dasStartTime`, etc. This state is not part of the global `GameState`.
- **Responsibilities:**
  1.  Listen for raw DOM events (`keydown`, `keyup`).
  2.  Manage timers for DAS (initial delay) and ARR (auto-repeat).
  3.  Dispatch normalized game `Action` objects (e.g., `{ type: 'Move', dir: -1, source: 'tap' }`) to the central store. It does not modify the `GameState` directly.
- **Benefit:** This isolates side-effects and complex timing logic to the system's edge, allowing the game's core reducer to remain a simple, testable, pure function.

### Input Handler API (current)

- `init(dispatch: (action) => void)`: Provide the dispatch function to send Actions to the reducer.
- `start()/stop()`: Attach/detach device listeners.
- `update(gameState: GameState, nowMs: number)`: Advance input timing (DAS/ARR, soft-drop cadence) using a timestamp injected by the caller. The app loop passes the same `performance.now()` value it uses for `Tick` to keep timing consistent and testable.
- `getState()`: Introspection for debugging.
- `setKeyBindings(bindings)/getKeyBindings()`: Configure/read current keyboard bindings.

## Contracts and Conventions

### Coordinate System

- **Board dimensions:** width = 10, height = 20 (visible rows only).
- **Origin:** Top-left at (0,0); x increases right, y increases down.
- **Active piece positioning:** May occupy negative y values while spawning/rotating above the board.
- **Collision rules:** Cells with y < 0 are treated as empty; locking with any cell at y < 0 triggers top-out.
- **Line clearing:** Only scans rows 0..19.

### Time and Loop

- Fixed logic tick: 60 Hz (every 16.666… ms).
- Render via `requestAnimationFrame`; logic is independent of render cadence.

### Randomness and Determinism

- Seedable 7-bag randomizer.
- All gameplay is deterministic from seed + input log.
- Replays serialize seed, timing config, and normalized input events.

### Rotation Names

The four rotation states are defined as follows:

- `spawn` (0): The initial state when the piece appears.
- `right` (R): State after one clockwise rotation from spawn.
- `two` (2): State after two successive rotations in either direction from spawn.
- `left` (L): State after one counter-clockwise rotation from spawn.

### Physics & Gameplay Defaults

- Gravity: OFF in trainer modes by default (piece falls only on soft/hard drop).
- Lock delay: 500 ms.
- Line clear delay: 0 ms.
- DAS: 133 ms.
- ARR: 2 ms (0 = instant).
- Input Cancellation Window: 50 ms (for normalizing mis-inputs).

### Mode Hooks and Guidance (Current Implementation)

To keep the core engine mode-agnostic, game modes expose a small set of pure hooks. The engine never branches on a mode name.

- `initialConfig?(): { timing?: Partial<TimingConfig>; gameplay?: Partial<GameplayConfig> }`
  - Optional: a mode can tweak timing/gameplay defaults on activation.

- `initModeData?(): unknown`
  - Optional: provides an opaque mode-specific substate stored in `GameState.modeData`.

- `onBeforeSpawn?(state: GameState): { piece?: PieceId } | null`
  - Optional: allows a mode to override the next spawned piece (e.g., drills).

- `getGuidance?(state: GameState): ModeGuidance | null`
  - Optional: provides a target/prompt/visual flags for UI overlays. The app stores this in `state.guidance`.

`ModeGuidance`:
- `target?: { x: number; rot: Rot }` — suggested placement for overlays/analyzers
- `label?: string` — HUD text prompt
- `visual?: { highlightTarget?: boolean; showPath?: boolean }` — overlay toggles

## Core Types

```typescript
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
export type PieceId = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
export type Rot = "spawn" | "right" | "two" | "left";

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
  finesseCancelMs: number; // default: 50
  // Visual/gameplay toggles
  ghostPieceEnabled?: boolean; // default: true
  nextPieceCount?: number;     // default: 5 (preview count)
}

export interface TimingConfig {
  tickHz: 60;
  dasMs: number;
  arrMs: number;
  softDropCps: number;
  lockDelayMs: number;
  lineClearDelayMs: number;
  gravityEnabled: boolean;
  gravityMs: number;
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

// Game state
export interface GameState {
  board: Board;
  active?: ActivePiece;
  hold?: PieceId;
  canHold: boolean;
  nextQueue: PieceId[];
  rng: unknown; // Opaque SevenBagRng state
  timing: TimingConfig;
  gameplay: GameplayConfig;
  tick: number;
  status: "playing" | "lineClear" | "topOut";
  stats: unknown; // Stats object definition
  // Log is for the current piece only. It is cleared after the piece locks and is analyzed.
  inputLog: InputEvent[];
  // Mode subsystem
  currentMode: string;
  modeData?: unknown;
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
  | { type: "UpdateModeData"; data: unknown };

export type Reducer = (s: Readonly<GameState>, a: Action) => GameState;
```

## SRS Constants

### Piece Definitions

```typescript
export const PIECES: Record<PieceId, TetrominoShape> = {
  T: {
    id: "T",
    cells: {
      spawn: [
        [1, 0],
        [0, 1],
        [1, 1],
        [2, 1],
      ],
      right: [
        [1, 0],
        [1, 1],
        [2, 1],
        [1, 2],
      ],
      two: [
        [0, 1],
        [1, 1],
        [2, 1],
        [1, 2],
      ],
      left: [
        [1, 0],
        [0, 1],
        [1, 1],
        [1, 2],
      ],
    },
    spawnTopLeft: [3, -2],
    color: "#a000f0",
  },
  J: {
    id: "J",
    cells: {
      spawn: [
        [0, 0],
        [0, 1],
        [1, 1],
        [2, 1],
      ],
      right: [
        [1, 0],
        [2, 0],
        [1, 1],
        [1, 2],
      ],
      two: [
        [0, 1],
        [1, 1],
        [2, 1],
        [2, 2],
      ],
      left: [
        [1, 0],
        [0, 2],
        [1, 1],
        [1, 2],
      ],
    },
    spawnTopLeft: [3, -2],
    color: "#0000f0",
  },
  L: {
    id: "L",
    cells: {
      spawn: [
        [2, 0],
        [0, 1],
        [1, 1],
        [2, 1],
      ],
      right: [
        [1, 0],
        [1, 1],
        [1, 2],
        [2, 2],
      ],
      two: [
        [0, 1],
        [1, 1],
        [2, 1],
        [0, 2],
      ],
      left: [
        [0, 0],
        [1, 0],
        [1, 1],
        [1, 2],
      ],
    },
    spawnTopLeft: [3, -2],
    color: "#f0a000",
  },
  S: {
    id: "S",
    cells: {
      spawn: [
        [1, 0],
        [2, 0],
        [0, 1],
        [1, 1],
      ],
      right: [
        [1, 0],
        [1, 1],
        [2, 1],
        [2, 2],
      ],
      two: [
        [1, 1],
        [2, 1],
        [0, 2],
        [1, 2],
      ],
      left: [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 2],
      ],
    },
    spawnTopLeft: [3, -2],
    color: "#00f000",
  },
  Z: {
    id: "Z",
    cells: {
      spawn: [
        [0, 0],
        [1, 0],
        [1, 1],
        [2, 1],
      ],
      right: [
        [2, 0],
        [1, 1],
        [2, 1],
        [1, 2],
      ],
      two: [
        [0, 1],
        [1, 1],
        [1, 2],
        [2, 2],
      ],
      left: [
        [0, 1],
        [1, 1],
        [1, 2],
        [2, 2],
      ],
    },
    spawnTopLeft: [3, -2],
    color: "#f00000",
  },
  I: {
    id: "I",
    cells: {
      spawn: [
        [0, 1],
        [1, 1],
        [2, 1],
        [3, 1],
      ],
      right: [
        [2, 0],
        [2, 1],
        [2, 2],
        [2, 3],
      ],
      two: [
        [0, 2],
        [1, 2],
        [2, 2],
        [3, 2],
      ],
      left: [
        [1, 0],
        [1, 1],
        [1, 2],
        [1, 3],
      ],
    },
    spawnTopLeft: [3, -1],
    color: "#00f0f0",
  },
  O: {
    id: "O",
    cells: {
      spawn: [
        [1, 0],
        [2, 0],
        [1, 1],
        [2, 1],
      ],
      right: [
        [1, 0],
        [2, 0],
        [1, 1],
        [2, 1],
      ],
      two: [
        [1, 0],
        [2, 0],
        [1, 1],
        [2, 1],
      ],
      left: [
        [1, 0],
        [2, 0],
        [1, 1],
        [2, 1],
      ],
    },
    spawnTopLeft: [4, -2],
    color: "#f0f000",
  },
};
```

### Wall Kick Tables

**SRS Compliance Note:** This implementation follows standard SRS rules where only adjacent rotation states (90° turns) are allowed. Direct 180° rotations require two sequential 90° rotations.

```typescript
// Standard kicks for JLSTZ pieces (SRS-compliant 4-way rotation)
export const KICKS_JLSTZ: Record<
  string,
  ReadonlyArray<readonly [number, number]>
> = {
  // 0 -> R / R -> 0
  "spawn->right": [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  "right->spawn": [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  // R -> 2 / 2 -> R
  "right->two": [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  "two->right": [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  // 2 -> L / L -> 2
  "two->left": [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  "left->two": [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  // L -> 0 / 0 -> L
  "left->spawn": [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  "spawn->left": [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
};

// Standard kicks for I piece (SRS-compliant 4-way rotation)
export const KICKS_I: Record<
  string,
  ReadonlyArray<readonly [number, number]>
> = {
  // 0 -> R / R -> 0
  "spawn->right": [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  "right->spawn": [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  // R -> 2 / 2 -> R
  "right->two": [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
  "two->right": [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  // 2 -> L / L -> 2
  "two->left": [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  "left->two": [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  // L -> 0 / 0 -> L
  "left->spawn": [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
  "spawn->left": [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
};
```

## Finesse Detection Specification

### What Counts as an Input

- Each distinct key press counts as 1 input: `LeftDown`, `RightDown`, `RotateCW`, `RotateCCW`, `Hold`, `HardDrop`.
- Holding Left/Right that generates movement via DAS/ARR does **NOT** add further inputs.
- Hard drop is always required and counts as 1 input.

### Input Normalization

The goal is to convert a raw series of `InputEvent`s into a clean sequence of `KeyAction`s representing player intent.

**Algorithm:**

1.  Filter the log, keeping only `LeftDown`, `RightDown`, `Rotate*`, `Hold`, and `HardDrop` events.
2.  Iterate through the filtered events. If a directional input (e.g., `LeftDown`) is followed by its opposite (`RightDown`) within the `finesseCancelMs` window (e.g., 50ms), discard both events. This is best handled with a stack or a lookahead buffer.
3.  The result is the normalized `playerSequence`.

### Minimality Algorithm (BFS)

The optimal input sequence is found by performing a Breadth-First Search (BFS) on the state space.

- **Nodes:** Unique piece states defined by `(x, y, rot)`.
- **Graph Edges:** The search expands from a node by applying abstract "player intents," each with a cost of 1. These edges represent the minimal actions a player can take, not raw game ticks.
  - `TapLeft`: Moves piece 1 unit left.
  - `TapRight`: Moves piece 1 unit right.
  - `HoldLeft`: Moves piece to collide with the left wall.
  - `HoldRight`: Moves piece to collide with the right wall.
  - `RotateCW`, `RotateCCW`.
- **Goal:** The search finds the shortest path(s) from the spawn state to the final locked `(x, rot)` state.

### Output

```typescript
export interface FinesseResult {
  optimalSequences: KeyAction[][]; // Can be multiple paths of the same length
  playerSequence: KeyAction[]; // normalized
  isOptimal: boolean;
  faults: Fault[]; // Fault type to be defined
}
```

## Directory Structure

```
src/
  core/
    pieces.ts        // PIECES constants, shape data
    srs.ts           // Rotation and kick logic (all kick tables)
    board.ts         // Board operations, collision
    rng.ts           // 7-bag randomizer
  state/
    types.ts         // All TypeScript interfaces
    reducer.ts       // Pure state transitions
    actions.ts       // Action creators
    selectors.ts     // State queries
  input/
    handler.ts       // STATEFUL keyboard/touch/DAS/ARR logic
    recorder.ts      // Input logging
  finesse/
    analyzer.ts      // Post-lock analysis
    calculator.ts    // BFS optimal path finder
    normalizer.ts    // Input normalization (uses cancellation setting)
  modes/
    index.ts         // Mode interface and registry
    freePlay.ts
    targeted.ts
  ui/
    canvas.ts        // Board renderer
    hud.ts           // UI elements
  app.ts             // Main game loop
  main.ts            // Entry point
tests/
  unit/
  integration/
  fixtures/
```
