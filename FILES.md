# Finessimo Codebase Map — TypeScript in `src/`

Purpose: a concise, accurate inventory of every TypeScript/TSX file in `src/` with a one‑line summary.

Note: core logic is pure and functional; side effects live in input handlers and UI boundaries per DESIGN.md.

## Docs

- DESIGN.md: Architecture, principles, and gameplay data flow.
- FILES.md: This file — codebase map and conventions.
- GAMEPLAY.md: Refactor plan for `game-board.tsx` — types-first split into pure render modules (overlays, cells, grid cache, tween, viewport) and a thin orchestration component.

## Root

- src/main.ts: Browser entrypoint; registers components, waits for shell, boots `FinessimoApp` and exposes it on `window`.
- src/app.ts: App orchestrator; 60 Hz loop, reducer/dispatch wiring, lock pipeline, mode/UI adapter hooks, settings integration.
- src/global.d.ts: Ambient typing for `window.finessimoApp`.
- src/persistence/settings.ts: LocalStorage adapter for settings; loads/saves and serializes from engine state to persisted store.

## Types

- src/types/brands.ts: Branded primitives (`DurationMs`, `GridCoord`, `CellValue`, `Frame`, `Seed`, `UiEffectId`, etc.) + guards/converters.
- src/types/timestamp.ts: Branded `Timestamp` with constructors (`createTimestamp`, `fromNow`) and interop helpers.

## State

- src/state/types.ts: Domain model: `GameState` variants, `Action` union, `Board`/`ActivePiece`, configs, `Stats`, `UiEffect`, helpers/guards.
- src/state/reducer.ts: Pure reducer implementing gameplay transitions, input/log handling, UI effects, stats, and mode plumbing.
- src/state/signals.ts: Lit signals bridge: `gameStateSignal`, `dispatch`, and selector helpers for minimal UI dependencies.

## Core (pure game mechanics)

- src/core/board.ts: Board ops: placement/collision, move/drop/walls, lock piece, line detection/clearing, ghost computations.
- src/core/pieces.ts: Tetromino shapes (cells per rotation), spawn offsets, colors; SRS kick tables for some pieces.
- src/core/srs.ts: SRS rotation/kicks (JLSTZ/I), `getNextRotation`, `tryRotate`/`canRotate` helpers.
- src/core/spawning.ts: Construct spawn `ActivePiece`; spawn/top‑out checks; simple hold‑aware spawn helper.
- src/core/rng-interface.ts: `PieceRandomGenerator` interface for seedable RNGs.
- src/core/rng.ts: Seeded 7‑bag RNG (FNV hash + LCG + Fisher–Yates), `createRng`, `getNextPiece(s)`.
- src/core/other-rngs.ts: Deterministic RNGs for tests (`OnePieceRng`, `SequenceRng`).

## Engine (pure reducers/selectors over state)

- src/engine/init.ts: Defaults + `createInitialState`/physics setup; merges prior stats/config; primes preview queue/RNG.
- src/engine/lock-utils.ts: Build `PendingLock` (simulate final position + completed lines) for uniform lock handling.
- src/engine/physics/lock-delay.machine.ts: Lock‑delay ADT (`Airborne`/`Grounded`) + `stepLockDelay` state machine.
- src/engine/physics/gravity.ts: Gravity tick: interval calc, vertical step, integrate lock‑delay, stage `pendingLock` when due.
- src/engine/physics/post-step.ts: Post‑action lock‑delay advancement with action‑aware reset/skip rules.
- src/engine/scoring/stats.ts: Derivations (`derive`), `applyDelta`, and session duration updates.
- src/engine/scoring/line-clear.ts: Commit lock, line‑clear animation/immediate path, top‑out, and stats increments.
- src/engine/gameplay/movement.ts: Horizontal movement handlers for Tap/Hold/Repeat (pure, no side effects).
- src/engine/gameplay/rotation.ts: Rotation handler using SRS + collision checks.
- src/engine/gameplay/spawn.ts: Spawn handler; queue consumption/override; top‑out detection; physics reset.
- src/engine/gameplay/hold.ts: Hold handler; swap/queue consume; re‑enable/disable hold per piece lifecycle.
- src/engine/selectors.ts: Read‑only selectors (status flags, ghost, grounded/lock info, derived stats metrics).
- src/engine/util/cell-projection.ts: Map `ActivePiece` to absolute grid cell tuples for overlay consumers.
- src/engine/ui/effects.ts: Pure UI effects list ops: push/prune (TTL)/clear.
- src/engine/ui/overlays.ts: Overlay union/types (ghost/target/line‑flash/effect‑dot/column‑highlight) + z‑order helpers.
- src/engine/selectors/overlays.ts: Derived overlays from state/mode data (ghost, targets, column highlight).
- src/engine/selectors/effects-to-overlays.ts: Map `UiEffect` entries to overlay representations.
- src/engine/selectors/board-render.ts: Final render model: combine/sort all overlays for the board.

## Modes

- src/modes/index.ts: `GameMode` interface + registry; shared hooks (RNG/preview ownership, resolve lock contract).
- src/modes/types.ts: Mode UI adapter contract and `ExtendedModeData` (`targets`, `ghostEnabled`) + guard.
- src/modes/freePlay.ts: Free‑play mode: allow hold, default 7‑bag RNG; optional retry on hard‑drop finesse faults.
- src/modes/freePlay/ui.ts: Free‑play UI adapter (no special derived UI data).
- src/modes/guided.ts: Guided SRS trainer: deck/rating flow, prompts, persistence hooks, post‑lock feedback effects.
- src/modes/guided/deck.ts: Build canonical guided card set (valid columns/rot reps), difficulty ordering, `makeDefaultDeck`.
- src/modes/guided/types.ts: Guided brands (`Column`, `CardId`, `DeckId`) + constructors.
- src/modes/guided/ui.ts: Guided UI adapter; compute target cells (final placement) and suppress ghost.
- src/modes/lock-pipeline.ts: Coordinator: run finesse analysis, let mode decide commit/retry, dispatch final actions.
- src/modes/spawn-service.ts: Centralize mode‑owned RNG + preview refills (`getActiveRng`, `getNext/PreviewFromMode`).

## Finesse (analysis + logging)

- src/finesse/constants.ts: Unicode icons for finesse actions + `getActionIcon` helper.
- src/finesse/log.ts: Processed input log helpers/guards; emit `ProcessedAction`s for rotate/hard/soft drop and movement.
- src/finesse/calculator.ts: Board‑aware minimal‑inputs search (neighbors: moves/DAS/rotations/soft‑drop); analyze to `FinesseResult`.
- src/finesse/service.ts: Thin service to analyze a locked piece vs mode target; emits feedback/stats/clear‑log actions.

## SRS Deck (spaced repetition)

- src/srs/fsrs-adapter.ts: FSRS adapter: branded deck/record types, scheduler bridge, rating/update, serialize/deserialize.
- src/srs/storage.ts: Load/save guided deck to `localStorage` with migration/sanitization.

## Policy (opener training system)

- src/policy/index.ts: Main policy orchestrator; template ranking, hysteresis, suggestion generation.
- src/policy/planner.ts: Policy planning logic; template evaluation and selection with hazard detection.
- src/policy/types.ts: Policy domain types (`Template`, `Suggestion`, `Intent`, `Placement`, `PolicyContext`).
- src/policy/templates/index.ts: Base templates for TKI/PCO/Neither opener strategies with caching and utility functions.
- src/policy/templates/_compose.ts: Template composition utilities; `extendTemplate` for creating variants with patch-based overrides.
- src/policy/templates/variants.ts: Additional template variants using `extendTemplate` infrastructure; PCO edge and transition variants.

## Input (side‑effects at the edge)

- src/input/handler.ts: Input handler contract, normalization utilities, and a `MockInputHandler` for tests/dev.
- src/input/StateMachineInputHandler.ts: Keyboard engine: Robot3 DAS/ARR timing, processed‑log emission, keybinding management.
- src/input/keyboard.ts: Default bindings, storage load/save, and key‑code → action mapping helpers.
- src/input/touch.ts: Touch controls: zones/gestures, emit engine + processed actions, hooks into shared state machine.
- src/input/machines/das.ts: Robot3 DAS state machine (contexts, guards, reducers, transitions) + service wrapper.
- src/input/utils/key-binding-manager.ts: DOM key binding manager to register/unregister handlers by key code.

## UI (web components, TSX)

- src/ui/audio.ts: Minimal WebAudio helper for a short confirmation “boop”.
- src/ui/components/finessimo-shell.tsx: Top‑level layout; mounts board, overlays, hold/preview, stats, settings modal.
- src/ui/components/game-board.tsx: Canvas board renderer; draws grid/active piece; renders overlay union in z‑order.
- src/ui/components/finesse-overlay.tsx: HUD showing suggested finesse sequence; optional audio cue; auto‑hide.
- src/ui/components/coachOverlay.tsx: Coaching overlay displaying policy suggestion rationales; auto‑hide with transitions.
- src/ui/components/effects-overlay.tsx: Renders floating text effects sourced from `uiEffects`.
- src/ui/components/piece-hold.tsx: Hold panel; draws held piece and disabled states.
- src/ui/components/piece-preview.tsx: Next queue panel; draws up to N preview tetrominoes.
- src/ui/components/stats-panel.tsx: Aggregated stats readout (PPM/LPM, accuracy, session, placements, faults).
- src/ui/components/tabbed-panel.tsx: Container with tabs for Stats and Settings views, replaces stats-panel in finessimo-shell.
- src/ui/components/settings-view.tsx: Settings panel with game mode, gameplay, and handling sections; conditional rendering based on mode.
- src/ui/components/settings/checkbox.tsx: Checkbox component with color state changes and immediate event dispatch.
- src/ui/components/settings/dropdown.tsx: Flat dropdown component with click-to-expand menu and keyboard support.
- src/ui/components/settings/slider.tsx: Interactive slider with drag gestures, inline editing, and branded value types.
- src/ui/components/settings/button.tsx: Flat button component with primary/danger/default variants.
- src/ui/components/keybinding-modal.tsx: Modal for configuring key bindings; keyboard event capture during rebinding with proper event isolation.
- src/ui/renderers/cells.ts: Pure cell rendering functions for board and active piece display (extracted from game-board.tsx).
- src/ui/renderers/grid-cache.ts: Offscreen grid rendering cache for efficient 60Hz board drawing.
- src/ui/renderers/outline-cache.ts: Pure outline cache implementation for efficient overlay rendering with memoized path computations.
- src/ui/renderers/overlays.ts: Pure overlay rendering functions with exhaustive switch handling and outline cache interface (extracted from game-board.tsx).
- src/ui/renderers/tween.ts: Pure vertical piece animation logic (TweenState, easing, smooth 60Hz tweening).
- src/ui/renderers/viewport.ts: Pure viewport rendering functions for background and border display (extracted from game-board.tsx).
- src/ui/types/board-render-frame.ts: Unified render frame type containing all state needed for board rendering.
- src/ui/types/brands-render.ts: Render coordinate brands (CellSizePx, BoardViewport) and conversion helpers.
- src/ui/types/settings.ts: Settings data types with branded values (DAS, ARR, etc.), game mode definitions, keybinding support, and tab state management.
- src/ui/utils/colors.ts: Color math/palette helpers (lighten/darken/normalize, gradients, style helpers).
- src/ui/utils/dom.ts: Typed DOM queries for app elements (shell, board frame, settings modal).
- src/ui/utils/outlines.ts: Pure geometry: compute perimeter edges/paths from grid cells for clean piece outlines.

## Scenarios (opener training system)

- src/scenarios/cards.ts: ScenarioCard types and registry; 6+ training scenarios spanning TKI/PCO easy/mid difficulty variants.
- src/scenarios/generators.ts: Deterministic sequence generators; `queueFromSeed`, `boardFromScenario` using existing RNG infrastructure.
- src/scenarios/srs.ts: Spaced repetition scheduler; SM-2-like algorithm with Grade types and ReviewState management.

## Utilities

_(No utility files currently in this directory)_
