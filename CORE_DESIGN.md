# Finessimo — Functional Core (Design Doc)

## 1) High‑level architecture

```
Device (keyboard/touch/gamepad)
          │
          ▼
  Input collection (ms) ──→  Quantize to ticks (ceil rule)
          │
          ▼
  **Control layer (pure)**
  - DAS/ARR transducer (tick-based)
  - emits domain **Commands[]** for tick T
          │
          ▼
  **Engine Core (pure)**
  step(state, tick, Commands[]) → { state', DomainEvents[] }
    1. ApplyCommands (no timing)
    2. AdvancePhysics (gravity, lock delay)
    3. ResolveTransitions (lock, clear, spawn/topout)
          │
          ├──► **Event consumers (pure)**
          │      - Finesse: per‑piece command trace → analysis
          │      - Game modes: react to events / dispatch extra commands
          │
          └──► Presentation/UI (read‑only state + events)
```

**Design tenets**

- _One_ entry point per tick (`step`), _no post‑step override_.
- Core consumes **Commands** (device‑agnostic), emits **DomainEvents** (facts).
- All time inside the core is **ticks** (integers); ms↔tick mapping is an **app concern**.
- _ARR=0_ handled as a first‑class **ShiftToWall** command (no board knowledge in control).
- Finesse & analytics live **outside** the core; they read events and the per‑piece command trace maintained by the control layer.

---

## 2) Time model (tick‑first)

- **TPS** (ticks per second) is fixed (e.g., 120). Rendering can run at any Hz.
- Device events (ms) are **quantized** to ticks with the **ceil rule**:
  - `tick = ceil(eventTimeMs / msPerTick)` — never process inputs early; worst‑case ≤ 1 tick of latency.
- Gravity / soft‑drop use **fixed‑point accumulators** (`cells32 = Q16.16`) to support non‑integer speeds deterministically.
- Lock delay uses **integer tick deadlines**.
- Presentation can do slow/fast‑mo by changing TPS→ms mapping without touching the core.

---

## 3) Public interfaces

### 3.1 Types: time, ids, and core config

```ts
// Time
export type Tick = number & { readonly brand: "Tick" };

// Piece instance identity (monotonic per game)
export type PieceInstanceId = number & { readonly brand: "PieceInstanceId" };

// Engine configuration (tick-based)
export type TimingTicks = Readonly<{
  tps: number; // ticks per second (engine update rate)
  dasTicks: number; // DAS start
  arrTicks: number; // ARR interval; 0 ⇒ sonic
  lockDelayTicks: number; // lock delay
  lockMaxResets: number; // e.g., 15
  lineClearDelayTicks: number;
  gravityCells32: number; // Q16.16 cells per tick (gravity)
  softDropCells32?: number; // override; if omitted, use multiplier
  softDropMultiplier?: number; // e.g., 20x
}>;

export type EngineConfig = Readonly<{
  timing: TimingTicks;
  previewCount: number;
  rngSeed: number;
  holdEnabled: boolean;
  finesseFeedbackEnabled?: boolean;
}>;
```

### 3.2 Commands (what the core **consumes**)

```ts
export type Command =
  | { kind: "MoveLeft"; source?: "tap" | "repeat" }
  | { kind: "MoveRight"; source?: "tap" | "repeat" }
  | { kind: "ShiftToWallLeft" } // for ARR=0 sonic
  | { kind: "ShiftToWallRight" }
  | { kind: "RotateCW" }
  | { kind: "RotateCCW" }
  | { kind: "SoftDropOn" }
  | { kind: "SoftDropOff" }
  | { kind: "HardDrop" }
  | { kind: "Hold" };
```

> Note: `source` is **metadata** used by analytics; the core never branches on it.

### 3.3 Domain events (what the core **emits**)

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

### 3.4 Engine state & API

```ts
export type ActivePiece = {
  instanceId: PieceInstanceId;
  id: PieceId;
  rot: Rot;
  x: GridCoord;
  y: GridCoord;
};

export type PhysicsState = Readonly<{
  // fixed-point vertical motion
  fallAccum32: number; // Q16.16 cells
  softDrop: boolean;
  // lock delay machine
  lock:
    | { tag: "Airborne"; resets: number }
    | { tag: "Grounded"; startTick: Tick; resets: number };
}>;

export type GameState = Readonly<{
  status: "playing" | "resolvingLock" | "lineClear" | "topOut";
  board: Board;
  active?: ActivePiece;
  pendingLock?: {
    source: "ground" | "hardDrop";
    finalPos: { x: GridCoord; y: GridCoord; rot: Rot };
  };
  hold?: PieceId;
  canHold: boolean;
  queue: PieceId[]; // next pieces
  rng: PieceRandomGenerator;
  physics: PhysicsState;
  stats: Stats; // pps, lines, etc. (purely derived by scoring module)
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
```

**Ordering inside `step`**

1. **ApplyCommands** (no timing): movement, rotation, hold, hard/soft‑drop toggles → emit `Moved…/Rotated/Held/SoftDrop…` as appropriate; set flags for lock‑reset eligibility.
2. **AdvancePhysics** with tick accumulators:
   - Add gravity (and soft‑drop override) into `fallAccum32`, attempt discrete cell descents (`while fallAccum32 ≥ 1`), update grounded status.
   - Lock machine transition (`Airborne ↔ Grounded`), apply **reset caps** (`lockMaxResets`), emit `LockStarted/Reset/Locked`.
3. **ResolveTransitions** (only if `Locked`): place piece, clear lines (`LinesCleared`), spawn next (`PieceSpawned`) or `TopOut`. Reset physics/LD for next piece.

---

## 4) Control layer (outside core, pure)

Quantized key transitions per tick in, **Commands[]** out.

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

export type ControlConfig = Readonly<{
  dasTicks: number;
  arrTicks: number; // 0 ⇒ sonic
}>;

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

**ARR = 0 (sonic) rule**: when `tick ≥ dasDeadlineTick` and `arrTicks === 0`, emit **one** `ShiftToWallLeft/Right` command and clear repeat scheduling. The core performs the flood move; the control layer stays board‑agnostic.

---

## 5) Finesse & analytics (outside core)

- Maintain a **per‑piece command trace** keyed by `piece.instanceId`.
  - On `PieceSpawned`: start a trace; keep a snapshot of board at spawn if needed by the calculator.
  - When the control layer emits commands for that piece, append to the trace.
  - On `Locked`: finalize the trace and call finesse:

```ts
export type FinesseTrace = ReadonlyArray<Command>; // for the piece
export function analyzePiece(
  boardAtSpawn: Board,
  target: Placement,
  trace: FinesseTrace
): FinesseResult;
```

- Engine events are the authoritative history; the core does **not** store a processed input log.

---

## 6) Directory layout (proposal)

```
src/
  tick-core/
    index.ts               // init, step
    commands.ts            // Command union
    events.ts              // DomainEvent union
    state.ts               // GameState, PhysicsState
    physics/
      gravity.ts           // fixed-point vertical motion
      lock-delay.ts        // Airborne/Grounded state machine (tick-based)
    gameplay/
      movement.ts          // left/right/shift-to-wall (board-aware)
      rotation.ts
      hold.ts
      spawn.ts
    scoring/
      line-clear.ts
      stats.ts
  control/                 // pure DAS/ARR transducer
    index.ts               // controlInit, controlStep
    types.ts               // ControlState, KeyEdge
  analytics/
    finesse.ts             // analyzePiece adapter
  integration/
    excalibur-loop.ts      // example glue (optional, non-core)
```

Where possible, **reuse** existing modules from `src/core` and `src/engine/gameplay/*` with minimal edits.

---

## 7) Mapping from the current system → new components

| Current file / concern                                 | New home                                       | Notes                                                                                                     |
| ------------------------------------------------------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/state/reducer.ts`                                 | `tick-core/index.ts` (`step`) + `gameplay/*`   | Fold action handlers into **ApplyCommands**; delete external post‑step; reducer becomes the orchestrator. |
| `src/engine/physics/post-step.ts`                      | **Deleted**; logic moved into `step` phase 2/3 | Lock/physics advancement called inside `step`, never overrides reducer after the fact.                    |
| `src/engine/physics/lock-delay.machine.ts`             | `tick-core/physics/lock-delay.ts`              | Keep the Airborne/Grounded machine; switch timestamps → **ticks** and return `{ lockNow, nextState }`.    |
| `src/engine/physics/gravity.ts`                        | `tick-core/physics/gravity.ts`                 | Replace ms intervals with **Q16.16 cells per tick** accumulator.                                          |
| `src/input/machines/das.ts` (robot3)                   | `control/index.ts`                             | Replace with a ~100‑line pure transducer; no robot3; outputs **Commands** per tick.                       |
| `src/input/keyboard/handler.ts`                        | App integration                                | Remains device‑level (DOM); produces `KeyEdge[]` per tick for the control layer.                          |
| `src/state/types.ts` → `processedInputLog`             | **Removed from core**                          | Tracked externally as a **per‑piece command trace**.                                                      |
| `src/engine/finesse/log.ts`                            | `analytics/finesse.ts`                         | Stop mutating game state; analyze finalized per‑piece traces.                                             |
| `src/engine/finesse/service.ts`                        | `analytics/finesse.ts`                         | Provide `analyzePiece(...)` and event handlers; no core callbacks.                                        |
| `src/engine/gameplay/*` (movement/rotation/hold/spawn) | `tick-core/gameplay/*`                         | Largely reusable; adapt signatures to tick‑based events and `ShiftToWall…`.                               |
| `src/engine/scoring/*`                                 | `tick-core/scoring/*`                          | Reuse with minor signature updates.                                                                       |
| `src/modes/*`                                          | Event consumers                                | Subscribe to DomainEvents; emit additional **Commands** if needed.                                        |
| `TimingConfig` (ms-based) in `state/types.ts`          | `TimingTicks` (tick-based)                     | Convert at the app boundary (frames@60 → ticks via `round(frames * TPS/60)`).                             |

---

## 8) Skeletons / TODO logic

### 8.1 Engine core

```ts
// tick-core/index.ts
import { applyCommands } from "./phases/apply-commands";
import { advancePhysics } from "./phases/advance-physics";
import { resolveTransitions } from "./phases/resolve-transitions";

export function init(cfg: EngineConfig, startTick: Tick): StepResult {
  // TODO: construct initial GameState using existing createEmptyBoard, seeded rng, etc.
  // - status: "playing"
  // - physics.lock = { tag: "Airborne", resets: 0 }
  // - physics.fallAccum32 = 0
  // - spawn first piece → emit PieceSpawned
  return {
    state: initial,
    events: [
      /* PieceSpawned */
    ],
  };
}

export function step(
  s: GameState,
  tick: Tick,
  cmds: readonly Command[]
): StepResult {
  // Invariant: step is pure; do not mutate s
  let state = { ...s, tick };
  const events: DomainEvent[] = [];

  ({ state, events: ev } = applyCommands(state, cmds, tick));
  events.push(...ev);
  ({ state, events: ev } = advancePhysics(state, tick));
  events.push(...ev);
  ({ state, events: ev } = resolveTransitions(state, tick));
  events.push(...ev);

  return { state, events };
}
```

```ts
// tick-core/phases/apply-commands.ts
export function applyCommands(
  s: GameState,
  cmds: readonly Command[],
  tick: Tick
): StepResult {
  // TODO:
  // - For each cmd, tryMove / tryRotate / hold / hardDrop:
  //   - Emit domain events (MovedLeft/Right, Rotated, Held, SoftDropStarted/Ended)
  //   - Track a boolean "shouldResetLock" if piece is grounded and position/rot changed
  // - If ShiftToWall*, perform flood move until blocked in *this phase*
  // - Do NOT alter physics timers here (only mark intent flags)
  return { state: s2, events };
}
```

```ts
// tick-core/physics/lock-delay.ts
export function stepLockDelay(
  ld: PhysicsState["lock"],
  grounded: boolean,
  shouldReset: boolean,
  tick: Tick,
  cfg: TimingTicks
): { next: PhysicsState["lock"]; lockNow: boolean; events: DomainEvent[] } {
  // TODO:
  // - Airborne → Grounded on first ground contact (emit LockStarted)
  // - While Grounded:
  //   - if shouldReset and resets < lockMaxResets: reset startTick=tick, ++resets (emit LockReset)
  //   - if tick - startTick >= lockDelayTicks: lockNow=true
  // - Respect reset cap: once at cap, movement doesn't reset anymore
}
```

```ts
// tick-core/physics/gravity.ts
export function advanceVertical(
  s: GameState,
  cfg: TimingTicks
): { state: GameState; movedDown: boolean } {
  // TODO:
  // - cellsPerTick32 = softDrop ? (cfg.softDropCells32 ?? cfg.gravityCells32 * (cfg.softDropMultiplier ?? 1)) : cfg.gravityCells32
  // - accum = s.physics.fallAccum32 + cellsPerTick32
  // - steps = accum >> 16   // integer cells
  // - carry = accum & 0xFFFF
  // - For i in [1..min(steps, MAX_STEPS)]: tryMoveDown()
  //   - if blocked: grounded=true; break
  // - Update fallAccum32 = carry (or 0 if blocked on first)
  // - Return whether position changed vertically
}
```

```ts
// tick-core/phases/advance-physics.ts
export function advancePhysics(s: GameState, tick: Tick): StepResult {
  // TODO:
  // - Determine grounded after vertical advancement
  // - Call stepLockDelay with grounded + shouldReset (from applyCommands)
  // - If lockNow: set pendingLock; emit Locked (with source); status="resolvingLock"
}
```

```ts
// tick-core/phases/resolve-transitions.ts
export function resolveTransitions(s: GameState, tick: Tick): StepResult {
  // TODO (when status === "resolvingLock"):
  // - Place piece on board
  // - Compute line clears; emit LinesCleared
  // - Update stats
  // - Spawn next piece (or TopOut); emit PieceSpawned / TopOut
  // - Reset physics.lock → Airborne, fallAccum32=0, softDrop=false
  // else no-op
}
```

### 8.2 Control transducer

```ts
export function controlInit(cfg: ControlConfig): ControlState {
  return {
    leftDown: false,
    rightDown: false,
    softDropDown: false,
    dasDeadlineTick: null,
    nextRepeatTick: null,
    activeDir: null,
  };
}

export function controlStep(
  cfg: ControlConfig,
  c: ControlState,
  tick: Tick,
  edges: readonly KeyEdge[]
): { next: ControlState; commands: Command[] } {
  const cmds: Command[] = [];
  let {
    leftDown,
    rightDown,
    softDropDown,
    dasDeadlineTick,
    nextRepeatTick,
    activeDir,
  } = c;

  // 1) fold key edges
  for (const e of edges) {
    // TODO: toggle booleans; emit immediate MoveLeft/MoveRight on new down; set activeDir
    // TODO: SoftDropOn/Off, HardDrop, Rotates, Hold
  }

  // 2) DAS/ARR
  if (activeDir && dasDeadlineTick !== null && tick >= dasDeadlineTick) {
    if (cfg.arrTicks === 0) {
      cmds.push(
        activeDir === "Left"
          ? { kind: "ShiftToWallLeft" }
          : { kind: "ShiftToWallRight" }
      );
      dasDeadlineTick = null;
      nextRepeatTick = null; // sonic: done
    } else {
      if (nextRepeatTick === null)
        nextRepeatTick = addTicks(dasDeadlineTick, cfg.arrTicks);

      if (tick >= nextRepeatTick) {
        cmds.push(
          activeDir === "Left"
            ? { kind: "MoveLeft", source: "repeat" }
            : { kind: "MoveRight", source: "repeat" }
        );
        nextRepeatTick = (nextRepeatTick + cfg.arrTicks) as Tick;
      }
    }
  }

  // 3) return next state
  return {
    next: {
      leftDown,
      rightDown,
      softDropDown,
      dasDeadlineTick,
      nextRepeatTick,
      activeDir,
    },
    commands: cmds,
  };
}
```

---

## 9) Migration plan (phased, low‑risk)

1. **Introduce DomainEvents** into the current reducer and emit them alongside state changes. Wire finesse/modes to listen to events (without yet removing post‑step).
2. **Inline the physics post‑step** into the reducer as a “phase 2/3”. Delete `engine/physics/post-step.ts`. Ensure there is no state override after the reducer.
3. **Remove `processedInputLog` from `GameState`**; move finesse logging to a per‑piece command trace outside the core. Update `engine/finesse/service.ts` to consume the trace.
4. **Replace robot3 DAS** with `controlStep` (pure). Keyboard/touch handlers now produce `KeyEdge[]` per tick, not direct Actions.
5. **Convert TimingConfig (ms) → TimingTicks** at the app boundary; store tick values in config; unify to ticks internally.
6. **Add ShiftToWall commands** and adapt movement to flood horizontally inside `applyCommands`.
7. **Add `ActivePiece.instanceId`** and carry it in events for trace correlation.
8. Remove frame/ms timing remnants; ensure `GameState.tick` increments exactly once per engine `step`.

At each phase, keep unit tests green by adding adapter shims where needed.

---

## 10) Testing & determinism

- **Golden replays**: record `{ tick, commands[] }` sequences; re‑run to assert identical DomainEvent streams and final states.
- **Property tests**:
  - “If grounded and no resets left, lock occurs within `lockDelayTicks`.”
  - “ARR=0 produces a single ShiftToWall and no further horizontal moves that tick.”
  - “SoftDropOn increases vertical descent rate; SoftDropOff restores gravity.”
- **Cross‑rate invariance**: same replay at TPS ∈ {60,120,240} yields identical event sequences (modulo tick labels scaled by conversion).
