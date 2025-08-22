# Tetris Finesse Trainer — Final Design Document (AI-Ready, Rev. 2)

Project name: Finessimo

This document has been updated to incorporate architectural clarifications and support for optional 180-degree rotations, ensuring minimal ambiguity for AI-assisted implementation.

## Executive Summary

A web-based training application to learn "2-step finesse" (placing any piece with minimum inputs), emphasizing correctness over speed to build durable muscle memory. Pieces are evaluated after placement for optimality, with feedback, drills, and progression.

## Background and Motivation

- At high piece-per-minute speeds, inefficient inputs cap performance; mastering minimal-input placement removes the bottleneck.
- Finesse parallels touch-typing: structured guidance, immediate feedback, targeted drills, and accuracy-first practice produce automaticity and speed as a side effect.

## Goals and Non-goals

**Goals:**
- Teach minimal-input placement using SRS (including optional 180° rotations), with clear feedback, drills, and stats.
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

**UI (Canvas board + DOM UI)** → **Input Handler (Stateful: keyboard/touch + DAS/ARR timers)** → **Reducer (Pure Function)** → **Immutable State** → **Core Logic (movement, rotation, collision, line clear, RNG)** → **Finesse Calculator (post-lock)** → **Game Mode hooks**

**Data flow:**
- User input is processed by a stateful `Input Handler` which dispatches normalized action objects.
- Actions are processed by a pure `reducer` function: `(currentState, action) => newState`.
- The application re-renders based on the new immutable state object.

## Input Handling Architecture

To maintain a pure core reducer, all state related to physical input devices and timing (DAS/ARR) is managed exclusively within the `Input Handler` module.

-   **Internal State:** The handler maintains its own internal, mutable state, such as `isLeftKeyDown`, `dasStartTime`, etc. This state is not part of the global `GameState`.
-   **Responsibilities:**
    1.  Listen for raw DOM events (`keydown`, `keyup`).
    2.  Manage timers for DAS (initial delay) and ARR (auto-repeat).
    3.  Dispatch normalized game `Action` objects (e.g., `{ type: 'Move', dir: -1, source: 'tap' }`) to the central store. It does not modify the `GameState` directly.
-   **Benefit:** This isolates side-effects and complex timing logic to the system's edge, allowing the game's core reducer to remain a simple, testable, pure function.

## Contracts and Conventions

### Coordinate System

-   **Board dimensions:** width = 10, height = 20 (visible rows only).
-   **Origin:** Top-left at (0,0); x increases right, y increases down.
-   **Active piece positioning:** May occupy negative y values while spawning/rotating above the board.
-   **Collision rules:** Cells with y < 0 are treated as empty; locking with any cell at y < 0 triggers top-out.
-   **Line clearing:** Only scans rows 0..19.

### Time and Loop

-   Fixed logic tick: 60 Hz (every 16.666… ms).
-   Render via `requestAnimationFrame`; logic is independent of render cadence.

### Randomness and Determinism

-   Seedable 7-bag randomizer.
-   All gameplay is deterministic from seed + input log.
-   Replays serialize seed, timing config, and normalized input events.

### Rotation Names

-   `spawn` (0), `right` (CW, +1), `left` (CCW, -1), `reverse` (180°).

### Physics & Gameplay Defaults

-   Gravity: OFF in trainer modes by default (piece falls only on soft/hard drop).
-   Lock delay: 500 ms.
-   Line clear delay: 0 ms.
-   DAS: 133 ms.
-   ARR: 2 ms (0 = instant).
-   Input Cancellation Window: 50 ms (for normalizing mis-inputs).

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
export type PieceId = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export type Rot = 'spawn' | 'right' | 'left' | 'reverse';

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
  allow180Rotation: boolean; // default: true
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
  | 'Rotate180'
  | 'Hold';

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
  | { type: 'Rotate'; dir: 'CW' | 'CCW' | '180' }
  | { type: 'HardDrop' }
  | { type: 'Hold' }
  | { type: 'Lock' }
  | { type: 'ClearLines'; lines: number[] }
  | { type: 'EnqueueInput'; event: InputEvent };

export type Reducer = (s: Readonly<GameState>, a: Action) => GameState;
````

## SRS Constants

### Piece Definitions (with 180° rotations)

```typescript
export const PIECES: Record<PieceId, TetrominoShape> = {
  T: {
    id: 'T',
    cells: {
      spawn: [[1,0],[0,1],[1,1],[2,1]],
      right: [[1,0],[1,1],[2,1],[1,2]],
      reverse: [[0,1],[1,1],[2,1],[1,2]],
      left:  [[1,0],[0,1],[1,1],[1,2]],
    },
    spawnTopLeft: [3, -2], color: '#a000f0',
  },
  J: {
    id: 'J',
    cells: {
      spawn: [[0,0],[0,1],[1,1],[2,1]],
      right: [[1,0],[2,0],[1,1],[1,2]],
      reverse: [[0,1],[1,1],[2,1],[2,2]],
      left:  [[1,0],[0,2],[1,1],[1,2]],
    },
    spawnTopLeft: [3, -2], color: '#0000f0',
  },
  L: {
    id: 'L',
    cells: {
      spawn: [[2,0],[0,1],[1,1],[2,1]],
      right: [[1,0],[1,1],[1,2],[2,2]],
      reverse: [[0,1],[1,1],[2,1],[0,2]],
      left:  [[0,0],[1,0],[1,1],[1,2]],
    },
    spawnTopLeft: [3, -2], color: '#f0a000',
  },
  S: {
    id: 'S',
    cells: {
      spawn: [[1,0],[2,0],[0,1],[1,1]],
      right: [[1,0],[1,1],[2,1],[2,2]],
      reverse: [[0,1],[1,1],[1,2],[2,2]],
      left:  [[0,0],[0,1],[1,1],[1,2]],
    },
    spawnTopLeft: [3, -2], color: '#00f000',
  },
  Z: {
    id: 'Z',
    cells: {
      spawn: [[0,0],[1,0],[1,1],[2,1]],
      right: [[2,0],[1,1],[2,1],[1,2]],
      reverse: [[1,1],[2,1],[0,2],[1,2]],
      left:  [[0,1],[1,1],[1,2],[2,2]],
    },
    spawnTopLeft: [3, -2], color: '#f00000',
  },
  I: {
    id: 'I',
    cells: {
      spawn: [[0,1],[1,1],[2,1],[3,1]],
      right: [[2,0],[2,1],[2,2],[2,3]],
      reverse: [[0,2],[1,2],[2,2],[3,2]],
      left:  [[1,0],[1,1],[1,2],[1,3]],
    },
    spawnTopLeft: [3, -1], color: '#00f0f0',
  },
  O: {
    id: 'O',
    cells: {
      spawn: [[1,0],[2,0],[1,1],[2,1]],
      right: [[1,0],[2,0],[1,1],[2,1]],
      reverse: [[1,0],[2,0],[1,1],[2,1]],
      left:  [[1,0],[2,0],[1,1],[2,1]],
    },
    spawnTopLeft: [4, -2], color: '#f0f000',
  },
};
```

### Wall Kick Tables (with 180° rotations)

```typescript
// Standard CW/CCW kicks for JLSTZ pieces
export const KICKS_JLSTZ: Record<string, ReadonlyArray<readonly [number, number]>> = {
  'spawn->right': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  'right->spawn': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  'right->left':  [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  'left->right':  [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  'left->spawn':  [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  'spawn->left':  [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  'reverse->right': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  'right->reverse': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  'reverse->left':  [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  'left->reverse':  [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
};

// Standard CW/CCW kicks for I piece
export const KICKS_I: Record<string, ReadonlyArray<readonly [number, number]>> = {
  'spawn->right': [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
  'right->spawn': [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
  'reverse->right': [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
  'right->reverse': [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
  'left->spawn':  [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
  'spawn->left':  [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
  'reverse->left':  [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
  'left->reverse':  [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
};

// 180-degree kicks for JLSTZ pieces
export const KICKS_JLSTZ_180: Record<string, ReadonlyArray<readonly [number, number]>> = {
  'spawn->reverse': [[0,0],[1,0],[-2,0],[1,-1],[-2,-1]],
  'reverse->spawn': [[0,0],[-1,0],[2,0],[-1,1],[2,1]],
  'right->left':    [[0,0],[2,0],[-1,0],[2,1],[-1,1]],
  'left->right':    [[0,0],[-2,0],[1,0],[-2,-1],[1,-1]],
};

// 180-degree kicks for I piece
export const KICKS_I_180: Record<string, ReadonlyArray<readonly [number, number]>> = {
  'spawn->reverse': [[0,0],[-1,0],[2,0],[-1,1],[2,1]],
  'reverse->spawn': [[0,0],[1,0],[-2,0],[1,-1],[-2,-1]],
  'right->left':    [[0,0],[1,0],[-2,0],[1,-2],[-2,-2]],
  'left->right':    [[0,0],[-1,0],[2,0],[-1,2],[2,2]],
};
```

## Finesse Detection Specification

### What Counts as an Input

  - Each distinct key press counts as 1 input: `LeftDown`, `RightDown`, `RotateCW`, `RotateCCW`, `Rotate180`, `Hold`, `HardDrop`.
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
      - `Rotate180` (this edge is only added to the graph if `gameplay.allow180Rotation` is true).
  - **Goal:** The search finds the shortest path(s) from the spawn state to the final locked `(x, rot)` state. The trainer does not require the player to use a 180° rotation, but if used, it is counted as a single, valid input.

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
    calculator.ts    // BFS optimal path finder (respects 180° setting)
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
