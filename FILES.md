# Finessimo Codebase Overview (TypeScript Files under src/)

This file provides a quick, high-level map of all TypeScript files under src/ and what they do. It's meant to help future AI assistants orient quickly before diving into code.

## Dependencies

- Robot3 (v1.1.1): Functional finite state machines. Used for DAS state machine implementation to provide proper input classification at the source.

## Root Application

- src/main.ts: Browser entrypoint. Initializes FinessimoApp on DOM ready.
- src/app.ts: Main app orchestrator. 60 FPS game loop with focus-based pausing, state management, finesse analysis integration, lock pipeline invocation, mode switching, settings dispatch. Window focus detection using visibilitychange, focus/blur events, and watchdog for missed events.
- src/global.d.ts: Global TypeScript declarations and ambient module types.

## State

- src/state/types.ts: Core types and interfaces. GameState, Action union (including TapMove, HoldMove, RepeatMove, HoldStart for granular input classification), Stats (20+ metrics), Board, ActivePiece, configs. Includes processedInputLog for finesse analysis. Statistics tracking actions. `retryOnFinesseError` in GameplayConfig. UI effects system with UiEffect union and FloatingTextEffect for arcade-style messages.
- src/state/reducer.ts: Pure reducer for game logic. Handles movement, rotation, spawning, line clears, hold, gravity, lock delay. Appends to `processedInputLog` only via explicit `AppendProcessed` actions from input handlers, and clears it via `ClearInputLog`. Implements `RetryPendingLock` logic for piece restoration. Supports `RefillPreview`/`ReplacePreview` for mode-owned RNG/preview. Manages UI effects lifecycle via PushUiEffect actions and Tick-based pruning.
- src/state/signals.ts: Reactive state management using Lit signals. Global gameStateSignal with dispatch wrapper and selector helpers for efficient component updates.

## Engine

- src/engine/init.ts: Game state initialization module. Contains default timing/gameplay configs, createInitialPhysics, and createInitialState functions. Centralizes all initialization logic previously scattered in the reducer.
- src/engine/lock-utils.ts: Shared helper to construct a PendingLock from the current board and active piece (simulates hard drop when source is hardDrop). Used by reducer and physics post-step.
- src/engine/scoring/stats.ts: Statistics calculation and updates. Pure functions for deriving metrics, applying deltas, and updating session durations.
- src/engine/scoring/line-clear.ts: Line-clear and commit-lock logic. Pure handlers for CommitLock, CompleteLineClear, and StartLineClear actions. Includes applyPendingLock function for lock resolution, stats updates, and top-out detection.
- src/engine/physics/gravity.ts: Gravity system logic. Pure functions for gravity interval calculation, gravity application, and lock delay integration using the lock delay state machine.
- src/engine/physics/lock-delay.machine.ts: Pure lock-delay state machine (Airborne/Grounded). Steps with resets, movement, and elapsed time; returns next state and whether to lock now.
- src/engine/physics/post-step.ts: Physics post-step that evaluates ground contact and advances the lock-delay machine. Creates pendingLock and transitions to resolvingLock when lock triggers.
- src/engine/ui/effects.ts — Centralized UI effects helpers (push/prune/clear). Reducer Tick calls pruneUiEffects for TTL cleanup.
- src/engine/ui/overlays.ts — Foundational overlay type system for UI rendering. Discriminated union types for declarative overlay definitions (ghost, target, line flash, effect dots) with z-ordering and branded coordinates.
- src/engine/util/cell-projection.ts — Pure utility for projecting piece shapes to absolute grid coordinates. Centralizes coordinate transformation logic for overlay rendering.
- src/engine/gameplay/movement.ts: Pure movement action handlers for TapMove, HoldMove, and RepeatMove. Extracted from main reducer for modular organization.
- src/engine/gameplay/rotation.ts: Pure rotation action handler for Rotate actions. Delegates to SRS rotation system with proper collision checking.
- src/engine/gameplay/spawn.ts: Pure spawn action handler for piece spawning logic. Handles queue consumption, explicit piece spawning, and top-out detection.
- src/engine/gameplay/hold.ts: Pure hold action handler for hold system logic. Manages piece swapping, queue consumption, and spawn validity checking.

## Types

- src/types/brands.ts: Branded primitive types for type safety and domain modeling. DurationMs, GridCoord, Seed, UiEffectId, and other branded types with factory functions to prevent mixing of conceptually different values.
- src/types/timestamp.ts: Branded timestamp types and helper functions. Provides Timestamp type, createTimestamp(), fromNow(), and validation utilities for type-safe timestamp handling throughout the app.

## Presentation (Phaser)

- src/presentation/phaser/Game.ts — Phase 0 placeholder game factory (no Phaser import yet). Returns a sentinel handle; real Phaser wiring comes in later phases.
- src/presentation/phaser/presenter/types.ts — Phase 0 core presentation types: branded primitives (Px, Col, Row, Ms), ViewModel, RenderPlan union, and Presenter contract (pure computePlan + impure apply).
- src/presentation/phaser/presenter/Presenter.ts — Phase 0 NoopPresenter implementing the Presenter contract. `computePlan` returns a single `{ t: "Noop" }` entry; `apply` is a no-op.
- src/presentation/phaser/presenter/viewModel.ts — Phase 2: pure `mapGameStateToViewModel` implementation projecting core GameState to ViewModel (board grid, active/ghost cells, topOut, HUD) with small brand helpers `toCol`, `toRow`, `toPx`.
- src/presentation/phaser/presenter/BoardPresenter.ts — Phase 3: Presenter implementation. `computePlan` (pure) generates `TileDiff`, `PiecePos`, and topOut `CameraFx`/`SoundCue`; `apply` (impure) updates a blitter-backed locked layer and positions active/ghost containers via injected adapters (no Phaser import required yet).
 - src/presentation/phaser/presenter/Effects.ts — Phase 5: Camera FX adapter interface. Maps `RenderPlan.CameraFx` kinds (`fadeIn`, `fadeOut`, `shake`, `zoomTo`) to scene camera/post-FX implementation (no Phaser import).
 - src/presentation/phaser/presenter/AudioBus.ts — Phase 5: Audio bus adapter interface. Maps `RenderPlan.SoundCue` names (`spawn`, `lock`, `line`, `topout`) to the underlying sound manager.
 - src/presentation/phaser/input/PhaserInputAdapter.ts — Phase 4: Input adapter interface used by Gameplay loop to drain Actions each fixed step (pure contract).
 - src/presentation/phaser/scenes/clock.ts — Phase 4: `Clock` abstraction and `SimulatedClock` for deterministic timestamps in tests and headless runs.

- src/presentation/phaser/scenes/Boot.ts — Phase 1: minimal scene shell; `create()` immediately transitions to MainMenu via typed SceneController placeholder (`this.scene.start("MainMenu")`). No Phaser import yet.
- src/presentation/phaser/scenes/MainMenu.ts — Phase 6: menu helpers with typed navigation + quick mode shortcuts. Adds `startMode(name)`, `startFreePlay()`, `startGuided()` that dispatch `SetMode` and start Gameplay.
- src/presentation/phaser/scenes/Settings.ts — Phase 6: settings mapping helpers that convert primitives to brands and dispatch store actions. Adds `updateTimingMs({...})`, `updateGameplay({...})`, and `applySettings({ timing, gameplay })`.
- src/presentation/phaser/scenes/ModeSelect.ts — Phase 6: mode list/select helpers. Adds `listModes()` to query registry and `selectMode(name)` to dispatch `SetMode` and start Gameplay.
- src/presentation/phaser/scenes/Gameplay.ts — Phase 4: fixed-step deterministic loop (no Phaser import yet). Injects presenter, input adapter, reducer; maps GameState→ViewModel, computes RenderPlan, and applies via presenter.
- src/presentation/phaser/scenes/Results.ts — Phase 7: Results scene coordination (no Phaser import). Exposes `show(summary, ui)` that drives tweened counters and celebration particles via a typed UI adapter, and binds Retry/Menu to start `Gameplay`/`MainMenu`.
- src/presentation/phaser/scenes/types.ts — Phase 1: shared `SceneKey` union, `SceneController` interface, and `SCENE_KEYS` constant (brands not needed here yet).
- src/presentation/phaser/scenes/index.ts — Phase 1: scene registry exports (`SCENE_KEYS`, `SCENES`, `SCENE_REGISTRY`) for straightforward scene registration/testing without importing Phaser.

## Input

- src/input/handler.ts: Pure input utilities and mock. Provides `normalizeInputSequence`, pure DAS/ARR calculators, and a `MockInputHandler` used in tests. Core app input is handled by the state-machine-based handler below.
- src/input/keyboard.ts: Keyboard input handler with key bindings, storage persistence, DOM event handling. Delegates timing logic to InputProcessor.
- src/input/touch.ts: TouchInputHandler for mobile. Gesture detection, touch zones, swipe handling. Delegates timing logic to InputProcessor.
- src/input/StateMachineInputHandler.ts: State machine-based input handler implementing InputHandler interface. Uses DASMachineService internally for input classification. Maps keyboard events to DAS machine events and dispatches granular action types (TapMove, HoldMove, RepeatMove, HoldStart). Uses KeyBindingManager for keyboard handling with KeyboardEvent.code matching to support all keys including standalone modifier keys (ShiftLeft, ControlLeft, etc.). Prevents default browser behavior for bound keys.

### Input State Machines

- src/input/machines/das.ts: DAS (Delayed Auto Shift) state machine implementation using Robot3. Provides DASMachineService for manual state management and createDASMachine for Robot3 integration. Handles tap vs hold input classification at source with states: idle → charging → repeating. Emits granular action types (TapMove, HoldMove, RepeatMove, HoldStart). Exports reducer and guard functions for testability.

## Core Mechanics

- src/core/pieces.ts: Tetromino definitions with 4-way rotations, spawn positions, colors.
- src/core/board.ts: Board operations. Movement checks, hard drop, piece locking, line detection/clearing.
- src/core/srs.ts: SRS rotation with kick tables. Handles I and JLSTZ pieces with wall kicks.
- src/core/rng.ts: Seeded 7-bag randomizer for piece generation and preview queues.
- src/core/rng-interface.ts: RNG interface and type definitions for pluggable random number generation.
- src/core/other-rngs.ts: Alternative RNG implementations beyond the standard 7-bag (e.g., TGM3, classic).
- src/core/spawning.ts: Piece spawning, spawn validity checks, top-out detection.

## Selectors

- src/engine/selectors.ts — Pure read selectors for derived UI data: phase guards, PPM/LPM/finesse percentages, lock-delay indicators, active/grounded status, and ghost piece position.
- src/engine/selectors/overlays.ts — Pure selectors for derived overlays: ghost piece, target highlights, and frame-based overlay data from game state.
- src/engine/selectors/effects-to-overlays.ts — Maps UiEffects to overlay representations for unified rendering (bridges effects system with overlay architecture).
- src/engine/selectors/board-render.ts — Combines all overlay sources into complete BoardRenderModel with z-ordered overlays for game board rendering.

## Finesse

- src/finesse/calculator.ts: BFS-based finesse calculation with FinesseAction enum. Computes optimal sequences using abstract moves (MoveLeft/DASLeft/RotateCW/etc). Includes converter functions between ProcessedActions and FinesseActions. Reports faults and analysis.
- src/finesse/constants.ts: Shared constants for finesse system. Contains authoritative FINESSE_ACTION_ICONS mapping and getActionIcon() helper for consistent UI representation across components.
- src/finesse/service.ts: Finesse integration service. Operates on processedInputLog for analysis. Target derivation, input analysis using FinesseActions, fault injection, UI feedback actions. Statistics tracking integration with performance metrics.
- src/finesse/log.ts: Pure helpers for processed input logging and emission rules (Tap vs Hold vs Repeat, SoftDrop transition dedupe). Used by input handlers to emit `ProcessedAction`s with explicit timestamps. Narrowed status parameter accepts discriminated GameState status union for type safety.

## Modes

- src/modes/index.ts: Game mode contracts and registry. Mode-agnostic hooks for config, spawning, guidance, board decorations/overlays, lock resolution, RNG/preview. Registers FreePlayMode and GuidedMode.
- src/modes/types.ts: Mode UI adapter system types. Defines ModeUiAdapter interface for declarative UI data provision, ExtendedModeData for standardized UI fields, and TargetCell for target highlighting.
- src/modes/freePlay.ts: Free-play mode. Finesse evaluation on final placement, succinct feedback. Implements `onResolveLock` retry-on-finesse-error for suboptimal hard drops. Provides 7-bag defaults for RNG/preview.
- src/modes/guided.ts: Guided training powered by FSRS SRS. Picks a (piece, rot, x) card, provides guidance, validates placement, rates Good/Again, updates deck. Supplies board decorations to visualize the target placement cells on the board during play.
- src/modes/lock-pipeline.ts: Pure lock resolution pipeline. Coordinates finesse analysis, mode consultation, and commit/retry decisions. Runs synchronously for consistent game flow.
- src/modes/spawn-service.ts: Pure helpers to externalize RNG and preview queue refills. Provides `planPreviewRefill` and mode-aware RNG provisioning.
- src/modes/freePlay/ui.ts: Free play mode UI adapter. Minimal implementation that returns null as free play requires no special UI data beyond standard rendering.
- src/modes/guided/deck.ts: Generates valid guided cards ordered by difficulty and builds the default deck. Uses round-robin selection across pieces after sorting each piece group by optimal sequence length (easiest first).
- src/modes/guided/types.ts: Branded types for guided mode SRS (Column, CardId, DeckId) with runtime validation.
- src/modes/guided/ui.ts: Guided mode UI adapter. Extracts target cell computation from getBoardDecorations logic and converts it to declarative targets data for UI selectors.

## SRS

- src/srs/fsrs-adapter.ts: FSRS adapter implementing the official ts-fsrs library. Maps GuidedCard to spaced repetition scheduling with Good/Again ratings, JSON serialization/deserialization, and deck management.
- src/srs/storage.ts: Persistence layer for SRS deck state. localStorage integration with versioned migration support and graceful fallback to default deck.

## UI

### Lit Components (Reactive UI)

- src/ui/components/finessimo-shell.tsx: Main application shell component. Orchestrates all child components and provides three-column responsive layout.
- src/ui/components/game-board.tsx: Self-contained game board canvas component. Inlined canvas rendering with reactive signal-based updates, gradient piece styling, ghost piece rendering.
- src/ui/components/effects-overlay.tsx: Generic UI Effects overlay. Renders ephemeral `FloatingText` effects from state (string + color/font/size/anchor/ttl) with upward-fade animation.
- src/ui/components/piece-hold.tsx: Hold piece display component. Self-contained canvas rendering with disabled state visualization and gradient piece styling.
- src/ui/components/piece-preview.tsx: Next piece previews component. Multiple self-contained canvas elements with configurable display count and gradient piece styling.
- src/ui/components/finesse-overlay.tsx: Finesse feedback overlay component. Reactive animations and mode prompts using signal-based state updates.
- src/ui/components/stats-panel.tsx: Statistics display component. Timer-based updates at 2Hz for performance, independent of reactive signals.
- src/ui/components/settings-modal.tsx: Settings modal component. Tabbed interface with timing, gameplay, finesse, and control settings. localStorage persistence and keybinding capture.

### UI Utilities

- src/ui/utils/colors.ts: Shared color manipulation utilities. Functions for lightening and darkening hex colors used across canvas components for gradient piece styling.
- src/ui/utils/dom.ts: Typed DOM query utilities. Centralizes and type-safes document.querySelector calls for custom elements. Provides specific helpers for settings modal, shell, and board frame elements.
- src/ui/utils/outlines.ts: Pure geometry utilities for computing piece outlines. Implements oriented edge cancellation algorithm to compute perimeter paths from grid cells. Used for rendering clean single borders around tetromino shapes in guided mode.
- src/ui/audio.ts: Audio helper for UI sound effects. WebAudio-based boop sound with browser compatibility and fallback handling.

### Debug Utilities

- src/utils/debug.ts: Opt-in debug logger. Enable with localStorage key `finessimo/debug` (e.g., `guided,finesse,occupancy`) or `window.__FINESSIMO_DEBUG__ = { on: true }`. Provides `isDebugEnabled`, `debugLog`, and `debugTable` used by Guided mode and finesse service to log analysis targets, player inputs, optimal sequences, and occupancy diffs.

### Input Utilities

- src/input/utils/key-binding-manager.ts: Keyboard event binding manager. Maps KeyboardEvent.code directly to handlers without pattern parsing. Supports all keys including modifiers as standalone bindings.

### State Management

- src/state/signals.ts: Reactive state management using Lit signals. Global gameStateSignal with dispatch wrapper and selector helpers.

### Styling

- src/ui/styles.css: Complete CSS styling. Responsive design, touch controls, modals, Lit component styling.

## Test Utilities

- tests/setup.ts: Jest setup file that mocks browser APIs for testing. Mocks document.hasFocus(), document.visibilityState, and document.hidden for focus-based pausing tests.
- tests/test-types.ts: Type utilities for testing. InvalidGameState, MalformedAction types, type guards, helpers for creating test scenarios with invalid data.
- tests/test-helpers.ts: Runtime assertion helpers. Type narrowing functions, safe array access, validation utilities for type-safe test code. Includes createTestInitAction helper for consistent test Init actions.
- tests/helpers/actions.ts: Action builder helpers for tests. Simplified creation of common test actions.
- tests/helpers/assert.ts: Additional test assertion utilities and custom matchers.
- tests/helpers/reducer-with-pipeline.ts: Pipeline-aware reducer wrapper for tests. Automatically runs the lock pipeline on staged pending locks and mirrors preview refill behavior.
- tests/scripts/generate-guided-finesse-table.test.ts — Utility test that generates guided_finesse_table.json under ./generated by enumerating guided mode cards and running the BFS finesse calculator.
- tests/unit/guided-deck-ordering.test.ts — Tests for the FSRS card difficulty ordering algorithm that validates round-robin selection across pieces and proper difficulty-based sorting.
- tests/presenter/contracts.test.ts — Phase 0 type-only contracts for the Phaser presenter layer: brand shapes, RenderPlan tag exhaustiveness (never guard), Presenter conformance, and `mapGameStateToViewModel` signature visibility.
- tests/presenter/scenes.spec.ts — Phase 1 shallow scene tests: registry/keys presence and minimal transition method behavior using a typed SceneController stub (no Phaser runtime required).
- tests/presenter/plan.generator.test.ts — Phase 3 pure tests for `BoardPresenter.computePlan`: TileDiff puts/dels on mini boards, PiecePos for active/ghost moves, and topOut FX/Sound transitions.
- tests/presenter/boardPresenter.apply.test.ts — Phase 3 impure tests using fakes to verify blitter.create/reset/visibility toggling and container.setPosition handling.
 - tests/presenter/gameplay.loop.test.ts — Phase 4 integration test for fixed-step loop: scripted inputs over steps drive reducer; presenter receives/computes plans and applies container positions.
