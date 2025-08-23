# Finessimo Codebase Overview (TypeScript Files under src/)

This file provides a quick, high-level map of all TypeScript files under src/ and what they do. It’s meant to help future AI assistants orient quickly before diving into code.

## Root Application

- src/main.ts: Browser entrypoint. Waits for DOM ready, initializes and starts FinessimoApp, wires teardown on beforeunload.
- src/app.ts: App orchestrator. Holds current GameState, runs the 60 FPS loop, dispatches actions to the pure reducer, integrates the input handler and UI renderers, auto-spawns pieces, triggers finesse analysis on piece lock, supports changing modes, and applies settings by dispatching UpdateTiming/UpdateGameplay actions. Passes preview count to the preview renderer.

## State

- src/state/types.ts: Source of truth for core types. Defines Board, ActivePiece, PieceId, Rot, GameplayConfig (now includes ghostPieceEnabled, nextPieceCount), TimingConfig, PhysicsState, GameState, and the Action union. Includes helpers idx and isCellBlocked, and adds UpdateTiming/UpdateGameplay actions.
- src/state/reducer.ts: Pure reducer implementing game logic and state transitions. Handles init/defaults (incl. ghostPieceEnabled/nextPieceCount defaults), spawning (7‑bag via RNG), movement, SRS rotation, hard/soft drop, gravity, lock delay, line clear staging/completion, hold, input logging, mode/finesse UI updates, and settings updates via UpdateTiming/UpdateGameplay. Returns new immutable state per action.

## Input

- src/input/handler.ts: Input system and utilities.
  - normalizeInputSequence(...): Normalizes InputEvent[] into a KeyAction[] with a cancellation window.
  - InputHandler interface and internal InputHandlerState.
  - MockInputHandler: Simple, stateful mock that enqueues inputs and dispatches actions directly (for tests/dev).
  - DOMInputHandler: Real keyboard handler. Maps keys to actions, enqueues input, and implements DAS/ARR timing in update.
- src/input/touch.ts: Touch input handler for mobile devices.
  - TouchInputHandler: Implements touch controls with gesture detection, DAS/ARR timing, and visual touch zones. Supports both keyboard and touch simultaneously.

## Core Mechanics

- src/core/pieces.ts: Tetromino definitions (T,J,L,S,Z,I,O) with cell offsets for 4-way rotations (spawn, right, two, left), spawn top-left positions, and colors.
- src/core/board.ts: Board operations: create empty board, placement/movement checks, move-to-wall, hard drop, bottom check, try-move, lock piece into board, detect completed lines, and clear/compact lines.
- src/core/srs.ts: SRS-compliant rotation logic. Kick tables for I and JLSTZ pieces (adjacent states only), getNextRotation, canRotate, and tryRotate using wall kicks with y‑down coordinates. Direct 180° rotations require sequential 90° turns.
- src/core/rng.ts: Seeded 7‑bag randomizer. RNG state, string hashing, LCG, Fisher‑Yates shuffle, getNextPiece and getNextPieces for preview queues.
- src/core/spawning.ts: Spawn helpers. Create a spawned ActivePiece, check spawn validity, top‑out detection, and a basic hold‑swap spawn helper.

## Finesse

- src/finesse/calculator.ts: Finesse calculation. Defines FinesseCalculator, FinesseResult, and Fault. Implements a BFS on an empty board to compute minimal input sequences (including HardDrop), normalizes player inputs, compares lengths, and reports faults. Exports a default calculator instance.
- src/finesse/service.ts: Finesse integration service. Given a locked piece and mode, derives target (from mode or final drop), builds the spawn origin, normalizes input logs, runs calculator, injects mode‑specific faults, and returns actions to update finesse UI feedback and mode prompts.

## Modes

- src/modes/index.ts: Game mode contracts (GameMode, GameModeResult) and registry. Adds optional hooks `initialConfig`, `initModeData`, `onBeforeSpawn`, and `getGuidance` so the engine stays mode-agnostic. Registers FreePlayMode and GuidedMode.
- src/modes/freePlay.ts: Free‑play mode. Evaluates finesse on actual final placement and returns succinct feedback; no prompts or targets. Implements `onBeforeSpawn` (no override) and `getGuidance` (null).
- src/modes/guided.ts: Guided drills. Sequence of piece/target challenges with progress tracking, prompts, expected piece/target checks, and feedback with hints/optimal sequence after retries. Implements `onBeforeSpawn` to provide the expected piece and `getGuidance` to supply target and label.

## UI

- src/ui/canvas.ts: Canvas renderer. Draws the 10×20 board, active piece, and grid using colors from pieces definitions. Respects gameplay.ghostPieceEnabled when rendering the ghost piece.
- src/ui/hud.ts: HUD renderer. Renders state summaries (status, tick, active/hold/next, inputs, config, mode), finesse feedback, and an action log. Shows prompt from `state.guidance.label` when present.
- src/ui/preview.ts: Visual next piece preview renderer. Displays upcoming pieces with mini canvases showing actual tetromino shapes and colors. Accepts a display count to cap shown previews (from settings).
- src/ui/hold.ts: Visual hold piece display renderer. Shows held piece visually with grayed-out state when hold is unavailable.
- src/ui/finesse.ts: Finesse visualization renderer. Provides visual feedback for optimal piece placement including target position highlighting, path indicators, and finesse quality indicators. Path simulation starts from spawn and uses core movement/rotation (SRS) on an empty board to match BFS; target Y uses real board collision (ghost).
- src/ui/settings.ts: Settings/configuration panel. Comprehensive settings interface with timing, gameplay, and visual options. Includes localStorage persistence and tabbed interface.
- src/ui/styles.css: Complete CSS styling for the application, including responsive design, preview/hold displays, touch controls, finesse visualization, and settings modal.
