# Finessimo Codebase Overview (TypeScript Files under src/)

This file provides a quick, high-level map of all TypeScript files under src/ and what they do. It’s meant to help future AI assistants orient quickly before diving into code.

## Root Application

- src/main.ts: Browser entrypoint. Waits for DOM ready, initializes and starts FinessimoApp, wires teardown on beforeunload.
- src/app.ts: App orchestrator. Holds current GameState, runs the 60 FPS loop, dispatches actions to the pure reducer, integrates the input handler and UI renderers, auto-spawns pieces, and triggers finesse analysis on piece lock via the finesse service. Supports changing modes.

## State

- src/state/types.ts: Source of truth for core types. Defines Board, ActivePiece, PieceId, Rot, GameplayConfig, TimingConfig, PhysicsState, GameState, and the Action union. Includes helpers idx and isCellBlocked.
- src/state/reducer.ts: Pure reducer implementing game logic and state transitions. Handles init and defaults, spawning (7‑bag via RNG), movement, SRS rotation, hard/soft drop, gravity, lock delay, line clear staging/completion, hold, input logging, and mode/finesse UI updates. Returns new immutable state per action.

## Input

- src/input/handler.ts: Input system and utilities.
  - normalizeInputSequence(...): Normalizes InputEvent[] into a KeyAction[] with a cancellation window.
  - InputHandler interface and internal InputHandlerState.
  - MockInputHandler: Simple, stateful mock that enqueues inputs and dispatches actions directly (for tests/dev).
  - DOMInputHandler: Real keyboard handler. Maps keys to actions, enqueues input, and implements DAS/ARR timing in update.

## Core Mechanics

- src/core/pieces.ts: Tetromino definitions (T,J,L,S,Z,I,O) with cell offsets for rotations (spawn, right, left), spawn top-left positions, and colors.
- src/core/board.ts: Board operations: create empty board, placement/movement checks, move-to-wall, hard drop, bottom check, try-move, lock piece into board, detect completed lines, and clear/compact lines.
- src/core/srs.ts: SRS rotation logic. Kick tables for I and JLSTZ, getNextRotation, canRotate, and tryRotate using wall kicks with y‑down coordinates.
- src/core/rng.ts: Seeded 7‑bag randomizer. RNG state, string hashing, LCG, Fisher‑Yates shuffle, getNextPiece and getNextPieces for preview queues.
- src/core/spawning.ts: Spawn helpers. Create a spawned ActivePiece, check spawn validity, top‑out detection, and a basic hold‑swap spawn helper.

## Finesse

- src/finesse/calculator.ts: Finesse calculation. Defines FinesseCalculator, FinesseResult, and Fault. Implements a BFS on an empty board to compute minimal input sequences (including HardDrop), normalizes player inputs, compares lengths, and reports faults. Exports a default calculator instance.
- src/finesse/service.ts: Finesse integration service. Given a locked piece and mode, derives target (from mode or final drop), builds the spawn origin, normalizes input logs, runs calculator, injects mode‑specific faults, and returns actions to update finesse UI feedback and mode prompts.

## Modes

- src/modes/index.ts: Game mode contracts (GameMode, GameModeResult) and registry. Registers FreePlayMode and GuidedMode.
- src/modes/freePlay.ts: Free‑play mode. Evaluates finesse on actual final placement and returns succinct feedback; no prompts or targets.
- src/modes/guided.ts: Guided drills. Sequence of piece/target challenges with progress tracking, prompts, expected piece/target checks, and feedback with hints/optimal sequence after retries.

## UI

- src/ui/canvas.ts: Canvas renderer. Draws the 10×20 board, active piece, and grid using colors from pieces definitions.
- src/ui/hud.ts: HUD renderer. Renders state summaries (status, tick, active/hold/next, inputs, config, mode), finesse feedback, and an action log. Provides simple buttons to switch modes and utility methods to log actions.

