## E2E Test Migration — DOM/Lit → Phaser Scene Integration

Goal

- Restore end-to-end coverage lost by removing DOM/Lit UI by rebuilding integration tests against the Phaser `Gameplay` scene (thin-orchestrator) while keeping the functional core pure and deterministic.

Deleted Integration Tests (from staged diff)

- `tests/integration/app-e2e.test.ts` — Full-stack DOM E2E via `FinessimoApp`, keyboard events, RAF, settings modal.
- `tests/integration/app-e2e-helpers.ts` — AppTestWrapper, DOM scaffolding, timing/RAF mocks.

What They Covered (feature map)

- Basic gameplay: spawn, MoveLeft/Right, Rotate(CW/CCW), HardDrop, Hold; finesse log includes HardDrop and clears after lock.
- DAS/ARR behavior: KEY_DOWN charge → repeats, ARR cadence; config changes impact timings.
- Settings integration: update timing (DAS/ARR/softDrop/gravity/lock/lineClear), gameplay (ghost/hold/next count, finesse flags), partial updates, invalid inputs.
- Modes: freePlay ↔ guided switching and session counters.
- Finesse analysis: faults for inefficient inputs vs. none for optimal.
- Loop/physics: Tick advances at 60 FPS; gravity/lock-delay semantics.
- T-spin integration: board setup via CreateGarbageRow, rotations/soft drop/hard drop → double line clear stats.
- Error recovery: rapid inputs; blur/focus halting movement; invalid action resilience; concurrent input ordering.

Phaser Integration Boundary (types-first)

- Scene under test: `src/presentation/phaser/scenes/Gameplay.ts` using `attachLoop()` to run deterministically without a real Phaser.Game.
- Input boundary: `PhaserInputAdapter` interface; tests inject a typed TestInputAdapter that emits `DASEvent | Action` with branded timestamps.
- Time boundary: Deterministic `Clock` (use `SimulatedClock`) with fixed-step `Ms` to drive Tick and physics.
- Presentation boundary: Inject a `Presenter` test-double that records last `ViewModel` and applied plans; no real rendering.

Test Harness Design (new)

- File: `tests/phaser/helpers/GameplayHarness.ts`
  - `createGameplayHarness(opts)` returns:
    - `scene`: a `new Gameplay()` with `attachLoop({ presenter, input, initialState, fixedDt, clock, reduce })`.
    - `input`: TestInputAdapter with `pushDas(e: DASEvent)`, `pushAction(a: Action)`, `tap(dir)`, `hold(dir)`, `release(dir)`, `rotateCW/CCW()`, `hardDrop()`, `softDrop(on: boolean)`.
    - `clock`: deterministic; helpers `step(dt=16.666)`, `stepN(n, dt)`, `advanceMs(ms)`.
    - `getState()`: current `GameState` snapshot via `scene.getState()`.
    - `spawn(piece?: PieceId)`: enqueue `{type:"Spawn"}` action (optionally with `piece`).
    - `applyGarbage(rows: Array<readonly [..10 numbers..]>)`: enqueue `CreateGarbageRow` actions.
    - `updateTiming(settings)`, `updateGameplay(settings)`, `setMode(name)`: delegate to scene public methods.

Types and Factories (reuse existing)

- Use `createInitialState(seed, ts, overrides)` from `src/engine/init.ts` for initial state.
- Reuse `tests/test-helpers.ts` factories for typed actions (Spawn, Rotate, SoftDrop, etc.).
- Prefer branded constructors for time/duration/seed; avoid `any`.

Test Suites to Rebuild (mapping)

- `tests/phaser/integration/gameplay.basic.test.ts`
  - Spawn auto on first tick; MoveLeft/Right via `tap(-1|1)`; Rotate via actions; HardDrop locks then respawns; Hold swaps.
  - Assert finesse log contains `HardDrop` then clears after lock.

- `tests/phaser/integration/gameplay.das-arr.test.ts`
  - Hold left: emit `KEY_DOWN` then `stepN` past DAS to see repeats; verify x decreases monotonically; release stops.
  - Update DAS/ARR through `updateTimingSettings({ dasMs, arrMs })` and verify cadence changes.

- `tests/phaser/integration/gameplay.settings.test.ts`
  - Update timing: `dasMs, arrMs, softDrop, lockDelayMs, lineClearDelayMs, gravityMs, gravityEnabled` and assert state.timing mirrors.
  - Update gameplay: `finesseCancelMs, ghostPieceEnabled, nextPieceCount, finesseFeedbackEnabled, finesseBoopEnabled` and assert state.
  - Partial updates preserve unspecified fields; invalid inputs do not crash; state remains valid.

- `tests/phaser/integration/gameplay.modes.test.ts`
  - `setMode("guided")` transitions; verify `currentMode` and session counters (via stats.totalSessions behavior if applicable).

- `tests/phaser/integration/gameplay.loop-physics.test.ts`
  - `stepN(60)` increments `tick`; gravity moves y or keeps valid state; lock delay semantics preserved.

- `tests/phaser/integration/gameplay.tspin.test.ts`
  - Build T-spin board via `applyGarbage([...])`; force T piece spawn; sequence: right, CCW, soft drop to ground, CCW, hard drop.
  - Assert `stats.doubleLines === 1`, `linesCleared += 2`, and `active` undefined post-lock (until auto-spawn).

- `tests/phaser/integration/resilience.test.ts`
  - Rapid input spam; concurrent keydowns; invalid action in queue; ensure state stays in `playing`.
  - Focus/visibility: covered in a separate scene test using real Phaser.Game HEADLESS (see below).

Adapter-specific tests

- `tests/phaser/input/adapter.keyboard.test.ts`
  - Instantiate `PhaserInputAdapterImpl` with custom `KeyBindings` and stubbed keyboard plugin to verify mapping (`KeyA` → `MoveLeft`).
  - Use jsdom and avoid real canvas via `Phaser.HEADLESS` if needed.

Focus/Visibility (scene-level)

- `tests/phaser/scenes/gameplay.focus.test.ts` (optional)
  - Boot a minimal `Phaser.Game` with `type: Phaser.HEADLESS`, add `Gameplay`, let `create()` run.
  - Dispatch `window.blur`/`window.focus`/document visibility events and spy on `scene.pause/resume` or `updateGamePauseState`.

File Layout (planned)

- `tests/phaser/helpers/GameplayHarness.ts`
- `tests/phaser/integration/gameplay.basic.test.ts`
- `tests/phaser/integration/gameplay.das-arr.test.ts`
- `tests/phaser/integration/gameplay.settings.test.ts`
- `tests/phaser/integration/gameplay.modes.test.ts`
- `tests/phaser/integration/gameplay.loop-physics.test.ts`
- `tests/phaser/integration/gameplay.tspin.test.ts`
- `tests/phaser/integration/resilience.test.ts`
- `tests/phaser/input/adapter.keyboard.test.ts`
- `tests/phaser/scenes/gameplay.focus.test.ts` (optional)

Execution Model

- Prefer `attachLoop()` harness for deterministic unit-integration of loop+input+reducer+presenter.
- Use real Phaser.Game HEADLESS only where `create()`-side effects must be tested (focus/visibility handlers).
- Keep tests synchronous via `step/stepN`; avoid real RAF.

Quality Gates

- Restore or exceed coverage of deleted tests; keep strict TypeScript settings.
- No TS/ESLint suppressions; invalid states remain unrepresentable via types/brands.
- Always `npm run ci` locally before committing.

Next Steps

1) Implement `tests/phaser/helpers/GameplayHarness.ts` with typed input queue and SimulatedClock.
2) Port “Basic Gameplay Flow” and “DAS/ARR” first (highest signal/lowest flake).
3) Port settings/modes suites using scene public methods.
4) Port T-spin and resilience cases.
5) Add adapter keyboard mapping tests; optionally add focus/visibility scene tests with HEADLESS boot.
6) Verify `npm run test:coverage` meets thresholds and adjust only by adding tests.

