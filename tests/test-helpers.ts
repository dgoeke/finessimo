/**
 * @fileoverview Shared test helper functions for Finessimo tests
 *
 * This module consolidates commonly used test helper functions from across
 * the test suite to reduce duplication and provide consistent test utilities.
 */

import { step } from "@/engine";
import { type Command } from "@/engine/commands";
import { createEmptyBoard } from "@/engine/core/board";
import { SequenceRng } from "@/engine/core/rng/sequence";
import {
  type ActivePiece,
  type Board,
  type PieceId,
  type Rot,
  createBoardCells,
  createGridCoord,
  idx,
} from "@/engine/core/types";
import { type DomainEvent } from "@/engine/events";
import {
  mkInitialState,
  type EngineConfig,
  type GameState,
  type PhysicsState,
  type PieceRandomGenerator,
  type Q16_16,
  type Tick,
  type TickDelta,
} from "@/engine/types";
import { toQ } from "@/engine/utils/fixedpoint";

/**
 * Creates a test EngineConfig with sensible defaults for testing.
 *
 * @param overrides - Partial config to override defaults
 * @returns Complete EngineConfig suitable for testing
 *
 * @example
 * ```typescript
 * const config = createTestConfig({ gravity32: toQ(1.0) });
 * const highGravityConfig = createTestConfig({
 *   gravity32: toQ(2.0),
 *   softDrop32: toQ(10.0)
 * });
 * ```
 */
export function createTestConfig(
  overrides: Partial<EngineConfig> = {},
): EngineConfig {
  return {
    gravity32: toQ(0.5), // 0.5 cells per tick - predictable for testing
    height: 20,
    lockDelayTicks: 30 as TickDelta,
    maxLockResets: 15,
    previewCount: 7,
    rngSeed: 12345,
    softDrop32: toQ(2.0), // 2.0 cells per tick when soft dropping
    width: 10,
    ...overrides,
  } as const;
}

/**
 * Creates a complete GameState with sensible defaults for testing.
 * Properly handles nested object merging for physics and hold state.
 *
 * @param overrides - Partial state to override defaults
 * @param gravity32 - Optional gravity override for convenience
 * @returns Complete GameState suitable for testing
 *
 * @example
 * ```typescript
 * const state = createTestGameState({ piece: createTestPiece("T") });
 * const fastGravityState = createTestGameState({}, toQ(2.0));
 * const customState = createTestGameState({
 *   hold: { piece: "I", usedThisTurn: true },
 *   physics: { softDropOn: true }
 * });
 * ```
 */
export function createTestGameState(
  overrides: Partial<GameState> = {},
  gravity32: Q16_16 = toQ(0.5),
): GameState {
  // Extract softDrop32 from cfg overrides if present for consistent config creation
  const softDrop32 = overrides.cfg?.softDrop32;
  const cfg = createTestConfig({
    gravity32,
    ...(softDrop32 && { softDrop32 }),
  });
  const baseState = mkInitialState(cfg, 0 as Tick);

  return {
    ...baseState,
    ...overrides,
    // Properly merge nested objects
    hold: {
      ...baseState.hold,
      ...(overrides.hold ?? {}),
    },
    physics: {
      ...baseState.physics,
      ...(overrides.physics ?? {}),
      // Ensure lock object is properly merged
      lock: {
        ...baseState.physics.lock,
        ...(overrides.physics?.lock ?? {}),
      },
    },
  };
}

/**
 * Creates an ActivePiece at the specified position with proper branded types.
 *
 * @param id - Piece type identifier
 * @param x - X coordinate (default: 4, center spawn position)
 * @param y - Y coordinate (default: 0, visible area)
 * @param rot - Rotation state (default: "spawn")
 * @returns ActivePiece with branded coordinate types
 *
 * @example
 * ```typescript
 * const tPiece = createTestPiece("T"); // T piece at (4, 0) in spawn rotation
 * const rotatedPiece = createTestPiece("I", 5, 10, "right");
 * const bottomPiece = createTestPiece("O", 3, 18);
 * ```
 */
export function createTestPiece(
  id: PieceId = "T",
  x = 4,
  y = 0,
  rot: Rot = "spawn",
): ActivePiece {
  return {
    id,
    rot,
    x: createGridCoord(x),
    y: createGridCoord(y),
  };
}

/**
 * Sets an individual cell on the board to a specified value.
 * Returns a new board with the cell modified, preserving immutability.
 *
 * @param board - Source board to modify
 * @param x - X coordinate of cell to set
 * @param y - Y coordinate of cell to set (supports vanish zone: y >= -3)
 * @param value - Cell value to set (0-8)
 * @returns New Board with the specified cell modified
 *
 * @example
 * ```typescript
 * let board = createEmptyBoard();
 * board = setBoardCell(board, 4, 10, 1); // Set obstacle at (4, 10)
 * board = setBoardCell(board, 5, -1, 7); // Set cell in vanish zone
 * ```
 */
export function setBoardCell(
  board: Board,
  x: number,
  y: number,
  value: number,
): Board {
  const newCells = createBoardCells();

  // Copy existing cells
  for (let i = 0; i < board.cells.length; i++) {
    newCells[i] = board.cells[i] ?? 0;
  }

  // Set the specific cell
  const index = idx(board, createGridCoord(x), createGridCoord(y));
  newCells[index] = value;

  return { ...board, cells: newCells };
}

/**
 * Creates a test board with empty cells by default.
 * Optionally accepts custom cell values as an index-to-value mapping.
 *
 * @param customCells - Optional mapping of cell indices to values
 * @returns New Board with specified cells filled
 *
 * @example
 * ```typescript
 * const emptyBoard = createTestBoard();
 * const customBoard = createTestBoard({
 *   30: 1,  // Set cell at index 30 to value 1
 *   31: 2   // Set cell at index 31 to value 2
 * });
 * ```
 */
export function createTestBoard(
  customCells: Record<number, number> = {},
): Board {
  const board = createEmptyBoard();
  const newCells = createBoardCells();

  // Copy existing empty cells
  for (let i = 0; i < board.cells.length; i++) {
    newCells[i] = board.cells[i] ?? 0;
  }

  // Apply custom cells
  for (const [indexStr, value] of Object.entries(customCells)) {
    const index = parseInt(indexStr, 10);
    newCells[index] = value;
  }

  return { ...board, cells: newCells };
}

/**
 * Fills an entire row on the board with the specified value.
 * Returns a new board with the row filled, preserving immutability.
 *
 * @param board - Source board to modify
 * @param y - Row Y coordinate to fill (supports vanish zone: y >= -3)
 * @param value - Value to fill the row with (default: 1)
 * @returns New Board with the specified row filled
 *
 * @example
 * ```typescript
 * let board = createEmptyBoard();
 * board = fillBoardRow(board, 19); // Fill bottom row with 1s
 * board = fillBoardRow(board, 10, 3); // Fill row 10 with 3s
 * board = fillBoardRow(board, -1, 7); // Fill vanish zone row with 7s
 * ```
 */
export function fillBoardRow(board: Board, y: number, value = 1): Board {
  const newCells = createBoardCells();

  // Copy existing cells
  for (let i = 0; i < board.cells.length; i++) {
    newCells[i] = board.cells[i] ?? 0;
  }

  // Fill the specified row
  for (let x = 0; x < board.width; x++) {
    const index = idx(board, createGridCoord(x), createGridCoord(y));
    newCells[index] = value;
  }

  return { ...board, cells: newCells };
}

/**
 * Creates a PhysicsState for testing with optional overrides.
 * Provides non-zero defaults to test that physics state is properly reset.
 *
 * @param overrides - Partial physics state to override defaults
 * @returns Complete PhysicsState suitable for testing
 *
 * @example
 * ```typescript
 * const physics = createTestPhysics(); // Dirty defaults for reset testing
 * const cleanPhysics = createTestPhysics({
 *   gravityAccum32: toQ(0),
 *   lock: { deadlineTick: null, resetCount: 0 }
 * });
 * const softDropPhysics = createTestPhysics({ softDropOn: true });
 * ```
 */
export function createTestPhysics(
  overrides: Partial<PhysicsState> = {},
): PhysicsState {
  const baseLock = {
    deadlineTick: 100 as Tick, // Non-null default to test reset behavior
    resetCount: 5, // Non-zero default to test reset behavior
  };

  return {
    gravityAccum32: toQ(0.25), // Non-zero default to test reset behavior
    softDropOn: false,
    ...overrides,
    // Merge lock object after overrides to ensure proper nested merging
    lock: {
      ...baseLock,
      ...(overrides.lock ?? {}),
    },
  };
}

/**
 * Creates a board with multiple collision cells for complex test scenarios.
 *
 * @param collisions - Array of collision specifications
 * @returns New Board with collisions applied
 *
 * @example
 * ```typescript
 * const board = createBoardWithCollisions([
 *   { x: 4, y: 10, value: 1 },
 *   { x: 5, y: 10, value: 2 },
 *   { x: 4, y: 11, value: 3 }
 * ]);
 * ```
 */
export function createBoardWithCollisions(
  collisions: Array<{ x: number; y: number; value: number }>,
): Board {
  const board = createEmptyBoard();
  const cells = createBoardCells();

  // Copy original cells
  for (let i = 0; i < board.cells.length; i++) {
    cells[i] = board.cells[i] ?? 0;
  }

  // Apply collisions
  for (const collision of collisions) {
    const index = idx(
      board,
      createGridCoord(collision.x),
      createGridCoord(collision.y),
    );
    cells[index] = collision.value;
  }

  return { ...board, cells };
}

/**
 * Sets up a board with a horizontal floor at the specified Y level.
 * Useful for testing gravity, collision, and lock delay scenarios.
 *
 * @param floorY - Y coordinate of the floor
 * @param blockValue - Value to fill floor cells with (default: 1)
 * @returns New Board with floor created
 *
 * @example
 * ```typescript
 * const boardWithFloor = setupBoardWithFloor(15); // Floor at y=15
 * const coloredFloor = setupBoardWithFloor(10, 3); // Floor with value 3
 * ```
 */
export function setupBoardWithFloor(floorY: number, blockValue = 1): Board {
  return fillBoardRow(createEmptyBoard(), floorY, blockValue);
}

/**
 * Creates a board with a vertical wall on the left side (x=0).
 * Useful for testing wall kicks and boundary collision detection.
 *
 * @param height - Height of wall in rows (default: 20, full visible height)
 * @param startY - Starting Y coordinate for wall (default: 0)
 * @returns New Board with left wall created
 *
 * @example
 * ```typescript
 * const leftWallBoard = createBoardWithLeftWall();
 * const partialLeftWall = createBoardWithLeftWall(10, 5); // 10 rows starting at y=5
 * ```
 */
export function createBoardWithLeftWall(height = 20, startY = 0): Board {
  const board = createEmptyBoard();
  const newCells = createBoardCells();

  for (let i = 0; i < board.cells.length; i++) {
    newCells[i] = board.cells[i] ?? 0;
  }

  // Fill left wall (x=0)
  for (let y = startY; y < startY + height && y < 20; y++) {
    const index = idx(board, createGridCoord(0), createGridCoord(y));
    newCells[index] = 1;
  }

  return { ...board, cells: newCells };
}

/**
 * Creates a board with a vertical wall on the right side (x=9).
 * Useful for testing wall kicks and boundary collision detection.
 *
 * @param height - Height of wall in rows (default: 20, full visible height)
 * @param startY - Starting Y coordinate for wall (default: 0)
 * @returns New Board with right wall created
 *
 * @example
 * ```typescript
 * const rightWallBoard = createBoardWithRightWall();
 * const partialRightWall = createBoardWithRightWall(5, 15); // 5 rows starting at y=15
 * ```
 */
export function createBoardWithRightWall(height = 20, startY = 0): Board {
  const board = createEmptyBoard();
  const newCells = createBoardCells();

  for (let i = 0; i < board.cells.length; i++) {
    newCells[i] = board.cells[i] ?? 0;
  }

  // Fill right wall (x=9)
  for (let y = startY; y < startY + height && y < 20; y++) {
    const index = idx(board, createGridCoord(9), createGridCoord(y));
    newCells[index] = 1;
  }

  return { ...board, cells: newCells };
}

/**
 * Creates a test RNG with a predefined sequence of pieces.
 * Uses SequenceRng internally for predictable test behavior.
 *
 * @param pieces - Array of pieces to cycle through
 * @returns PieceRandomGenerator that cycles through the sequence
 *
 * @example
 * ```typescript
 * const rng = createTestRng(["T", "I", "O"]); // Will cycle T, I, O, T, I, O, ...
 * const fixedRng = createTestRng(["Z"]); // Will always return Z
 * ```
 */
export function createTestRng(pieces: Array<PieceId>): PieceRandomGenerator {
  return new SequenceRng(pieces);
}

/**
 * Creates a board with almost complete rows for testing line clearing.
 * By default creates a row with a single empty cell at the specified position.
 *
 * @param rows - Array of row numbers to make almost complete
 * @param emptyX - X position of the empty cell in each row (default: 5, middle)
 * @returns New Board with almost complete rows
 *
 * @example
 * ```typescript
 * const board = createAlmostFullBoard([18, 19]); // Bottom two rows almost full
 * const customBoard = createAlmostFullBoard([10], 0); // Row 10 missing left cell
 * ```
 */
export function createAlmostFullBoard(rows: Array<number>, emptyX = 5): Board {
  const board = createEmptyBoard();
  const newCells = createBoardCells();

  // Copy existing cells
  for (let i = 0; i < board.cells.length; i++) {
    newCells[i] = board.cells[i] ?? 0;
  }

  // Fill specified rows, leaving emptyX position empty
  for (const y of rows) {
    for (let x = 0; x < board.width; x++) {
      if (x !== emptyX) {
        const index = idx(board, createGridCoord(x), createGridCoord(y));
        newCells[index] = 1;
      }
    }
  }

  return { ...board, cells: newCells };
}

/**
 * Creates a board setup for testing top-out scenarios.
 * Fills the spawn area to force collision when spawning.
 *
 * @param fillVanishZone - Whether to fill vanish zone rows too (default: false)
 * @returns New Board configured to cause top-out
 *
 * @example
 * ```typescript
 * const topOutBoard = createTopOutBoard(); // Blocks visible spawn area only
 * const fullTopOut = createTopOutBoard(true); // Blocks vanish zone too
 * ```
 */
export function createTopOutBoard(fillVanishZone = false): Board {
  const board = createEmptyBoard();
  const newCells = createBoardCells();

  // Copy existing cells
  for (let i = 0; i < board.cells.length; i++) {
    newCells[i] = board.cells[i] ?? 0;
  }

  // Fill spawn area (top few rows) to cause collision
  const startY = fillVanishZone ? -3 : 0;
  const endY = 3; // Fill enough rows to block most spawn positions

  for (let y = startY; y <= endY; y++) {
    for (let x = 3; x <= 6; x++) {
      // Focus on center spawn area
      const index = idx(board, createGridCoord(x), createGridCoord(y));
      newCells[index] = 1;
    }
  }

  return { ...board, cells: newCells };
}

/**
 * Creates a command array for testing complex scenarios.
 *
 * @param commands - Commands to include in the array
 * @returns Array of commands for use with step()
 *
 * @example
 * ```typescript
 * const cmds = createCommandSequence("MoveLeft", "RotateCW", "HardDrop");
 * const result = step(state, cmds);
 * ```
 */
export function createCommandSequence(
  ...commands: Array<Command["kind"]>
): ReadonlyArray<Command> {
  return commands.map((kind) => ({ kind }) as Command);
}

/**
 * Creates a multi-tick command sequence for stepN() testing.
 *
 * @param tickCommands - Array where each element is the commands for that tick
 * @returns Command sequence suitable for stepN()
 *
 * @example
 * ```typescript
 * const sequence = createTickSequence(
 *   ["MoveLeft"],           // Tick 1: move left
 *   [],                     // Tick 2: no commands
 *   ["RotateCW", "HardDrop"] // Tick 3: rotate and drop
 * );
 * const result = stepN(state, sequence);
 * ```
 */
export function createTickSequence(
  ...tickCommands: Array<Array<Command["kind"]>>
): ReadonlyArray<ReadonlyArray<Command>> {
  return tickCommands.map((commands) => createCommandSequence(...commands));
}

/**
 * Validates that events appear in the expected phase order:
 * applyCommands → advancePhysics → resolveTransitions
 *
 * @param events - Events to validate
 * @param expectedPhases - Expected phase order for verification
 * @returns True if events are in correct order
 *
 * @example
 * ```typescript
 * const isOrdered = verifyEventPhaseOrder(events, [
 *   "applyCommands",    // MovedLeft, Rotated
 *   "advancePhysics",   // LockStarted, LockReset
 *   "resolveTransitions" // Locked, PieceSpawned
 * ]);
 * ```
 */
export function verifyEventPhaseOrder(
  events: ReadonlyArray<DomainEvent>,
  expectedPhases: Array<
    "advancePhysics" | "applyCommands" | "resolveTransitions"
  >,
): boolean {
  const phaseEvents = {
    advancePhysics: ["LockStarted", "LockReset"],
    applyCommands: [
      "MovedLeft",
      "MovedRight",
      "Rotated",
      "SoftDropToggled",
      "Held",
    ],
    resolveTransitions: ["Locked", "LinesCleared", "PieceSpawned", "TopOut"],
  } as const;

  let currentPhaseIndex = 0;

  for (const event of events) {
    // Find which phase this event belongs to
    let eventPhase: keyof typeof phaseEvents | null = null;
    for (const [phase, eventKinds] of Object.entries(phaseEvents)) {
      if ((eventKinds as ReadonlyArray<string>).includes(event.kind)) {
        eventPhase = phase as keyof typeof phaseEvents;
        break;
      }
    }

    if (eventPhase === null) continue; // Unknown event type, skip

    // Find the expected phase index for this event
    const expectedPhaseIndex = expectedPhases.findIndex(
      (p) => p === eventPhase,
    );
    if (expectedPhaseIndex === -1) continue; // Phase not in expected list

    // Ensure we haven't gone backwards in phases
    if (expectedPhaseIndex < currentPhaseIndex) {
      return false;
    }

    currentPhaseIndex = expectedPhaseIndex;
  }

  return true;
}

/**
 * Deep comparison of event sequences for determinism testing.
 * Compares all event properties except tick values (which may differ between runs).
 *
 * @param events1 - First event sequence
 * @param events2 - Second event sequence
 * @param ignoreTicks - Whether to ignore tick differences (default: true)
 * @returns True if sequences are equivalent
 *
 * @example
 * ```typescript
 * const run1 = stepN(state1, commands);
 * const run2 = stepN(state2, commands);
 * const isDeterministic = compareEventSequences(run1.events, run2.events);
 * ```
 */
export function compareEventSequences(
  events1: ReadonlyArray<DomainEvent>,
  events2: ReadonlyArray<DomainEvent>,
  ignoreTicks = true,
): boolean {
  if (events1.length !== events2.length) return false;

  for (let i = 0; i < events1.length; i++) {
    const e1 = events1[i];
    const e2 = events2[i];

    if (!e1 || !e2) return false;

    // Compare event properties excluding tick if requested
    const e1Clean = ignoreTicks ? { ...e1, tick: 0 as Tick } : e1;
    const e2Clean = ignoreTicks ? { ...e2, tick: 0 as Tick } : e2;

    if (JSON.stringify(e1Clean) !== JSON.stringify(e2Clean)) {
      return false;
    }
  }

  return true;
}

/**
 * Creates a game state ready for hard drop line clear testing.
 * Sets up a board with almost complete bottom rows and a T-piece positioned to clear them.
 *
 * @param lineCount - Number of lines to set up for clearing (default: 1)
 * @returns GameState configured for line clearing scenario
 *
 * @example
 * ```typescript
 * const state = createLineClearScenario(2); // Setup for double line clear
 * const result = step(state, [{ kind: "HardDrop" }]);
 * expect(findEvent(result.events, "LinesCleared")?.rows).toHaveLength(2);
 * ```
 */
export function createLineClearScenario(lineCount = 1): GameState {
  const config = createTestConfig({
    gravity32: toQ(0.1), // Slow gravity
    lockDelayTicks: 30 as TickDelta,
  });

  // Create board with almost complete rows at the bottom
  const rowsToFill = Array.from({ length: lineCount }, (_, i) => 19 - i);
  const board = createAlmostFullBoard(rowsToFill, 4); // Leave x=4 empty for T-piece

  const state = createTestGameState({
    board,
    cfg: config,
    piece: createTestPiece("T", 4, 17), // Position T-piece to fill the gap
  });

  return state;
}

/**
 * Helper to find events of a specific kind from an array of domain events.
 * Returns strongly-typed array of events matching the specified kind.
 *
 * @param events - Array of domain events to search through
 * @param kind - Specific event kind to filter by
 * @returns Array of events matching the kind with proper type narrowing
 *
 * @example
 * ```typescript
 * const spawnEvents = findEvents(result.events, "PieceSpawned");
 * const moveEvents = findEvents(result.events, "MovedLeft");
 * ```
 */
export function findEvents<K extends DomainEvent["kind"]>(
  events: ReadonlyArray<DomainEvent>,
  kind: K,
): Array<DomainEvent & { kind: K }> {
  return events.filter((e) => e.kind === kind) as Array<
    DomainEvent & { kind: K }
  >;
}

/**
 * Helper to find the first event of a specific kind from an array of domain events.
 * Returns the first matching event or undefined if none found.
 *
 * @param events - Array of domain events to search through
 * @param kind - Specific event kind to find
 * @returns First event matching the kind or undefined
 *
 * @example
 * ```typescript
 * const lockEvent = findEvent(result.events, "Locked");
 * const topOutEvent = findEvent(result.events, "TopOut");
 * ```
 */
export function findEvent<K extends DomainEvent["kind"]>(
  events: ReadonlyArray<DomainEvent>,
  kind: K,
): (DomainEvent & { kind: K }) | undefined {
  return findEvents(events, kind)[0];
}

/**
 * Group events by tick for easier intra-tick assertions.
 */
export function getEventsForTick(
  events: ReadonlyArray<DomainEvent>,
  tick: Tick,
): Array<DomainEvent> {
  return events.filter((e) => e.tick === tick);
}

/**
 * Returns the maximum tick present in an event sequence, or null if none.
 */
export function getLastTick(events: ReadonlyArray<DomainEvent>): Tick | null {
  if (events.length === 0) return null;
  const first = events[0];
  if (!first) return null;
  let max = first.tick;
  for (const e of events) {
    if (e.tick > max) max = e.tick;
  }
  return max;
}

/**
 * Events that occurred on the last tick in the sequence.
 */
export function getLastTickEvents(
  events: ReadonlyArray<DomainEvent>,
): Array<DomainEvent> {
  const last = getLastTick(events);
  return last === null ? [] : getEventsForTick(events, last);
}

/**
 * Assert event kinds appear in order within a specific tick (or the last tick if omitted).
 * Returns true if all kinds appear in the given order.
 */
export function assertEventKindsOrderWithinTick(
  events: ReadonlyArray<DomainEvent>,
  expectedKindsInOrder: ReadonlyArray<DomainEvent["kind"]>,
  tick?: Tick,
): boolean {
  const within =
    tick === undefined
      ? getLastTickEvents(events)
      : getEventsForTick(events, tick);
  let cursor = -1;
  for (const kind of expectedKindsInOrder) {
    const idx = within.findIndex((e, i) => i > cursor && e.kind === kind);
    if (idx === -1) return false;
    cursor = idx;
  }
  return true;
}

/**
 * Step the engine until a predicate over (events, nextState) returns true or a max tick budget is reached.
 * Useful for integration tests that need to "wait" for a lock, clear, or spawn without manual loops.
 */
export function stepUntil(
  state: GameState,
  commandProvider: (s: GameState, stepIndex: number) => ReadonlyArray<Command>,
  predicate: (
    events: ReadonlyArray<DomainEvent>,
    nextState: GameState,
  ) => boolean,
  maxTicks = 200,
): { state: GameState; events: Array<DomainEvent>; ticksRan: number } {
  let s = state;
  const all: Array<DomainEvent> = [];
  for (let i = 0; i < maxTicks; i++) {
    const cmds = commandProvider(s, i);
    const r = step(s, cmds);
    s = r.state;
    all.push(...r.events);
    if (predicate(r.events, r.state)) {
      return { events: all, state: s, ticksRan: i + 1 };
    }
  }
  return { events: all, state: s, ticksRan: maxTicks };
}

/**
 * Helper to create an engine scenario with predictable piece sequences.
 * Sets up a complete game state with controlled RNG for repeatable testing.
 *
 * @param pieces - Array of pieces to cycle through (default: ["T", "I", "O", "S"])
 * @returns Complete GameState configured for predictable testing
 *
 * @example
 * ```typescript
 * const state = createEngineScenario(["T", "I"]); // Will spawn T first, then I
 * const customState = createEngineScenario(["Z", "L", "J"]); // Custom sequence
 * ```
 */
export function createEngineScenario(
  pieces: Array<PieceId> = ["T", "I", "O", "S"],
): GameState {
  const config = createTestConfig({
    gravity32: toQ(0.1), // Slow gravity for controlled testing
    lockDelayTicks: 30 as TickDelta,
    maxLockResets: 15,
    previewCount: 7,
  });
  const rng = createTestRng(pieces);

  // Get the initial queue and updated RNG
  const queueResult = rng.getNextPieces(config.previewCount);

  const state = createTestGameState({
    cfg: config,
    piece: null, // Start with no piece to force spawn
    queue: queueResult.pieces,
    rng: queueResult.newRng,
  });
  return state;
}

/**
 * Gets the value of a cell on the board at the specified coordinates.
 * Supports both visible area and vanish zone coordinates.
 *
 * @param board - Board to read from
 * @param x - X coordinate
 * @param y - Y coordinate (supports vanish zone: y >= -3)
 * @returns Cell value at the specified position
 *
 * @example
 * ```typescript
 * const value = getCell(board, 4, 10); // Get cell value at (4, 10)
 * const vanishValue = getCell(board, 0, -1); // Get cell value in vanish zone
 * ```
 */
export function getCell(board: Board, x: number, y: number): number {
  const index = idx(board, createGridCoord(x), createGridCoord(y));
  return board.cells[index] ?? 0;
}
