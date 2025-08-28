# InputEngine — Design & Migration Plan

This document captures a forward-looking plan to centralize input semantics in a single, pure core module named `InputEngine`, while preserving the benefits of our existing DAS state machine (robot3) and the project’s functional architecture.

Scope: Design only. No code changes are planned immediately — this is a roadmap for a future refactor when we’re ready.

## Motivation

Today, input timing and classification (DAS/ARR, tap vs. hold) are implemented in a robot3 state machine, while some policy and finesse logging live in the `StateMachineInputHandler`. This works and is green, but the edge carries some policy (pending tap, ARR catch-up, SoftDrop transition dedupe) that we would prefer to concentrate inside a pure core.

We want a single source of truth for input semantics that produces both engine `Action`s (for the reducer) and finesse `ProcessedAction`s (for logging), deterministically from a stream of device-agnostic events.

## Goals

- Pure core: deterministic `step(state, event) -> { state, engine: Action[], processed: ProcessedAction[] }`.
- Single source for input semantics: tap/hold classification, SoftDrop transition dedupe, ARR catch-up.
- Preserve robot3’s clarity for DAS timing and states (idle → charging → repeating).
- Thin device handlers: map DOM/touch/replay events → `InputEngine` events, dispatch outputs.
- Keep reducer/service pure: reducer persists logs via `AppendProcessed`, service consumes logs, remains stateless.

## Non-Goals

- Replacing robot3 is not required. We aim to compose it inside the engine.
- Changing game rules or reducer semantics is out-of-scope.
- Introducing new action kinds (e.g., `BurstMove`) is optional/future work.

## Architecture Overview

InputEngine is a pure module:

```
type InputEngineState = {
  das: DASContext;           // embedded robot3 DAS context
  pendingTap?: { dir: -1|1; t: Timestamp };
  softDropOn: boolean;
  lastTimer?: Timestamp;     // optional, for diagnostics/consistency checks
};

type InputEngineEvent =
  | { type: "KeyDown"; dir: -1 | 1; t: Timestamp }
  | { type: "KeyUp"; dir: -1 | 1; t: Timestamp }
  | { type: "Rotate"; dir: "CW" | "CCW"; t: Timestamp }
  | { type: "HardDrop"; t: Timestamp }
  | { type: "SoftDrop"; on: boolean; t: Timestamp }
  | { type: "Timer"; t: Timestamp }
  | { type: "ConfigUpdate"; dasMs: DurationMs; arrMs: DurationMs };

type StepOutput = {
  state: InputEngineState;
  engine: ReadonlyArray<Action>;         // reducer actions (TapMove/HoldMove/RepeatMove/etc.)
  processed: ReadonlyArray<ProcessedAction>; // finesse-normalized actions for logging
};

function step(state: InputEngineState, event: InputEngineEvent): StepOutput;
```

Key points:

- Internally, `step` feeds events into the embedded robot3 DAS machine and interprets outputs.
- `step` applies finesse logging rules:
  - Tap: ignore optimistic KEY_DOWN; finalize a single TapMove at matching KEY_UP if no hold started.
  - Hold (DAS): emit exactly one `ProcessedAction: HoldMove` at HoldStart; never log RepeatMove.
  - SoftDrop: log transitions only (on/off) and dedupe pulses.
  - Rotate/HardDrop: log once per key press/release cycle as appropriate.
- ARR catch-up happens deterministically in `step` when handling `Timer(t)`:
  - Compute how many repeats should occur since the last ARR time; emit multiple engine `RepeatMove` actions (capped to board width − 1 per step) so the user experience matches low ARR expectations (ARR=0 → “burst to wall”).

### Composition with robot3

We keep the current DAS machine unchanged and embed it in the InputEngine. The engine manages:

- `das.send(KEY_DOWN/KEY_UP/TIMER/UPDATE_CONFIG)`
- `das.context` snapshots for precise ARR math.
- Interpreting optimistic TapMove vs. HoldStart vs. RepeatMove into both engine and processed outputs.

This preserves robot3’s clarity without duplicating its logic elsewhere.

## Device Handlers (Keyboard/Touch/Replay)

Handlers become thin:

- Translate DOM/touch/replay inputs to `InputEngineEvent`s.
- Call `step(engineState, event)` and receive `{ engine, processed, state }`.
- Dispatch `engine` items directly to the reducer; dispatch `{ type: "AppendProcessed", entry }` for each `processed` item.
- Keep no policy (pending tap, SoftDrop dedupe, ARR catch-up) in handlers.

## Finesse Logging Rules (unchanged semantics)

- Only log when there is an active piece and `GameState.status === "playing"`.
- ProcessedAction kinds and rules:
  - TapMove: exactly one per tap (finalized on KEY_UP), ignore optimistic.
  - HoldMove: exactly one at HoldStart.
  - RepeatMove: never log.
  - Rotate/HardDrop: always log; stamp timestamps.
  - SoftDrop: transitions only (on/off), dedupe pulses.

## ARR Catch-up (deterministic)

- On `Timer(t)`, calculate repeats due since the last ARR time (`arrLastTime` or `dasStartTime + dasMs`).
- Emit `n` engine `RepeatMove` actions in the same step (cap to `board.width - 1`).
- Ensures low ARR (including 0ms) feels instant without raising frame rate.

Note: If later we add `BurstMove(n)` to shrink dispatch volume, the reducer would apply up to `n` single-step horizontal moves (bounded by collision/walls). This is optional future work.

## Integration with Game Engine

- Reducer: unchanged. It remains pure, persists logs via `AppendProcessed`, and clears via `ClearInputLog` when the pipeline finishes analysis.
- App: unchanged orchestration; still runs the lock pipeline and schedules preview refills. The only change is handlers call `step()` and dispatch the outputs.
- Service: unchanged, remains stateless, consumes `processedInputLog` and emits feedback/stats.

## Migration Plan

Phased plan to minimize risk and maintain green builds:

1. Scaffolding (no behavior change)
   - Add `src/input/engine/` with types and a `step()` skeleton that simply forwards to today’s behavior (no catch-up or logging, yet).
   - Add unit tests for `step()` event handling surface (compile + basic runtime shape).

2. Robot3 composition
   - Embed the existing DAS machine in engine state and drive it from `step()`.
   - Keep handlers as-is; engine used only in tests.

3. Move finesse logging into engine
   - Implement the pendingTap, HoldStart logging, and SoftDrop dedupe inside `step()`.
   - Update handlers to stop classifying/logging; they just dispatch `{ processed }` from engine.
   - Keep reducer’s `AppendProcessed` path unchanged; adjust tests to assert engine outputs.

4. Move ARR catch-up into engine
   - Implement deterministic repeat burst in `step(Timer(t))`.
   - Remove ARR catch-up from handlers.
   - Update unit tests to assert multiple engine `RepeatMove`s from a single `Timer(t)` where appropriate; keep DAS unit tests intact by scoping them to the inner machine.

5. Optional future
   - Consider `BurstMove(n)` to reduce dispatch overhead at ARR=0ms. If implemented, update reducer + tests accordingly.

## Testing Strategy

- Unit tests for `step()`:
  - Tap vs Hold classification (pending tap gets finalized on KeyUp; HoldStart cancels pending tap).
  - ARR extremes: ARR=0ms → burst to wall within one step; large ARR → at most one repeat per `Timer`.
  - SoftDrop transitions: on/off are logged; repeated pulses are deduped.
  - Rotate/HardDrop always logged once.
  - Deterministic replay: same event stream → same outputs.

- Integration tests (existing): remain valid since reducer/service behavior does not change.

## Risks & Mitigations

- Risk: Duplicating DAS logic.
  - Mitigation: Compose the existing robot3 machine; do not reimplement its guards/reducers.

- Risk: Handler/engine divergence during migration.
  - Mitigation: Phase-by-phase toggles; keep tests green after each step.

- Risk: Performance during ARR bursts.
  - Mitigation: Cap repeats to `board.width - 1`; consider `BurstMove(n)` as a future optimization.

## Acceptance Criteria

- Engine `step()` is pure and deterministic.
- Handlers are thin and device-agnostic.
- Finesse logging is engine-owned; reducer persists via `AppendProcessed` and clears via `ClearInputLog`.
- ARR behavior matches user expectations across the range, including 0ms.
- All tests pass (`npm run pre-commit`), with new unit tests for engine semantics.

## Open Questions

- Do we want to adopt `BurstMove(n)` to reduce dispatch volume at very low ARR?
- Should the engine own SoftDrop pulses timing, or do we keep pulses at the handler and only dedupe in engine?
- Do we want to consolidate Rotate/HardDrop into engine events fully, or keep them as immediate passthroughs?

## Summary

This plan preserves robot3 (DAS clarity), strengthens our functional core, and simplifies edges. The result is a single place to reason about input semantics and finesse logging, producing consistent, replayable outputs for both the reducer and the finesse analyzer.
