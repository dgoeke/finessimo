# Finessimo — Design Document

Note: See FILES.md for a per-file map of src/.

## Executive Summary

Finessimo is a web-based trainer for 2-step finesse: placing any tetromino with the minimum inputs. The architecture is a functional core with immutable state and pure reducers, strong type-level guarantees (branded primitives and discriminated unions), and side-effects isolated to input and UI edges. A lock-resolution pipeline integrates finesse analysis and mode policies without compromising purity or determinism.

## Principles

- Functional core: immutable state, pure reducers, no side-effects in core.
- Unidirectional flow: UI → Input Handler → Reducer → State → UI.
- Types-first: encode invariants with brands, guards, and exhaustive unions.
- Separation of concerns: timing/devices in input; rendering in UI; logic in reducer; analysis in finesse service; policy in modes.
- Deterministic from seed + inputs; RNG is pluggable and mode-owned.

## High-Level Architecture

UI (Lit components, signals)
→ Input Handler (stateful; keyboard/touch + DAS/ARR)
→ Reducer (pure)
→ GameState (immutable, discriminated union)
→ Lock Pipeline (pure coordinator)
→ Finesse Service (pure analysis) + Mode (pure policy hooks)

### Reactivity & Rendering

- `@lit-labs/signals` exposes a single `gameStateSignal`. Reducer updates this signal; components subscribe to slices via selectors in `src/state/signals.ts`.
- All canvas/dom drawing lives inside UI components. No imperative rendering in the app core.

### Input Handling

- Keyboard: `StateMachineInputHandler` backed by a Robot3 DAS machine (`src/input/machines/das.ts`), with a tiny `KeyBindingManager` that binds `KeyboardEvent.code` directly. All bound keys `preventDefault()`.
- Touch: `TouchInputHandler` translates gestures to the same engine actions; uses the same state machine for consistent timing.
- Input handler is the only stateful/timerful module. It emits engine `Action`s and appends normalized `ProcessedAction` entries for finesse analysis via `{ type: "AppendProcessed" }`. The reducer never reads device state.

Soft rules for processed logging (implemented in `src/finesse/log.ts`):

- TapMove: log only on key-up (non-optimistic).
- HoldMove: log once on hold start (DAS); never log repeats.
- RepeatMove: never logged.
- Rotate/HardDrop: log once per press.
- SoftDrop: log transitions (on/off) only; dedupe pulses.

#### DAS Interaction

- State machine: `DASMachineService` maintains `{ direction, dasStartTime, dasMs, arrLastTime, arrMs, repeats }` and exposes `send({ type: KEY_DOWN | KEY_UP | TIMER_TICK, direction?, timestamp })` and `updateConfig(dasMs, arrMs)`.
- Timing source: The app passes the same `nowMs` used for physics `Tick` into `InputHandler.update(state, nowMs)` to keep device timing deterministic.
- KeyDown flow (Left/Right):
  - If the opposite direction is active, emit `KEY_UP` for it first (prevents dual-hold ambiguity).
  - Emit `KEY_DOWN(dir, t)`. The DAS machine immediately emits an optimistic `{ type: "TapMove", optimistic: true }` engine action; handler tracks `pendingTap = { dir, t }` but does not log it yet.
  - On subsequent `TIMER_TICK` when DAS expires, the machine emits `HoldStart(dir)` then `HoldMove/RepeatMove`. The handler logs a single `ProcessedAction` for the hold at `HoldStart` and clears `pendingTap`.
- KeyUp flow (Left/Right):
  - Emit `KEY_UP(dir, t)` only when all bound key codes for that direction are released (supports multi-key bindings).
  - If a matching `pendingTap` exists and gameplay is active, log one `ProcessedAction: TapMove` with the original timestamp and clear `pendingTap`.
  - If the opposite direction remains held, immediately emit `KEY_DOWN` for the opposite to continue DAS without a gap.
- Repeat handling: `RepeatMove` actions are dispatched to the reducer for movement but never logged for finesse.
- ARR catch-up: If `arrMs < frameInterval`, the handler computes extra repeats based on elapsed time since `arrLastTime` (or `dasStartTime + dasMs`) and dispatches bounded `RepeatMove` actions (capped at board width − 1) to avoid stutter.
- Soft drop: When held and `softDrop !== "infinite"`, pulses are dispatched at an interval derived from gravity/softDrop. Logging uses `SoftDropState` to emit only transitions (on/off), deduping periodic pulses.
- Process gating: Inputs are ignored for logging unless there is an active piece and `status === "playing"` (`shouldProcessInCurrentState`).
- Key binding discipline: Uses `KeyboardEvent.code` and always `preventDefault()` for bound keys. Maintains per-code pressed state to avoid duplicate downs; rejects `event.repeat`.
- Blocking behavior: While the settings modal is open (`<body>.settings-open`), gameplay inputs are ignored; key-up is still handled to clear internal pressed state safely.
- Touch parity: Touch gestures call `handleMovement(Left/Right, Down/Up)` and `setSoftDrop(on/off, t)` to drive the same DAS machine and logging rules.

## Types-First Model

### Branded Primitives (src/types/brands.ts, src/types/timestamp.ts)

- `DurationMs`, `GridCoord`, `CellValue`, `Frame`, `Seed`, `Timestamp` are branded to avoid mixing look-alikes. Factories/guards exist only at boundaries; the core uses branded types directly.

```ts
// Example brands
declare const DurationMsBrand: unique symbol;
export type DurationMs = number & { readonly [DurationMsBrand]: true };
export const createDurationMs = (n: number): DurationMs => {
  if (n < 0 || !Number.isFinite(n)) throw new Error("DurationMs invalid");
  return n as DurationMs;
};
```

### GameState (src/state/types.ts)

- Shared fields are composed with a discriminated `status` union. Invalid state transitions are made unrepresentable.

Statuses:

- `playing` — normal gameplay; `pendingLock: null`.
- `resolvingLock` — a `PendingLock` exists; pipeline decides commit vs retry.
- `lineClear` — line clear delay; physics tracks `lineClearStartTime` and rows.
- `topOut` — game over; app auto-restarts via `Init` with retained stats.

Key fields:

- `board: { width: 10; height: 20; cells: BoardCells }` where `BoardCells` is a branded `Uint8Array & { length: 200 }`.
- `active?: ActivePiece` where `x,y` are `GridCoord` and rotations are `"spawn" | "right" | "two" | "left"`.
- `physics: { lastGravityTime; lockDelayStartTime; isSoftDropping; ... }`.
- `processedInputLog: ReadonlyArray<ProcessedAction>` per-piece, cleared post-analysis.
- `finesseFeedback: FinesseResult | null`, `modePrompt: string | null`, `guidance?: ModeGuidance | null`.
- `rng: PieceRandomGenerator` (interface); actual RNG can be provided/owned by mode.
- `nextQueue: ReadonlyArray<PieceId>`; preview is refilled via explicit actions.

### Actions (src/state/types.ts)

- Exhaustive discriminated union; reducer is compiled to handle all variants.
- Movement: `TapMove`, `HoldMove`, `RepeatMove`, `HoldStart` (for analytics), `Rotate`, `SoftDrop`, `HardDrop`.
- Lifecycle/physics: `Tick`, `Spawn`, `StartLockDelay`, `CancelLockDelay`, `StartLineClear`, `CompleteLineClear`, `Lock`, `CommitLock`.
- Pending lock: `RetryPendingLock` (mode-directed retry of staged piece).
- Finesse/logging: `AppendProcessed`, `ClearInputLog`, `UpdateFinesseFeedback`.
- Modes/UI: `SetMode`, `UpdateModePrompt`, `UpdateGuidance`, `UpdateModeData`.
- RNG/preview: `RefillPreview`, `ReplacePreview`.
- Settings: `UpdateTiming`, `UpdateGameplay`.

Helper:

- `assertNever(x: never): never` used throughout for exhaustiveness.

## Pure Reducer (src/state/reducer.ts)

- Single pure function `(state, action) => newState` with an internal handler map to keep code structured and enable compile-time exhaustiveness on `Action["type"]`.
- All state cloning is immutable; previous objects are never mutated.
- Physics: gravity and lock delay via `physics` timestamps; soft drop scales gravity as a multiplier or becomes effectively instant for `"infinite"`.
- Lock seam: `createPendingLock` builds a `PendingLock`; status switches to `resolvingLock`. Final application happens via `CommitLock` to keep lock policy out of the reducer.
- Line clears: zero-delay clears are applied deterministically inside reducer when appropriate; `lineClear` delay uses timestamps.
- Stats: comprehensive metrics updated via a small set of actions (`RecordPieceLock` etc.), with derived metrics calculated in one place.

## Lock Resolution Pipeline (src/modes/lock-pipeline.ts)

- Pure coordinator called by the app only when `state.status === "resolvingLock"`.
- Runs finesse analysis via an injected analyzer function that returns `{ result, actions }`.
- Dispatches all analysis actions (includes `UpdateFinesseFeedback`, `RecordPieceLock`, and `ClearInputLog`).
- Asks the active mode for a decision via `onResolveLock` and then dispatches `CommitLock` or `RetryPendingLock`.

## Finesse Analysis (src/finesse/\*.ts)

- `ProcessedAction` log is the single source of truth for player inputs.
- `extractFinesseActionsFromProcessed` maps processed actions to abstract `FinesseAction` domain: `MoveLeft`, `MoveRight`, `DASLeft`, `DASRight`, `RotateCW`, `RotateCCW`, `SoftDrop`, `HardDrop`.
- `BfsFinesseCalculator` computes optimal sequences on an empty board using movement/rotation primitives and adds an implicit `HardDrop` at goal.
- `DefaultFinesseService` resolves the analysis target from the mode (guidance/target hooks), merges calculator and mode-specific faults, and emits reducer actions. It does not mutate state.

## Modes (src/modes/\*.ts)

- Registered via `gameModeRegistry` without the reducer branching on mode names.
- Contracts are pure hooks:
  - `initialConfig`, `initModeData`.
  - `onBeforeSpawn` (override next piece), `getGuidance` (target/labels/visual flags).
  - `getTargetFor`, `getExpectedPiece` (assist analysis and correctness checks).
  - `onResolveLock` returns `{ action: "commit" | "retry" }`.
  - RNG ownership hooks: `createRng`, `getNextPiece`, `getPreview`.
- Provided modes: `FreePlayMode`, `GuidedMode`.
- `spawn-service.ts` centralizes preview refills and RNG selection; preview is topped up via `RefillPreview`/`ReplacePreview` only.

## Core Mechanics (src/core/\*.ts)

- Board ops: collision, movement, lock, line detection/clearing, wall moves.
- SRS rotation with I and JLSTZ kick tables.
- 7-bag RNG plus interface to support mode-provided RNGs.
- Spawning/top-out logic decoupled from RNG ownership.

## Settings & Persistence

- Settings modal emits a single `settings-change` event with partial settings; the app converts to branded types and dispatches `UpdateTiming`/`UpdateGameplay`.
- Keybindings persist to `localStorage` (managed in `src/input/keyboard.ts`); `KeyboardEvent.code` matching supports all keys including standalone modifiers.
- When the modal is open, `<body>` has `settings-open`; input handlers ignore gameplay keys.

## Determinism & Timing

- One fixed 60 FPS loop drives both input update and physics `Tick` using the same `performance.now()` timestamp. Input handlers receive `nowMs` for deterministic DAS/ARR behavior.
- Gameplay is deterministic from `(Seed, TimingConfig, ProcessedInputLog per piece)`.
- Gravity defaults off for training; soft drop can be numeric multiplier or `"infinite"`.

## Testing & Quality Gate

- Strict TS config: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `useUnknownInCatchVariables`, etc.
- ESLint flat config enforces no default exports, import ordering, promise discipline, and no-explicit-any (with typed alternatives). No TS/ESLint suppressions are allowed; fix root causes.
- Tests: Jest unit tests for utilities (e.g., KeyBindingManager), reducer flows, and compile-time invariants under `tests/types` using `Equals`/`Expect` to lock down unions and branded constraints.
- Pre-commit gate: `npm run pre-commit` runs typecheck, lint (fix), tests, formatting. Changes must pass with zero lint errors.

## Conventions

- Prefer readonly arrays/objects and `as const` where appropriate.
- Use exhaustive `switch` with `assertNever` on discriminated unions.
- Confine boundary parsing/validation to constructors/guards; core assumes branded inputs.
- Keep modules small, pure, and composable; push side-effects to edges (input, time, DOM, storage, audio).

## Defaults (current)

- DAS: 133 ms; ARR: 2 ms; Lock delay: 500 ms; Line clear delay: 0 ms.
- Gravity: off by default; Soft drop: multiplier (10) or `"infinite"`.
- Finesse cancel window: 50 ms.

## Roadmap Notes

- Replays: serialize `(seed, timing, processed input logs)` to replay sessions deterministically.
- Additional modes can own RNG fully via the mode hooks without touching the reducer.

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
