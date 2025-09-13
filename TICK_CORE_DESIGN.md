# Tick‑Oriented Tetris Core — Design & Migration Guide

**Status:** Draft scaffold (fill in TODOs as you implement)  
**Goal:** Pure, deterministic, event‑sourced **tick‑based** Tetris engine with a small control layer for DAS/ARR and clean integration points for modes, analytics, and UI.

---

## 1) Architecture Overview

```
Device (keyboard/gamepad/touch)
    └─► KeyEdges (per tick)
           └─► Control Transducer (pure, tick-based DAS/ARR)
                  └─► Commands (MoveLeft, RotateCW, ShiftToWallRight, ...)
                         └─► **ENGINE.step(state, tick, commands[])**
                                ├─ ApplyCommands (no time travel)
                                ├─ AdvancePhysics (gravity + lock delay)
                                └─ ResolveTransitions (place, clear lines, spawn/topout)
                                      └─► DomainEvents (facts)
                                             ├─► UI / Presentation
                                             ├─► Modes / Scoring
                                             └─► Analytics (e.g., Finesse)
```

**Time model:** Inside the engine, time is **ticks** only. The app converts ms→ticks and batches KeyEdges per tick.

**Determinism:** A replay is just a sequence of per‑tick command buckets: `[(tick0, cmds0), (tick1, cmds1), ...]`.

**Event‑sourcing:** The engine emits **DomainEvents** (e.g., `PieceSpawned`, `MovedLeft`, `LockReset`, `Locked`). Consumers never poke engine state directly.

---

## 2) Public API (TypeScript)

```ts
// engine/index.ts
export type Tick = number & { readonly brand: "Tick" };

export type EngineConfig = Readonly<{
  width: number;               // board width (e.g., 10)
  height: number;              // board height (e.g., 40; includes hidden rows)
  previewCount: number;        // next queue size
  lockDelayTicks: number;      // integer ticks
  maxLockResets: number;       // e.g., 15
  gravity32: number;           // Q16.16 cells per tick
  softDrop32?: number;         // Q16.16 override; or use multiplier
  rngSeed: number;
}>;

export type Command =
  | { kind: "MoveLeft";  source?: "tap" | "repeat" }
  | { kind: "MoveRight"; source?: "tap" | "repeat" }
  | { kind: "ShiftToWallLeft" }
  | { kind: "ShiftToWallRight" }
  | { kind: "RotateCW" } | { kind: "RotateCCW" }
  | { kind: "SoftDropOn" } | { kind: "SoftDropOff" }
  | { kind: "HardDrop" }
  | { kind: "Hold" };

export type DomainEvent =
  | { kind: "PieceSpawned"; pieceId: number; tick: Tick }
  | { kind: "MovedLeft"; fromX: number; toX: number; tick: Tick }
  | { kind: "MovedRight"; fromX: number; toX: number; tick: Tick }
  | { kind: "Rotated"; dir: "CW" | "CCW"; kick: "none" | "wall" | "floor"; tick: Tick }
  | { kind: "SoftDropToggled"; on: boolean; tick: Tick }
  | { kind: "LockStarted"; tick: Tick }
  | { kind: "LockReset"; reason: "move" | "rotate"; tick: Tick }
  | { kind: "Locked"; source: "ground" | "hardDrop"; pieceId: number; tick: Tick }
  | { kind: "LinesCleared"; rows: number[]; tick: Tick }
  | { kind: "Held"; swapped: boolean; tick: Tick }
  | { kind: "TopOut"; tick: Tick };

export type GameState = /* see engine/types.ts */ any;

export type StepResult = Readonly<{
  state: GameState;
  events: readonly DomainEvent[];
}>;

export function init(cfg: EngineConfig, startTick: Tick): StepResult;
export function step(state: GameState, tick: Tick, cmds: readonly Command[]): StepResult;
export function stepN(state: GameState, startTick: Tick, byTick: readonly (readonly Command[])[]): StepResult;
```

---

## 3) Core Phases

**ApplyCommands**  
- Validate/execute player intents: MoveLeft/Right, Rotate CW/CCW, Hold, SoftDrop toggles, HardDrop, ShiftToWall…  
- *Do not* mutate timers directly; instead set **flags** like `lockResetEligibleThisTick` and emit movement/rotation events.

**AdvancePhysics**  
- Gravity: integer or Q16.16 accumulator adds `gravity32` each tick; for each whole cell, try descend.
- SoftDrop: if `softDropOn`, use `softDrop32` (or multiplier).  
- Lock: maintain `lockState` (airborne/grounded, `deadline`, `resetCount`). If grounded and deadline reached, signal `lockNow`.

**ResolveTransitions**  
- If `lockNow`: place piece into board, detect and clear lines, spawn next (or `TopOut`), emit events.

---

## 4) Control Transducer (outside the engine)

```ts
// control/index.ts
type ControlConfig = Readonly<{ dasTicks: number; arrTicks: number }>;

type ControlState = {
  leftDown: boolean; rightDown: boolean;
  softDropDown: boolean;
  dasDeadlineTick: Tick | null;
  nextRepeatTick: Tick | null;
  activeDir: "Left" | "Right" | null;
  cfg: ControlConfig;
};

type KeyEdge = { key: "Left"|"Right"|"CW"|"CCW"|"HardDrop"|"SoftDrop"|"Hold"; type: "down"|"up" };

function controlStep(c: ControlState, tick: Tick, edges: readonly KeyEdge[]):
  { next: ControlState; commands: readonly Command[] } { /* see control/index.ts */ }
```

- On new Left/Right down: emit a `MoveLeft/MoveRight` immediately; start DAS timer (`dasDeadlineTick = tick + dasTicks`).  
- If `arrTicks===0` and tick ≥ `dasDeadlineTick`: emit `ShiftToWallLeft/Right` once.  
- If `arrTicks>0` and tick ≥ `nextRepeatTick`: emit repeated `MoveLeft/Right` and schedule next repeat.  
- SoftDropOn/Off are emitted on edges; HardDrop/Rotate/Hold emit immediately.

---

## 5) Types & Data

- **Ticks:** branded `number` so they’re not confused with pixels or counts.  
- **Physics:** Q16.16 fixed‑point integers for gravity and soft‑drop.  
- **IDs:** `pieceId` increments per spawn to correlate events with per‑piece traces.

See `engine/types.ts` for the shape of `Board`, `ActivePiece`, `PhysicsState`, and `RngState`.

---

## 6) Directory Layout

```
src/
  engine/                      # pure functional core (ticks)
    index.ts
    types.ts
    commands.ts
    events.ts
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
    utils/
      fixedpoint.ts
      rng.ts
  control/                     # pure DAS/ARR transducer
    index.ts
    types.ts
  analytics/
    finesse.ts                 # per-piece trace consumer (stub)
  adapters/
    config-adapter.ts          # frames@60 → ticks, ms → ticks helpers
    excalibur.ts               # optional integration sketch
```

---

## 7) Migration Map (old → new)

> **Note:** Adjust paths to your repo. Entries reflect typical locations you mentioned.

- `src/state/reducer.ts` → `src/engine/index.ts` (+ `step/*` modules).  
- `src/engine/physics/post-step.ts` → **deleted**; logic folded into `advance-physics.ts` phase.  
- `src/engine/physics/lock-delay.machine.ts` → `src/engine/physics/lock-delay.ts` (tick deadlines).  
- `src/input/machines/das.ts` (robot3) → `src/control/index.ts` (pure).  
- `src/input/keyboard/handler.ts` → remains device layer; now emits `KeyEdge[]` per tick.  
- `src/state/types.ts` (remove processedInputLog) → `src/engine/types.ts` (no processed input).  
- `src/engine/finesse/*` → `src/analytics/finesse.ts` (consumes events + per‑piece traces).  
- `src/engine/gameplay/*` → `src/engine/gameplay/*` (mostly portable, updated signatures).

---

## 8) Phased Migration Plan

1. **Introduce DomainEvents** in the current core; wire consumers (modes, analytics) to events instead of peeking at state.
2. **Inline post‑step** into the reducer path under a single orchestrator; ensure there’s exactly one state output per tick.
3. **Remove processed input logs** from engine state; start a per‑piece trace in the control/analytics layer finalized on `Locked`.
4. **Replace DAS/ARR** (robot3) with the pure `controlStep` that emits Commands per tick; add `ShiftToWall…` command for ARR=0.
5. **Flip time to ticks** internally: convert ms configs to tick configs once at startup; remove ms logic from engine.
6. Optional: Extract `gravity`, `lock-delay`, and gameplay helpers into the new module layout.

---

## 9) Skeleton / TODO Notes

This scaffold includes compilable **skeletons** with `TODO:` comments where you’ll fill in logic:
- Collision checks (left/right/down), SRS kicks, hold rules.
- Gravity descent loop and soft‑drop override.
- Lock delay machine (ground detection, reset counting).
- Placement, line clear detection, spawn/queue, top‑out.
- Control transducer edge handling and ARR=0 → ShiftToWall… mapping.

---

## 10) Testing & Replay

- Each `step` returns `events`; your tests can assert sequences for given command buckets.  
- Replays: store `{tick, commands[]}` tuples. Determinism is guaranteed as long as RNG seed and config match.

---

## 11) Excalibur Integration (optional)

Set `fixedUpdateFps` to your **TPS** and run one `step` per `preupdate` call. See `adapters/excalibur.ts` for a tiny example.

---

**End of document.**
