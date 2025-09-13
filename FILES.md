# Finessimo - File Structure

This document provides a concise overview of the TypeScript source files under `src/`.

## Docs (repo root)

- `DESIGN.md` — Unified architecture and engine design (single source of truth; merged from CORE_DESIGN.md and TICK_CORE_DESIGN.md)

## Core Engine (`src/engine/`)

### Main Engine Files

- `src/engine/index.ts` — Main engine API (init, step, stepN functions)
- `src/engine/types.ts` — Unified type system, re-exports core types, GameState, PhysicsState
- `src/engine/commands.ts` — Command types for input (MoveLeft, RotateCW, etc.)
- `src/engine/events.ts` — Domain event types (PieceSpawned, Locked, etc.)

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

## Control Layer (`src/control/`)

- `src/control/index.ts` — Input handling and command mapping
- `src/control/types.ts` — Control-related type definitions

## Adapters (`src/adapters/`)

- `src/adapters/excalibur.ts` — Excalibur.js game engine adapter
- `src/adapters/config-adapter.ts` — Tick conversion utilities for config (re-exports)

## Analytics (`src/analytics/`)

- `src/analytics/finesse.ts` — Tetris finesse analysis and scoring

## Architecture Overview

The engine follows a functional architecture with clear separation of concerns:

1. **Input** → Commands (control layer)
2. **Commands** → State mutations (apply-commands.ts)
3. **Physics** → Gravity, lock delay, grounding (advance-physics.ts)
4. **Transitions** → Locking, line clearing, spawning (resolve-transitions.ts)
5. **Events** → External systems notification
