# Finessimo - File Structure

This document provides a concise overview of the TypeScript source files under `src/`.

## Docs (repo root)

- `DESIGN.md` — Unified architecture and engine design (single source of truth; merged from CORE_DESIGN.md and TICK_CORE_DESIGN.md)

## Application Entry (`src/`)

- `src/main.ts` — Minimal application entry point

## Core Engine (`src/engine/`)

### Main Engine Files

- `src/engine/index.ts` — Main engine API (init, step, stepN functions)
- `src/engine/types.ts` — Unified type system, re-exports core types, GameState, PhysicsState
- `src/engine/commands.ts` — Command types for input (MoveLeft, RotateCW, etc.)
- `src/engine/events.ts` — Domain event types (PieceSpawned, Locked, etc.)
- `src/engine/ops.ts` — Pure state transformation functions for mode-controlled scenarios

### Core Game Logic (`src/engine/core/`)

- `src/engine/core/types.ts` — Fundamental types (Board, PieceId, Rot, ActivePiece) with branded coordinates
- `src/engine/core/board.ts` — Board manipulation (collision, movement, locking, line clearing)
- `src/engine/core/pieces.ts` — Tetromino shape definitions with SRS spawn positions
- `src/engine/core/srs.ts` — Super Rotation System with wall kick tables
- `src/engine/core/spawning.ts` — Piece spawning logic, top-out detection, hold mechanics

#### Random Number Generation (`src/engine/core/rng/`)

- `src/engine/core/rng/interface.ts` — PieceRandomGenerator interface
- `src/engine/core/rng/seeded.ts` — 7-bag randomizer with seedable PRNG
- `src/engine/core/rng/one-piece.ts` — Single-piece RNG for testing
- `src/engine/core/rng/sequence.ts` — Fixed sequence RNG for testing

### Gameplay Logic (`src/engine/gameplay/`)

- `src/engine/gameplay/movement.ts` — Movement functions (left/right, rotation, hard drop, hold)
- `src/engine/gameplay/spawn.ts` — High-level spawning operations (locking, line clearing, spawning)

### Physics (`src/engine/physics/`)

- `src/engine/physics/gravity.ts` — Gravity and soft drop via Q16.16 accumulator
- `src/engine/physics/lock-delay.ts` — Lock delay timing and reset logic

### Step Processing (`src/engine/step/`)

- `src/engine/step/apply-commands.ts` — Command processing and event generation
- `src/engine/step/advance-physics.ts` — Physics simulation and lock delay updates
- `src/engine/step/resolve-transitions.ts` — State transitions (locking → line clear → spawn)

### Utilities (`src/engine/utils/`)

- `src/engine/utils/tick.ts` — Tick manipulation functions
- `src/engine/utils/fixedpoint.ts` — Fixed-point arithmetic helpers

## Game Modes (`src/modes/`)

- `src/modes/base.ts` — Base mode interface and common types for training modes
- `src/modes/freeplay.ts` — Pass-through mode for normal gameplay
- `src/modes/finesse_trainer.ts` — Finesse training mode with fixed scenarios
- `src/modes/garbage_race.ts` — Garbage clearing race mode
- `src/modes/opening_trainer.ts` — Opening sequence practice mode

## Control Layer (`src/control/`)

- `src/control/index.ts` — Input handling and command mapping with DAS/ARR telemetry
- `src/control/types.ts` — Control-related type definitions including telemetry events

## Device Input (`src/device/`)

- `src/device/types.ts` — Unified device input representation (keyboard, mouse, touch, gamepad)

## Runtime (`src/runtime/`)

- `src/runtime/loop.ts` — Main runtime loop coordinating engine, control, and mode systems

## UI Effects (`src/ui/`)

- `src/ui/effects.ts` — UI effect types for mode feedback (messages, highlights, sounds)

## Adapters (`src/adapters/`)

- `src/adapters/excalibur.ts` — Excalibur.js game engine adapter
- `src/adapters/config-adapter.ts` — Tick conversion utilities for config (re-exports)

## Debug UI (`src/debug/`)

- `src/debug/ui.ts` — Debug UI creation with game area, status, event log, and control log
- `src/debug/game.ts` — Debug game instance with telemetry integration
- `src/debug/event-logger.ts` — Engine event logging display
- `src/debug/control-logger.ts` — Control telemetry logging display
- `src/debug/input.ts` — Keyboard input handling for debug mode
- `src/debug/renderer.ts` — Canvas rendering for debug visualization

## Analytics (`src/analytics/`)

- `src/analytics/finesse.ts` — Tetris finesse analysis and scoring

## Architecture Overview

The engine follows a functional architecture with clear separation of concerns:

1. **Input** → Commands (device → control layer)
2. **Commands** → State mutations (apply-commands.ts)
3. **Physics** → Gravity, lock delay, grounding (advance-physics.ts)
4. **Transitions** → Locking, line clearing, spawning (resolve-transitions.ts)
5. **Events** → External systems notification
6. **Modes** → Training scenarios and game flow control
7. **Runtime** → Coordination of all subsystems
