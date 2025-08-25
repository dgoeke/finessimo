# Finessimo Codebase Overview (TypeScript Files under src/)

This file provides a quick, high-level map of all TypeScript files under src/ and what they do. It's meant to help future AI assistants orient quickly before diving into code.

## Documentation

- DAS-Playbook.md: Comprehensive architecture guide for DAS state machine integration. Describes the problem with current input handling (tap vs hold classification), solution using Robot3 state machines, implementation phases, file structure, and migration strategy. Essential reading for understanding the state machine approach to input classification.

## Dependencies

- Added Robot3 (v1.1.1): Fast 1kB functional library for creating finite state machines. Used for DAS state machine implementation to provide proper input classification at the source.

## Root Application

- src/main.ts: Browser entrypoint. Initializes FinessimoApp on DOM ready.
- src/app.ts: Main app orchestrator. 60 FPS game loop, state management, finesse analysis integration, mode switching, settings dispatch.
- src/global.d.ts: Global TypeScript declarations and ambient module types.

## State

- src/state/types.ts: Core types and interfaces. GameState, Action union (including new TapMove, HoldMove, RepeatMove, HoldStart for granular input classification), Stats (20+ comprehensive metrics), Board, ActivePiece, configs. Includes processedInputLog for finesse analysis. Statistics tracking actions.
- src/state/reducer.ts: Pure reducer for game logic. Handles movement, rotation, spawning, line clears, hold, gravity, lock delay. Manages processedInputLog for finesse analysis. Comprehensive statistics tracking with derived metrics calculation.

## Types

- src/types/timestamp.ts: Branded timestamp types and helper functions. Provides Timestamp type, createTimestamp(), fromNow(), and validation utilities for type-safe timestamp handling throughout the app.

## Input

- src/input/handler.ts: Pure input utilities and mock. Provides `normalizeInputSequence`, pure DAS/ARR calculators, and a `MockInputHandler` used in tests. Core app input is handled by the state-machine-based handler below.
- src/input/keyboard.ts: Keyboard input handler with key bindings, storage persistence, DOM event handling. Delegates timing logic to InputProcessor for clean separation of concerns.
- src/input/touch.ts: TouchInputHandler for mobile. Gesture detection, touch zones, swipe handling. Delegates timing logic to InputProcessor for unified behavior with keyboard input.
- src/input/StateMachineInputHandler.ts: State machine-based input handler implementing InputHandler interface. Uses DASMachineService internally for precise input classification. Maps keyboard events to DAS machine events and dispatches granular action types (TapMove, HoldMove, RepeatMove, HoldStart). Provides more accurate input classification for improved finesse analysis while maintaining backward compatibility.

### Input State Machines

- src/input/machines/das.ts: DAS (Delayed Auto Shift) state machine implementation using Robot3. Provides DASMachineService for manual state management and createDASMachine for Robot3 integration. Handles tap vs hold input classification at source with states: idle → charging → repeating. Updated to emit granular action types (TapMove, HoldMove, RepeatMove, HoldStart) instead of generic Move actions. Includes comprehensive context management, timing logic, and precise action emission for enhanced finesse analysis. Exports reducer functions and guard functions for testability.

## Core Mechanics

- src/core/pieces.ts: Tetromino definitions with 4-way rotations, spawn positions, colors.
- src/core/board.ts: Board operations. Movement checks, hard drop, piece locking, line detection/clearing.
- src/core/srs.ts: SRS rotation with kick tables. Handles I and JLSTZ pieces with wall kicks.
- src/core/rng.ts: Seeded 7-bag randomizer for piece generation and preview queues.
- src/core/spawning.ts: Piece spawning, spawn validity checks, top-out detection.

## Finesse

- src/finesse/calculator.ts: BFS-based finesse calculation with FinesseAction enum. Computes optimal sequences using abstract moves (MoveLeft/DASLeft/RotateCW/etc). Includes converter functions between ProcessedActions and FinesseActions. Reports faults and analysis.
- src/finesse/service.ts: Finesse integration service. Operates on processedInputLog for analysis. Target derivation, input analysis using FinesseActions, fault injection, UI feedback actions. Statistics tracking integration with performance metrics.

## Modes

- src/modes/index.ts: Game mode contracts and registry. Mode-agnostic hooks for config, spawning, guidance. Registers FreePlayMode and GuidedMode.
- src/modes/freePlay.ts: Free-play mode. Finesse evaluation on final placement, succinct feedback.
- src/modes/guided.ts: Guided training drills. Piece/target challenges, progress tracking, hints, expected piece/target validation.

## UI

- src/ui/canvas.ts: Main board renderer. 10×20 grid, active piece, ghost piece (if enabled).
- src/ui/hud.ts: Game state HUD. Status, stats, mode info, finesse feedback display.
- src/ui/preview.ts: Next piece previews with mini canvases. Configurable display count.
- src/ui/hold.ts: Hold piece display with availability state.
- src/ui/finesse.ts: Finesse visualization. Target highlighting, path indicators, and progress overlay driven by `processedInputLog` coalesced into FinesseActions.
- src/ui/finesse-feedback.ts: Finesse feedback UI component. Displays finesse analysis results and suggestions.
- src/ui/statistics.ts: Statistics display panel. Real-time game statistics, performance metrics, session tracking.
- src/ui/settings.ts: Settings panel with tabs (Timing, Gameplay, Visual, Controls). localStorage persistence, keybinding support.
- src/ui/styles.css: Complete CSS styling. Responsive design, touch controls, modals.

## Test Utilities

- tests/test-types.ts: Type utilities for testing. InvalidGameState, MalformedAction types, type guards, helpers for creating test scenarios with invalid data.
- tests/test-helpers.ts: Runtime assertion helpers. Type narrowing functions, safe array access, validation utilities for type-safe test code.
- tests/helpers/assert.ts: Additional test assertion utilities and custom matchers.
