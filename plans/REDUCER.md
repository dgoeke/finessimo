Issue: Our reducer already has great functional programming bones; it’s just doing too much in one file. Here’s a strategy that keeps the Haskell-ish vibe (pure functions, immutable data, ADTs via discriminated unions, branded primitives, exhaustive handling) while making the codebase easier to reason about and test.

# 1) Slice by **domain**, not by “actions”

Right now, actions from many domains are interleaved (spawn/hold/queue, physics/lock delay, gravity, line clear staging, stats, UI). Pull each concern into its own pure module with a tiny public surface:

```
src/engine/
  reducer.ts                // tiny orchestrator, no domain logic
  init.ts                   // createInitialState, defaults
  invariants.ts             // runtime asserts used in dev
  selectors.ts              // pure derived reads

  physics/
    gravity.ts              // gravity interval + step
    lock-delay.machine.ts   // lock delay ADT + transitions
    contact.ts              // isAtBottom + contact transitions glue

  gameplay/
    spawn.ts                // Spawn/Hold/queue consumption; topout check
    hold.ts
    queue.ts                // RNG integration and preview queue mgmt
    movement.ts             // tap/repeat/hard/soft moves (no physics)
    rotation.ts             // tryRotate + SRS kicks (already elsewhere)

  scoring/
    stats.ts                // base deltas + derive() recompute
    line-clear.ts           // pending lock → clear lines → animation staging

  ui/
    effects.ts              // UiEffect push/prune
    overlays.ts             // guidance, prompts, decorations
```

Each module exports pure functions like `apply(state, action) => state` for just its domain. The “root” reducer simply composes them and runs a *single* physics post-step.

# 2) Make “physics” a small **state machine** (no `null`s)

Replace `lockDelayStartTime: Timestamp | null` + `lockDelayResetCount: number` with a discriminated union so invalid combinations are unrepresentable:

```ts
// brands
type ResetCount = Branded<number, "ResetCount">;
type Ms = ReturnType<typeof createDurationMs>;

// ADT
export type LockDelayState =
  | { tag: "Airborne" }
  | { tag: "Grounded"; start: Timestamp; resets: ResetCount };

// Constructors
export const Airborne: LockDelayState = { tag: "Airborne" } as const;
export const Grounded = (start: Timestamp, resets: ResetCount = 0 as ResetCount): LockDelayState =>
  ({ tag: "Grounded", start, resets });

// Pure step
export function stepLockDelay(params: {
  ld: LockDelayState;
  ts: Timestamp;
  grounded: boolean;
  movedWhileGrounded: boolean;
  maxResets: number;
  delayMs: Ms;
}): { ld: LockDelayState; lockNow: boolean; ldChanged: boolean } {
  // exhaustive match on ld.tag; encode reset-limit + elapsed logic here
}
```

Now your “postProcessLockDelay” becomes:

```ts
export function physicsPostStep(prev: GameState, next: GameState, action: Action): GameState {
  if (!next.active) return next;  // nothing to do

  const groundedBefore = prev.active ? isAtBottom(prev.board, prev.active) : false;
  const groundedNow    = isAtBottom(next.board, next.active);
  const moved          = pieceChanged(prev.active, next.active);

  const { shouldProcess, timestamp } = shouldProcessLockDelay(action, next);
  if (!shouldProcess || !timestamp) return next;

  const { ld, lockNow } = stepLockDelay({
    ld: next.physics.lockDelay,
    ts: timestamp,
    grounded: groundedNow,
    movedWhileGrounded: groundedNow && groundedBefore && moved && canActionResetLockDelay(action.type),
    maxResets: next.timing.lockDelayMaxResets,
    delayMs: next.timing.lockDelayMs,
  });

  if (!lockNow) return { ...next, physics: { ...next.physics, lockDelay: ld } };

  // emit pendingLock via pure function
  const pending = createPendingLock(next.board, next.active, next.physics.isSoftDropping ? "softDrop" : "gravity", timestamp);
  return {
    ...next,
    active: undefined,
    pendingLock: pending,
    physics: { ...next.physics, lockDelay: Airborne },
    status: "resolvingLock",
  };
}
```

Also move gravity into `physics/gravity.ts` with a single `gravityStep(state, ts) => state`, purely computed from timing + soft-drop settings.

# 3) Strengthen your **state ADTs** so branches disappear

You already have `PlayingState`, `LineClearState`, `TopOutState`. Make `GameState` a strict union keyed on `phase` (or keep `status` field but type it as the discriminator) and push fields only where they belong:

```ts
type Phase =
  | { phase: "playing"; active: ActivePiece; pendingLock: null }
  | { phase: "resolvingLock"; active: undefined; pendingLock: PendingLock }
  | { phase: "lineClear"; active: undefined; pendingLock: null; physics: { ...; lineClearLines: readonly number[]; lineClearStartTime: Timestamp } }
  | { phase: "topOut"; active: undefined; pendingLock: null };

export type GameState = BaseShared & Phase;
```

With this, branches like “if (state.status !== 'resolvingLock') return state;” vanish because the handler for `CommitLock` simply accepts `Extract<GameState, { phase: "resolvingLock" }>` (a *narrowed* state type) and your root reducer routes only valid actions to it.

# 4) Keep actions lean; introduce **internal events** (optional)

Separate external Inputs from internal Events:

```ts
type InputAction =
  | { type: "TapMove"; dir: -1 | 1; timestampMs: Timestamp }
  | { type: "Rotate"; dir: "cw" | "ccw"; timestampMs: Timestamp }
  | ...;

type SystemEvent =
  | { type: "Tick"; timestampMs: Timestamp }
  | { type: "GravityTick"; timestampMs: Timestamp }
  | { type: "LockDelayTimeout"; timestampMs: Timestamp }
  | { type: "LinesCleared"; lines: readonly number[]; timestampMs: Timestamp };

export type Action = InputAction | SystemEvent;
```

Your root `update` stays pure but may *emit* zero or more `SystemEvent`s as **data** (effects), letting the loop drive follow-up updates deterministically without hidden post-processing.

# 5) Compose the reducer from **sub-handlers**

Keep your `ActionHandlerMap`, but build it from domain maps so the file stays tiny:

```ts
// engine/reducer.ts
import * as movement from "./gameplay/movement";
import * as rotation from "./gameplay/rotation";
import * as spawn    from "./gameplay/spawn";
import * as physics  from "./physics/post";
import * as scoring  from "./scoring/line-clear";
import * as stats    from "./scoring/stats";
import * as ui       from "./ui/effects";
import { type ActionHandlerMap } from "./types";

const handlers = {
  ...movement.handlers,
  ...rotation.handlers,
  ...spawn.handlers,
  ...scoring.handlers,
  ...stats.handlers,
  ...ui.handlers,
} satisfies Partial<ActionHandlerMap>;

export const reducer = (state: GameState | undefined, action: Action): GameState => {
  if (!state) return init.fromAction(action); // only Init allowed here
  const handler = handlers[action.type] as ActionHandlerMap[typeof action.type];
  const next = handler ? handler(state, action as never) : state;
  return physics.postStep(state, next, action); // single physics post
};
```

This preserves your existing `dispatch` pattern and compile-time exhaustiveness (use a build-time test that `keyof typeof handlers` equals `Action["type"]`).

# 6) Push **stats** math behind a tiny API

All the stats math (base deltas + recomputed deriveds) lives in `scoring/stats.ts` with branded counts:

```ts
type PieceCount = Branded<number, "PieceCount">;
type LineCount  = Branded<number, "LineCount">;

export function onLockCommitted(s: Stats, cleared: LineCount, ts: Timestamp): Stats { ... }
export function onInputsLogged(s: Stats, delta: { totalInputs: number; optimalInputs: number; ... }): Stats { ... }
export function derive(s: Stats): Stats { ... } // recompute accuracy, ppm, lpm
```

Handlers call this API; no one else touches stats internals.

# 7) Brands & narrow types (quick wins)

* Introduce `ResetCount`, `PiecePerMinute`, `LinesPerMinute`, `TickCount`, `GravityIntervalMs`.
* Replace `number[]` line indices with `readonly NonEmptyArray<LineIndex>` where appropriate.
* Guard creators like `createGridCoord` already exist—add type guards `isActive(state): state is Extract<GameState, {phase: "playing"}>` and use them per handler.

# 8) Testing: invariants & properties (fast-check)

Property tests hit the physics machine without UI noise:

* **Invariant**: `LockDelayState.tag === "Grounded" ⇒ isAtBottom(board, active) === true`.
* **Invariant**: `resets ≤ lockDelayMaxResets`.
* **Progress**: from `Grounded` with `elapsed ≥ lockDelayMs && resets ≥ maxResets ⇒ lockNow`.
* **Idempotence**: applying `physicsPostStep` twice without state/time change is identity.
* **No-throw**: any sequence of actions never yields structurally invalid `GameState` (the type system should already guarantee most of this).

# 9) Migration plan (safe, incremental)

1. **Extract** `init.ts`, `stats.ts`, `line-clear.ts`, `ui/effects.ts`. Wire them back via imports (no behavior change).
2. Replace `physics.lockDelayStartTime + lockDelayResetCount` with `LockDelayState` and update only physics-related helpers to use it. Keep the same public behavior.
3. Move gravity logic into `physics/gravity.ts`; have `Tick` call `gravityStep` and then `physicsPostStep`.
4. Introduce `phase` discriminator and tighten types per phase. Fix the few spots that assumed `active` existed.
5. Split the big `actionHandlers` into domain maps; re-export a merged object `satisfies ActionHandlerMap`.
6. Optional: introduce `SystemEvent` as data to replace your current ad-hoc post-processing.

# 10) Tiny examples to copy-paste

**Lock delay ADT in physics state:**

```ts
// types.ts
export type PhysicsState = Readonly<{
  isSoftDropping: boolean;
  lastGravityTime: Timestamp;
  lockDelay: LockDelayState;          // <— replaces startTime/resetCount pair
  lineClearLines: readonly number[];
  lineClearStartTime: Timestamp | null;
  activePieceSpawnedAt: Timestamp | null;
}>;
```

**Movement sub-handler (pure, no physics):**

```ts
// gameplay/movement.ts
export const handlers = {
  TapMove: (s, a) => !s.active ? s : { ...s, active: tryMove(s.board, s.active, a.dir, 0) ?? s.active },
  RepeatMove: (s, a) => !s.active ? s : { ...s, active: tryMove(s.board, s.active, a.dir, 0) ?? s.active },
} as const;
```

**Commit lock is phase-specific:**

```ts
// scoring/line-clear.ts
export const handlers = {
  CommitLock: (s: Extract<GameState, { phase: "resolvingLock" }>, _a) => {
    const next = applyPendingLock(s, s.pendingLock);
    return (durationMsAsNumber(next.timing.lineClearDelayMs) === 0)
      ? clearImmediately(next)
      : stageLineClear(next);
  },
} as const;
```

---

## What you’ll get from this

* Smaller files with crystal-clear ownership.
* Invariants enforced by types (no “lockDelayStartTime is null… but resetCount is 9” states).
* Physics is *explicitly modeled* as a machine: easier to reason about and test.
* The root reducer is just wiring: no mixed concerns, no hidden post-processing.

If you want, I can sketch the initial `lock-delay.machine.ts` with your exact semantics and swap it into your current reducer without touching any gameplay logic—that’s usually the highest-leverage first step.
