# Finessimo — Tick-Based Functional Core (Design)

This document is the single source of truth for the engine, control layer, analytics, and integration boundaries. It merges and consolidates the content previously split across CORE_DESIGN.md and TICK_CORE_DESIGN.md.

## 1) Principles

- Functional core with immutable state and pure reducers.
- Unidirectional data flow: UI → Input Handler → Control (pure) → Engine `step` (pure) → State + Events → UI/Consumers.
- Time in the core is ticks (integers). Devices/time (ms) are converted to ticks at the boundary.
- Event-sourced: the engine emits DomainEvents (facts). Consumers subscribe; they don’t mutate core state.
- Make invalid states unrepresentable using branded primitives, discriminated unions, and guards.
- Side effects live only at the edges (DOM, timers, persistence).
- Deterministic: given config, seed, and per-tick command buckets, outcomes are replayable.

---

## 2) Architecture Overview

```
Device input (keyboard/touch/gamepad) ──► KeyEdges[tick]
                     │
                     ▼
            controlStep()  // DAS/ARR transducer, pure
        (ControlState, KeyEdges) -> { nextControlState, commands }
                     │
                     ▼
              Mode.step()  // pure game-mode logic
  (ModeState, {engine, lastEvents, controlCommands})
   -> { nextModeState, engineOps?, plan?, effects? }
                     │
          ┌──────────┴────────────────────────┐
          │        apply engineOps            │
          │      plan/shape final commands    │
          └──────────┬────────────────────────┘
                     ▼
               engine.step()
           (engineState, commands) -> { state', events }
                     │
                     ▼
       Runtime collects { state', nextControl, nextMode, events } + effects
```

Design tenets

- One entry point per tick (`step`). No post-step overrides.
- Control layer is board-agnostic; ARR=0 handled via ShiftToWall commands.
- Engine consumes device-agnostic Commands; emits DomainEvents. No device concerns inside.

---

## 3) Time Model (Tick-First)

- TPS (ticks per second) is fixed (e.g., 120). Rendering can run at any Hz.
- Quantization from ms to ticks uses the ceil rule: `tick = ceil(eventMs / msPerTick)` to avoid early processing; worst-case ≤ 1 tick latency.
- Gravity/soft-drop use fixed-point accumulators (`Q16.16` cells per tick) for deterministic non-integer speeds.
- Lock delay uses integer tick deadlines and a reset counter with a hard cap.
- Slow/fast motion is an app concern (TPS↔ms mapping). The core remains tick-pure.
- Cross-rate invariance: replays at different TPS yield the same event/state sequence modulo tick labels scaled by conversion.

---

## 4) Public Interfaces

Types are shown in a Haskell-style flavor using nominal brands to avoid mixing look‑alike primitives. Concrete definitions live under `src/engine/types.ts` and friends.

### 4.1 Time, IDs, and Engine/Control Config

```ts
// Time and fixed-point
export type Tick = number & { readonly brand: "Tick" };
export type Q16_16 = number & { readonly brand: "Q16_16" }; // cells per tick (fixed-point)

// Per-piece identity (monotonic per game)
export type PieceInstanceId = number & { readonly brand: "PieceInstanceId" };

// Engine timing (tick-based, in core units)
export type TimingTicks = Readonly<{
  tps: number; // engine update rate
  lockDelayTicks: number; // lock delay window
  lockMaxResets: number; // cap on lock resets (e.g., 15)
  lineClearDelayTicks: number; // optional spawn/clear delay if modeled explicitly
  gravity32: Q16_16; // gravity in cells/tick (Q16.16)
  softDrop32?: Q16_16; // override for soft drop; else use multiplier
  softDropMultiplier?: number; // e.g., 20x if no explicit softDrop32
}>;

// Engine configuration (board + timing + RNG)
export type EngineConfig = Readonly<{
  width: number; // board width (e.g., 10)
  height: number; // visible board height (e.g., 20)
  previewCount: number; // next queue size
  timing: TimingTicks;
  rngSeed: number; // seed for piece RNG
  holdEnabled: boolean; // allow hold mechanic
  finesseFeedbackEnabled?: boolean; // analytics toggle
}>;

// Control layer configuration (outside the engine)
export type ControlConfig = Readonly<{
  dasTicks: number; // delay before auto-repeat
  arrTicks: number; // repeat interval; 0 ⇒ sonic (ShiftToWall)
}>;
```

### 4.2 Commands (what the engine consumes)

```ts
export type Command =
  | { kind: "MoveLeft"; source?: "tap" | "repeat" }
  | { kind: "MoveRight"; source?: "tap" | "repeat" }
  | { kind: "ShiftToWallLeft" } // ARR=0 sonic shift, board-aware execution happens in core
  | { kind: "ShiftToWallRight" }
  | { kind: "RotateCW" }
  | { kind: "RotateCCW" }
  | { kind: "SoftDropOn" }
  | { kind: "SoftDropOff" }
  | { kind: "HardDrop" }
  | { kind: "Hold" };
```

`source` is metadata for analytics; the engine does not branch on it.

### 4.3 Domain Events (what the engine emits)

```ts
export type DomainEvent =
  | {
      kind: "PieceSpawned";
      pieceId: PieceInstanceId;
      tetromino: PieceId;
      tick: Tick;
    }
  | { kind: "MovedLeft"; fromX: number; toX: number; tick: Tick }
  | { kind: "MovedRight"; fromX: number; toX: number; tick: Tick }
  | {
      kind: "Rotated";
      dir: "CW" | "CCW";
      kick: "none" | "wall" | "floor";
      tick: Tick;
    }
  | { kind: "SoftDropStarted"; tick: Tick }
  | { kind: "SoftDropEnded"; tick: Tick }
  | { kind: "LockStarted"; tick: Tick }
  | { kind: "LockReset"; reason: "move" | "rotate"; resets: number; tick: Tick }
  | {
      kind: "Locked";
      pieceId: PieceInstanceId;
      source: "ground" | "hardDrop";
      tick: Tick;
    }
  | { kind: "LinesCleared"; rows: number[]; count: 1 | 2 | 3 | 4; tick: Tick }
  | { kind: "Held"; swapped: boolean; tick: Tick }
  | { kind: "TopOut"; tick: Tick };
```

### 4.4 State & Engine API

```ts
export type ActivePiece = Readonly<{
  instanceId: PieceInstanceId;
  id: PieceId;
  rot: Rot;
  x: GridCoord;
  y: GridCoord;
}>;

export type PhysicsState = Readonly<{
  gravityAccum32: Q16_16; // Q16.16 cells
  softDropOn: boolean;
  grounded: boolean;
  lock:
    | { tag: "Airborne"; resets: number }
    | { tag: "Grounded"; startTick: Tick; resets: number; deadlineTick: Tick };
}>;

export type GameStatus = "playing" | "resolvingLock" | "lineClear" | "topOut";

export type GameState = Readonly<{
  status: GameStatus;
  board: Board;
  active?: ActivePiece; // undefined when spawning/clearing or topped out
  pendingLock?: {
    source: "ground" | "hardDrop";
    finalPos: { x: GridCoord; y: GridCoord; rot: Rot };
  };
  hold?: PieceId;
  canHold: boolean;
  queue: ReadonlyArray<PieceId>;
  rng: PieceRandomGenerator;
  physics: PhysicsState;
  stats: Stats; // derived scoring/pps module
  tick: Tick;
}>;

export type StepResult = Readonly<{
  state: GameState;
  events: readonly DomainEvent[];
}>;

export function init(cfg: EngineConfig, startTick: Tick): StepResult;
export function step(
  state: GameState,
  tick: Tick,
  cmds: readonly Command[]
): StepResult;
export function stepN(
  state: GameState,
  startTick: Tick,
  byTick: readonly (readonly Command[])[]
): StepResult;
```

---

## 5) Core Phases

1. ApplyCommands (no timing)

- Movement: left/right attempts, ShiftToWall for ARR=0, with collision via board helpers.
- Rotation: SRS with kick classification (`none`/`wall`/`floor`).
- Hold: obey “once per piece” rule and spawn-swap semantics.
- Soft drop: toggle flags; emit start/end events.
- Hard drop: flood to ground; mark for immediate lock.
- Track `lockResetEligibleThisTick` based on whether the piece was grounded when it moved/rotated.

2. AdvancePhysics (gravity + lock delay)

- Add gravity (or soft-drop override) into `gravityAccum32`; for each whole cell, attempt to descend.
- Track grounded/airborne transitions. When grounded, start lock timer; when airborne, clear it.
- Cap lock resets at `lockMaxResets`.
- If lock deadline reached or hard-dropped, produce `Locked` signal and pend resolution.

3. ResolveTransitions (placement → clearing → spawn/top-out)

- Place piece into the board; detect/emit `LinesCleared`.
- Update scoring/stats in a pure scoring module.
- Spawn next piece or emit `TopOut` if spawn position collides.
- Reset physics for the next piece: `gravityAccum32=0`, `softDropOn=false`, lock → Airborne.

Ordering is fixed: ApplyCommands → AdvancePhysics → ResolveTransitions. Only one state output per tick.

---

## 6) Control Transducer (Pure DAS/ARR)

Inputs: per-tick KeyEdges; Output: Commands[]. No board knowledge.

```ts
export type Key =
  | "Left"
  | "Right"
  | "SoftDrop"
  | "HardDrop"
  | "CW"
  | "CCW"
  | "Hold";
export type KeyEdge = { key: Key; type: "down" | "up" };

export type ControlState = Readonly<{
  leftDown: boolean;
  rightDown: boolean;
  softDropDown: boolean;
  dasDeadlineTick: Tick | null;
  nextRepeatTick: Tick | null;
  activeDir: "Left" | "Right" | null; // last horizontal intent
}>;

export function controlInit(cfg: ControlConfig): ControlState;
export function controlStep(
  cfg: ControlConfig,
  c: ControlState,
  tick: Tick,
  edges: readonly KeyEdge[]
): { next: ControlState; commands: Command[] };
```

ARR=0 (sonic) rule: when `tick ≥ dasDeadlineTick` and `arrTicks === 0`, emit a single `ShiftToWallLeft/Right` and clear repeat scheduling.

---

## 7) Finesse & Analytics (Outside the Core)

- Maintain a per-piece command trace keyed by `pieceInstanceId`.
- On `PieceSpawned`: begin a trace and optionally snapshot the board for the calculator.
- As Commands are emitted that affect that piece, append to the trace.
- On `Locked`: finalize the trace and run finesse analysis.

```ts
export type FinesseTrace = ReadonlyArray<Command>;
export function analyzePiece(
  boardAtSpawn: Board,
  target: Placement,
  trace: FinesseTrace
): FinesseResult;
```

Engine events form the authoritative history; the core does not store processed input logs.

---

## 8) Directory Layout

Canonical tick-based engine layout (aligned with current repo structure):

```
src/
  engine/                      # pure functional core (ticks)
    index.ts                   # init, step, stepN
    types.ts                   # GameState, PhysicsState, branded types
    commands.ts                # Commands union
    events.ts                  # DomainEvents union
    step/
      apply-commands.ts
      advance-physics.ts
      resolve-transitions.ts
    physics/
      gravity.ts
      lock-delay.ts
    gameplay/
      movement.ts
      rotation.ts
      spawn.ts
      clearing.ts
    core/                      # board/pieces/SRS helpers
      types.ts
      board.ts
      pieces.ts
      srs.ts
    utils/
      fixedpoint.ts
      rng.ts
  control/                     # pure DAS/ARR transducer
    index.ts
    types.ts
  analytics/
    finesse.ts                 # per-piece trace consumer
  adapters/
    config-adapter.ts          # frames@60 → ticks, ms → ticks helpers
    excalibur.ts               # optional engine integration
```

---

## 9) Testing, Replay, Determinism

- Step returns events; tests assert event sequences for given command buckets.
- Replays: store `{ tick, commands[] }` tuples. Deterministic given identical config/seed.
- Property tests examples:
  - If grounded and no resets remain, lock occurs within `lockDelayTicks`.
  - ARR=0 produces exactly one `ShiftToWall` and no further horizontal moves that tick.
  - SoftDropOn increases descent rate; SoftDropOff restores gravity.
- Cross-rate invariance: same replay at TPS ∈ {60, 120, 240} yields identical sequences modulo tick scale.

---

## 10) Excalibur Integration

Set the game loop’s fixed update FPS to TPS and call `engine.step` once per fixed update. Keep rendering decoupled from the engine’s tick rate.
