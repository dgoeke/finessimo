# Phase 12 — UI Effects & Selectors (Expanded)

> **Goal:** keep the reducer tiny and pure by (a) moving all ephemeral visual “pings” into a small UI-effects API with TTL pruning, and (b) exposing **pure selectors** for all derived reads (ghost piece, PPM/LPM, grounded/lock status, next queue views, etc.).
> **Style:** functional, immutable, narrow types (branded primitives + discriminated unions), variant-preserving state updates, no side effects.

## Outcomes

- A focused **`ui/effects.ts`** module:
  - `pushUiEffect`, `pruneUiEffects`, `clearUiEffects`, and tiny helpers.
  - TTL pruning runs in one place (called from `Tick` handler or a post-step).
  - Effects are _pure data_ (the renderer decides how to animate).

- A **`selectors.ts`** module with pure read functions:
  - Board/piece: ghost piece cells, grounded status, lock delay info.
  - Stats: PPM, LPM, finesse %, average inputs per piece.
  - Phase/status guards and UI overlay aggregations.

- Reducer becomes a simple orchestrator: handlers mutate nothing outside their domain; views depend only on selectors.

---

## Files to create / edit

- **Create:** `src/engine/ui/effects.ts`
- **Create:** `src/engine/selectors.ts`
- **(Edit)** `src/engine/reducer.ts` (replace any inline TTL pruning with calls to `pruneUiEffects`)
- **(No type changes required)** Phase-9 `GameState` union already includes `uiEffects: ReadonlyArray<UiEffect>` in `BaseShared`.

> Run after each step:
>
> ```bash
> npm run typecheck && npm test && npm run lint
> ```

---

## A. UI Effects API

### Context

You already keep `uiEffects` on `GameState`. Centralize _all_ mutations/pruning here so the reducer just calls tiny helpers. Keep it deterministic: no timers—`Tick` passes `timestampMs`, and pruning compares ages.

### `src/engine/ui/effects.ts` (paste)

```ts
import type { GameState, UiEffect } from "../../state/types";
import type { Timestamp } from "../../types/timestamp";
import { createTimestamp } from "../../types/timestamp";
import { createDurationMs, durationMsAsNumber } from "../../types/brands";

/** Small, branded helpers (optional but nice) */
type EffectId = string & { readonly __brand: "EffectId" };
export const createEffectId = (s: string): EffectId => s as EffectId;

/** Create a new effect (renderer will interpret `kind` + `payload`) */
export function makeEffect(params: {
  id?: string;
  kind: string; // consider tightening to a union later
  now: Timestamp;
  ttlMs: number; // pass raw number; we’ll brand it
  payload?: unknown;
}): UiEffect {
  const { id, kind, now, ttlMs, payload } = params;
  return {
    id: (id ??
      `${kind}:${now}:${Math.random().toString(36).slice(2)}`) as EffectId,
    type: kind,
    createdAt: createTimestamp(now as unknown as number),
    ttlMs: createDurationMs(ttlMs),
    payload: payload ?? null,
  } as UiEffect;
}

/** Push an effect (append only; keep array readonly in type) */
export function pushUiEffect<S extends GameState>(
  state: S,
  effect: UiEffect
): S {
  const next = (state.uiEffects ?? []).concat(
    effect
  ) as ReadonlyArray<UiEffect>;
  return { ...state, uiEffects: next } as S;
}

/** Remove expired effects given current time */
export function pruneUiEffects<S extends GameState>(
  state: S,
  now: Timestamp
): S {
  const nowNum = now as unknown as number;
  const pruned = (state.uiEffects ?? []).filter((e) => {
    const created = e.createdAt as unknown as number;
    const ttl = durationMsAsNumber(e.ttlMs);
    return nowNum - created < ttl;
  }) as ReadonlyArray<UiEffect>;

  return pruned === state.uiEffects
    ? state
    : ({ ...state, uiEffects: pruned } as S);
}

/** Clear all UI effects (use sparingly—e.g., on mode change) */
export function clearUiEffects<S extends GameState>(state: S): S {
  return state.uiEffects.length === 0
    ? state
    : ({ ...state, uiEffects: [] } as S);
}
```

> **Notes**
>
> - We accept `kind: string` for now to avoid a big migration. Later, tighten to a discriminated union:
>
>   ```ts
>   type UiEffect =
>     | { type: "finesse-boop"; createdAt: Timestamp; ttlMs: DurationMs; payload: { pieceId: PieceId; faults: FaultType[] } }
>     | { type: "line-flash"; createdAt: Timestamp; ttlMs: DurationMs; payload: { lines: readonly number[] } }
>     | ...;
>   ```
>
> - Keep effects _small_ and serializable; render-time code can fan out animations.

### Integrate pruning in `Tick`

In your `Tick` action handler (or physics post-step if that’s where you pruned before), replace ad-hoc logic with:

```ts
import { pruneUiEffects } from "./ui/effects";

// inside Tick handler after you computed `timestampMs`
let next = { ...state /* stats/time/tick updates */ } as GameState;
next = pruneUiEffects(next, timestampMs);
// then gravity/lock post-step, etc.
return next;
```

If you want automatic “event → effect” bridges (e.g., a finesse error triggers a “boop”), call `pushUiEffect` from the specific domain handler that knows about the event (e.g., scoring or finesse feedback updater).

---

## B. Selectors (pure derived reads)

### Context

Views shouldn’t poke at engine internals. Provide _narrow, pure_ selectors for everything UI cares about. These don’t mutate and have zero side effects. Where helpful, add simple memoization to avoid recomputing heavy deriveds (ghost piece cells) on unchanged inputs.

### `src/engine/selectors.ts` (paste)

```ts
import type { GameState, PlayingState, ActivePiece } from "../state/types";
import { isPlaying } from "../state/types";
import { dropToBottom, isAtBottom } from "../core/board";
import { durationMsAsNumber } from "../types/brands";

/** Phase guards */
export const selectStatus = (s: GameState) => s.status;
export const selectIsPlaying = (s: GameState): s is PlayingState =>
  isPlaying(s);
export const selectIsResolving = (s: GameState) => s.status === "resolvingLock";
export const selectIsLineClear = (s: GameState) => s.status === "lineClear";
export const selectIsTopOut = (s: GameState) => s.status === "topOut";

/** Stats and high-level metrics */
export const selectPPM = (s: GameState) => s.stats.piecesPerMinute;
export const selectLPM = (s: GameState) => s.stats.linesPerMinute;
export const selectFinesseAccuracy = (s: GameState) => s.stats.finesseAccuracy;
export const selectAvgInputsPerPiece = (s: GameState) =>
  s.stats.averageInputsPerPiece;

/** Active piece accessors (safe) */
export const selectActive = (s: GameState): ActivePiece | undefined =>
  isPlaying(s) ? s.active : undefined;

/** Grounded/lock delay status (for UI indicators) */
export const selectIsGrounded = (s: GameState): boolean => {
  const a = selectActive(s);
  return !!(a && isAtBottom(s.board, a));
};

export const selectLockResets = (s: GameState): number =>
  s.physics.lockDelay.tag === "Grounded" ? s.physics.lockDelay.resets : 0;

export const selectLockElapsedMs = (s: GameState): number => {
  if (s.physics.lockDelay.tag !== "Grounded") return 0;
  const now = s.tick; // or pass timestamp externally—prefer an explicit arg if needed
  // If you want accurate elapsed, call a variant that accepts `nowMs`
  return 0; // left as 0 unless you thread a timestamp here
};

export const selectLockDelayMs = (s: GameState): number =>
  durationMsAsNumber(s.timing.lockDelayMs);

export const selectLockResetCap = (s: GameState): number =>
  s.timing.lockDelayMaxResets;

/** Ghost piece (cells) for rendering overlays */
export function selectGhostPieceBottom(s: GameState): ActivePiece | undefined {
  const a = selectActive(s);
  return a ? dropToBottom(s.board, a) : undefined;
}

/** Next queue (read-only) */
export const selectNextQueue = (s: GameState) => s.nextQueue;

/** UI Effects for rendering HUD / animations */
export const selectUiEffects = (s: GameState) => s.uiEffects;

/** Board decorations (if your view uses a single source) */
export const selectBoardDecorations = (s: GameState) => s.boardDecorations;

/** Example lightweight memoizer for (stateRef, activeRef) -> ghostRef */
type Memo1<A, R> = (a: A) => R;
export function memo1<A extends object, R>(fn: (a: A) => R): Memo1<A, R> {
  let lastA: A | null = null;
  let lastR: R | null = null;
  return (a: A) => {
    if (a === lastA && lastR !== null) return lastR as R;
    lastA = a;
    lastR = fn(a);
    return lastR as R;
  };
}

// Example memoized selector:
export const selectGhostPieceBottomMemo = memo1(selectGhostPieceBottom);
```

> **Notes**
>
> - Keep selectors synchronous and pure; no `Date.now()` inside. If you need a “now” for elapsed, add an arg: `selectLockElapsedMs(s, nowMs)`.
> - Memoization shown is _shallow_ (referential): it short-circuits when the input object is the same reference (common in Redux-style flows). If you need more, consider per-slice memo (still no external libs needed).

---

## C. Wiring changes in reducer

**Before (inline pruning in `Tick`)**

```ts
const prunedEffects = state.uiEffects.filter(/* age math */);
let newState = { ...state, uiEffects: prunedEffects /* … */ };
```

**After**

```ts
import { pruneUiEffects } from "./ui/effects";

let next = { ...state /* stats/tick updates */ } as GameState;
next = pruneUiEffects(next, action.timestampMs); // ⟵ single call
// gravity or post-step
return next;
```

**When emitting effects** (e.g., finesse feedback, line clear start), just:

```ts
import { makeEffect, pushUiEffect } from "../ui/effects";

const eff = makeEffect({
  kind: "finesse-boop",
  now: action.timestampMs,
  ttlMs: 300,
  payload: { faults: action.faults },
});
return pushUiEffect(state, eff);
```

---

## D. Example: ghost piece overlay in a React-ish view

```ts
import { selectGhostPieceBottomMemo, selectUiEffects } from "../engine/selectors";

function GhostOverlay({ state }: { state: GameState }) {
  const ghost = selectGhostPieceBottomMemo(state);
  if (!ghost) return null;
  return <GhostCells cells={/* transform ghost into grid cells */} />;
}

function HudEffects({ state }: { state: GameState }) {
  const effects = selectUiEffects(state);
  return effects.map((e) => <Effect key={e.id} kind={e.type} payload={e.payload} />);
}
```

---

## E. Tests

1. **UI effects pruning**
   - Arrange: state with two effects `{createdAt: t0, ttl: 200}` and `{createdAt: t0, ttl: 1000}`.
   - Act: `pruneUiEffects(state, t0 + 500)`.
   - Assert: only the long-ttl effect remains; input `state` untouched (immutability).

2. **Variant-preserving push**
   - Arrange: `PlayingState` with `pendingLock: null`.
   - Act: `pushUiEffect(state, eff)`.
   - Assert: result still `status: "playing"`, `pendingLock === null`.

3. **Ghost selector purity**
   - Arrange: same `state` reference; call `selectGhostPieceBottomMemo(state)` twice.
   - Assert: second call returns the exact same `ActivePiece` reference (memo hit).

4. **No mutation**
   - Freeze a deep copy of `state` (if you use a test helper), call all selectors, verify no throws.

---

## Acceptance Criteria

- `ui/effects.ts` provides `makeEffect`, `pushUiEffect`, `pruneUiEffects`, `clearUiEffects`; **no timers**, pure functions, immutable updates.
- `Tick` (or a single central place) calls `pruneUiEffects` with the action timestamp; ad-hoc TTL code removed from reducer.
- `selectors.ts` exposes pure, typed selectors for:
  - Phase (`status` guards), ghost piece, grounded status, lock delay numbers, next queue, stats (PPM/LPM/finesse), UI effects, board decorations.

- Optional memoization available for ghost selector; no external libs added.
- All non-resolving states still have `pendingLock: null` (Phase-9 contract preserved).
- Unit tests cover pruning, variant preservation, and selector purity.

---

## Pitfalls & Reminders

- **Don’t** compute time inside selectors; pass timestamps in or rely on state.
- **Don’t** mutate `uiEffects`; always replace the array.
- **Do** keep effect payloads small and serializable; rendering code decides visuals.
- **Do** keep selectors as the _only_ source your UI consumes—no ad-hoc reads from state internals inside views.
- **Do** prefer variant-preserving helpers when returning from cross-variant code, even if you only tweak `uiEffects` or `board`.

---

## Optional niceties (later)

- Tighten `UiEffect["type"]` to a discriminated union; introduce payload types per effect.
- Add `selectBoardOverlay(state)` that merges ghost, line-clear highlights, finesse hints into one render-ready structure (pure).
- Add tiny `memo2` for selectors that combine two slices (e.g., `(board, active) -> ghostCells`).
