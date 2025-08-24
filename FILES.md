# Finessimo Codebase Overview (TypeScript Files under src/)

This file provides a quick, high-level map of all TypeScript files under src/ and what they do. It’s meant to help future AI assistants orient quickly before diving into code.

## Root Application

- src/main.ts: Browser entrypoint. Initializes FinessimoApp on DOM ready.
- src/app.ts: Main app orchestrator. 60 FPS game loop, state management, finesse analysis integration, mode switching, settings dispatch.

## State

- src/state/types.ts: Core types and interfaces. GameState, Action union, Stats (20+ comprehensive metrics), Board, ActivePiece, configs. Statistics tracking actions.
- src/state/reducer.ts: Pure reducer for game logic. Handles movement, rotation, spawning, line clears, hold, gravity, lock delay. Comprehensive statistics tracking with derived metrics calculation.

## Input

- src/input/handler.ts: Input system with DOMInputHandler (keyboard + keybindings), MockInputHandler (testing), input normalization, DAS/ARR timing.
- src/input/touch.ts: TouchInputHandler for mobile. Gesture detection, touch zones, simultaneous keyboard/touch support.

## Core Mechanics

- src/core/pieces.ts: Tetromino definitions with 4-way rotations, spawn positions, colors.
- src/core/board.ts: Board operations. Movement checks, hard drop, piece locking, line detection/clearing.
- src/core/srs.ts: SRS rotation with kick tables. Handles I and JLSTZ pieces with wall kicks.
- src/core/rng.ts: Seeded 7-bag randomizer for piece generation and preview queues.
- src/core/spawning.ts: Piece spawning, spawn validity checks, top-out detection.

## Finesse

- src/finesse/calculator.ts: BFS-based finesse calculation. Computes optimal input sequences, compares with player inputs, reports faults.
- src/finesse/service.ts: Finesse integration. Target derivation, input analysis, fault injection, UI feedback actions. Statistics tracking integration with performance metrics.

## Modes

- src/modes/index.ts: Game mode contracts and registry. Mode-agnostic hooks for config, spawning, guidance. Registers FreePlayMode and GuidedMode.
- src/modes/freePlay.ts: Free-play mode. Finesse evaluation on final placement, succinct feedback.
- src/modes/guided.ts: Guided training drills. Piece/target challenges, progress tracking, hints, expected piece/target validation.

## UI

- src/ui/canvas.ts: Main board renderer. 10×20 grid, active piece, ghost piece (if enabled).
- src/ui/hud.ts: Game state HUD. Status, stats, mode info, finesse feedback display.
- src/ui/preview.ts: Next piece previews with mini canvases. Configurable display count.
- src/ui/hold.ts: Hold piece display with availability state.
- src/ui/finesse.ts: Finesse visualization. Target highlighting, path indicators, quality feedback.
- src/ui/settings.ts: Settings panel with tabs (Timing, Gameplay, Visual, Controls). localStorage persistence, keybinding support.
- src/ui/styles.css: Complete CSS styling. Responsive design, touch controls, modals.

## Test Utilities

- tests/test-types.ts: Type utilities for testing. InvalidGameState, MalformedAction types, type guards, helpers for creating test scenarios with invalid data.
- tests/test-helpers.ts: Runtime assertion helpers. Type narrowing functions, safe array access, validation utilities for type-safe test code.
