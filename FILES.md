# Finessimo Codebase Map — src/

Purpose: concise, accurate inventory of all source files in `src/` with one‑line summaries. Core logic is pure and functional; side effects live in input handlers and UI boundaries (see DESIGN.md).

## Docs

- DESIGN.md: Architecture, principles, and gameplay data flow.
- FILES.md: This file — codebase map and conventions.

## Root & App

- src/main.ts: Browser entrypoint; registers components, waits for shell, boots `FinessimoApp`, exposes it on `window`.
- src/global.d.ts: Ambient typing for `window.finessimoApp`.
- src/app/app.ts: App orchestrator; 60 Hz loop, reducer/dispatch wiring, lock pipeline, mode/UI adapter hooks, settings integration.
- src/app/settings.ts: LocalStorage adapter for game settings; loads/saves and serializes engine state + keybindings.

## Types

- src/types/brands.ts: Branded primitives (`DurationMs`, `GridCoord`, `UiEffectId`, etc.) + constructors/guards/converters.
- src/types/timestamp.ts: Branded `Timestamp` with constructors (`createTimestamp`, `fromNow`) and interop helpers.

## State

- src/state/types.ts: Domain model: `GameState` variants, `Action` union, `Board`/`ActivePiece`, configs, `Stats`, `UiEffect`, helpers.
- src/state/reducer.ts: Pure reducer for gameplay transitions; delegates physics post‑step; manages effects/stats/mode plumbing.
- src/state/signals.ts: Lit signals bridge: `gameStateSignal`, `dispatch`, and selector helpers for minimal UI deps.

## Core (pure mechanics)

- src/core/board.ts: Board ops: placement/collision, move/drop/walls, lock piece, line detection/clearing, ghost.
- src/core/pieces.ts: Tetromino shapes (cells per rotation), spawn offsets, colors.
- src/core/srs.ts: SRS rotation/kicks (JLSTZ/I); `getNextRotation`, `tryRotate`, `canRotate`.
- src/core/spawning.ts: Create spawn `ActivePiece`; spawn/top‑out checks; hold‑aware spawn helper.
- src/core/rng/interface.ts: `PieceRandomGenerator` interface for seedable RNGs.
- src/core/rng/seeded.ts: Seeded 7‑bag RNG (`createSevenBagRng`, `getNextPiece(s)`); wrapper implementing the interface.
- src/core/rng/test-rngs.ts: Deterministic RNGs for tests (`OnePieceRng`, `SequenceRng`).

## Engine (reducers, physics, scoring, selectors)

- src/engine/init.ts: Defaults + `createInitialState`/physics setup; primes preview queue/RNG.
- src/engine/lock-utils.ts: Build `PendingLock` (simulate final position + completed lines) for uniform lock handling.
- src/engine/physics/lock-delay.machine.ts: Lock‑delay ADT (`Airborne`/`Grounded`) + `stepLockDelay` state machine.
- src/engine/physics/gravity.ts: Gravity step and LD integration; stages `pendingLock` when due.
- src/engine/physics/post-step.ts: Post‑reducer lock‑delay advancement with action‑aware reset/skip rules.
- src/engine/scoring/stats.ts: Derived metrics (`derive`), `applyDelta`, and session duration updates.
- src/engine/scoring/line-clear.ts: Apply/commit pending locks, line‑clear animation/immediate path, top‑out, stats.
- src/engine/gameplay/movement.ts: Horizontal movement handlers for Tap/Hold/Repeat (pure).
- src/engine/gameplay/rotation.ts: Rotation handler using SRS + collision checks.
- src/engine/gameplay/spawn.ts: Spawn handler; queue consumption/override; top‑out detection; physics reset.
- src/engine/gameplay/hold.ts: Hold handler; swap/queue consume; hold enable/disable lifecycle.
- src/engine/selectors.ts: Read‑only selectors (status flags, ghost, LD info, derived stats).
- src/engine/selectors/overlays.ts: Derived overlays from state/mode data (ghost, targets, column highlight).
- src/engine/selectors/effects-to-overlays.ts: Map `UiEffect` entries to overlay representations.
- src/engine/selectors/board-render.ts: Final render model; combine/sort all overlays for board rendering.
- src/engine/ui/effects.ts: UI effects list helpers: push/prune (TTL)/clear (pure, timestamp‑driven).
- src/engine/ui/overlays.ts: Overlay union/types (ghost/target/line‑flash/effect‑dot/column‑highlight) + z‑order.
- src/engine/util/cell-projection.ts: Map `ActivePiece` to absolute grid cell tuples for overlay consumers.

### Engine — Finesse

- src/engine/finesse/calculator.ts: Board‑aware finesse BFS; compares player inputs vs minimal sequences.
- src/engine/finesse/constants.ts: Unicode icons for finesse actions.
- src/engine/finesse/log.ts: Pure helpers to build/decide `ProcessedAction`s for finesse logging.
- src/engine/finesse/service.ts: Orchestrates finesse analysis and emits reducer actions (feedback/stats/clear log).

## Input (side‑effects at the edge)

- src/input/handler.ts: Input facade/types + normalization utilities; testable mock handler.
- src/input/keyboard/bindings.ts: Bindable actions, default/load/save bindings, `KeyboardInputHandler` wrapper.
- src/input/keyboard/handler.ts: State‑machine keyboard handler; DAS/ARR integration; emits typed Actions + processed log.
- src/input/machines/das.ts: Robot3 DAS state machine and service; emits Tap/Hold/Repeat actions.
- src/input/touch/handler.ts: Touch overlay + gesture handling; delegates movement to keyboard state machine.
- src/input/utils/key-binding-manager.ts: Minimal key binding registry with add/remove helpers.

## Modes

- src/modes/index.ts: `GameMode` interface/registry; resolve‑lock contract; RNG/preview hooks.
- src/modes/types.ts: Mode UI adapter contract + `ExtendedModeData` and guard.
- src/modes/lock-pipeline.ts: Lock pipeline; finesse → mode decision → Commit/Retry dispatch.
- src/modes/spawn-service.ts: Mode‑owned RNG helpers + preview refill planner.
- src/modes/free-play/mode.ts: Free‑play mode; defaults, optional retry on hard‑drop finesse faults.
- src/modes/free-play/ui.ts: Free‑play UI adapter (no special derived UI data).
- src/modes/guided/mode.ts: Guided SRS trainer: deck/rating flow, prompts, persistence, post‑lock effects.
- src/modes/guided/deck.ts: Generate canonical deck, order by difficulty; helpers for columns/rotations.
- src/modes/guided/srs/fsrs-adapter.ts: FSRS‑style scheduling adapter + deck types, (de)serialization.
- src/modes/guided/srs/storage.ts: LocalStorage persistence for guided deck with sanitization.
- src/modes/guided/types.ts: Branded types for guided mode (Column, CardId, DeckId).
- src/modes/guided/ui.ts: Guided UI adapter; computes target cells; suppresses ghost for clarity.

## UI — Components

- src/ui/components/finessimo-shell.tsx: App shell layout (hold/board/preview + overlays/modals).
- src/ui/components/game-board.tsx: Canvas renderer; pulls `BoardRenderModel`; renders board/overlays/active piece.
- src/ui/components/finesse-overlay.tsx: Heads‑up finesse feedback overlay with auto‑hide and audio hook.
- src/ui/components/effects-overlay.tsx: Renders floating text effects from `uiEffects`.
- src/ui/components/piece-hold.tsx: Hold piece canvas with availability indicator.
- src/ui/components/piece-preview.tsx: Next queue canvases; renders N upcoming pieces.
- src/ui/components/stats-panel.tsx: Periodic stats display (PPM/LPM/accuracy/etc.).
- src/ui/components/tabbed-panel.tsx: Tabs for Stats and Settings panels.
- src/ui/components/keybinding-modal.tsx: Rebind keys modal with capture/block logic.
- src/ui/components/settings-view.tsx: Settings panel; emits typed engine events and keybinding changes.
- src/ui/components/settings/button.tsx: Settings button element.
- src/ui/components/settings/checkbox.tsx: Settings checkbox element.
- src/ui/components/settings/dropdown.tsx: Settings dropdown element.
- src/ui/components/settings/slider.tsx: Settings slider with drag/inline edit.

## UI — Renderers (pure)

- src/ui/renderers/cells.ts: Draw board cells and active piece cells; color mapping.
- src/ui/renderers/grid-cache.ts: Offscreen grid cache for visible play area.
- src/ui/renderers/outline-cache.ts: Memoized outline path computation for target overlays.
- src/ui/renderers/overlays.ts: Exhaustive overlay renderer (ghost/target/line‑flash/effect‑dot/column‑highlight).
- src/ui/renderers/tween.ts: Pure tween state for vertical piece animations.
- src/ui/renderers/viewport.ts: Background/border drawing for visible play area.

## UI — Types & Utils

- src/ui/types/board-render-frame.ts: Immutable frame data structure for board rendering.
- src/ui/types/brands-render.ts: Branded render‑space units (viewport dims, pixel coords) + helpers.
- src/ui/types/settings.ts: UI settings shape for view/adapters.
- src/ui/utils/colors.ts: Color helpers (lighten/darken/normalize brightness).
- src/ui/utils/dom.ts: Typed DOM helpers to locate app shell/board/settings.
- src/ui/utils/outlines.ts: Geometry utilities for cell outlines; Path2D conversion; hashing.
- src/ui/audio.ts: Minimal WebAudio helper (boop on miss).

## Styles (CSS)

- src/ui/styles/index.css: Main CSS entry; imports all style modules in cascade order.
- src/ui/styles/foundations/fonts.css: @font‑face declarations for custom fonts.
- src/ui/styles/foundations/variables.css: CSS custom properties (theme tokens, colors, spacing).
- src/ui/styles/foundations/reset.css: CSS reset, base styles, focus states.
- src/ui/styles/layout/header.css: Header, branding, navigation elements.
- src/ui/styles/layout/app-shell.css: App shell grid layout (hold/board/preview columns).
- src/ui/styles/layout/panels.css: Panel container styles and utilities.
- src/ui/styles/components/game-board.css: Board frame, canvas, effects overlay container.
- src/ui/styles/components/game-pieces.css: Hold and preview sections; piece layouts.
- src/ui/styles/components/stats-panel.css: Statistics panel styles.
- src/ui/styles/components/controls.css: Touch controls overlay/zones/buttons.
- src/ui/styles/components/modals.css: Settings + keybinding modal styles.
- src/ui/styles/effects/animations.css: Keyframe animations for overlays/effects.
- src/ui/styles/effects/finesse.css: Finesse feedback overlay, action icons.
- src/ui/styles/lit-components/board.css: Web component styles for board/hold/preview.
- src/ui/styles/lit-components/settings.css: Styles for settings components.
- src/ui/styles/responsive/breakpoints.css: Media queries and responsive adjustments.

