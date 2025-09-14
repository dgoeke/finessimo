import { init, step, stepN } from "@/engine";
import { type Tick, type TickDelta } from "@/engine/types";
import { toQ } from "@/engine/utils/fixedpoint";
import { incrementTick } from "@/engine/utils/tick";

import {
  compareEventSequences,
  createAlmostFullBoard,
  createCommandSequence,
  createEngineScenario,
  createTestConfig,
  createTestGameState,
  createTestPiece,
  createTickSequence,
  findEvent,
  findEvents,
  verifyEventPhaseOrder,
} from "../test-helpers";

describe("@/engine/index — step pipeline", () => {
  describe("init()", () => {
    test("returns initial state at the given startTick and zero events", () => {
      const config = createTestConfig({ rngSeed: 42 });
      const startTick = 100 as Tick;

      const result = init(config, startTick);

      // Should return zero events
      expect(result.events).toEqual([]);

      // State should be properly initialized
      expect(result.state.tick).toBe(startTick);
      expect(result.state.cfg).toBe(config);
      expect(result.state.piece).toBeNull(); // No piece spawned yet
      expect(result.state.queue).toHaveLength(config.previewCount);
      expect(result.state.hold.piece).toBeNull();
      expect(result.state.hold.usedThisTurn).toBe(false);

      // Physics should be in initial state
      expect(result.state.physics.gravityAccum32).toBe(toQ(0));
      expect(result.state.physics.softDropOn).toBe(false);
      expect(result.state.physics.lock.deadlineTick).toBeNull();
      expect(result.state.physics.lock.resetCount).toBe(0);

      // Board should be empty
      expect(result.state.board.cells.every((cell) => cell === 0)).toBe(true);
    });
  });

  describe("step()", () => {
    test("with no commands, first call should spawn a piece (emits DomainEvent: PieceSpawned)", () => {
      const config = createTestConfig({ rngSeed: 123 });
      const initialState = init(config, 0 as Tick).state;

      const result = step(initialState, []);

      // Should emit PieceSpawned event
      const spawnEvent = findEvent(result.events, "PieceSpawned");
      expect(spawnEvent).toBeDefined();
      expect(spawnEvent?.tick).toBe(0); // Events use current tick, state is incremented after
      expect(spawnEvent?.pieceId).toBeDefined();

      // State should now have an active piece
      expect(result.state.piece).not.toBeNull();
      expect(result.state.piece?.id).toBe(spawnEvent?.pieceId);
    });

    test("increments state.tick by +1 on each call", () => {
      const state = createEngineScenario(["T", "I", "O"]);
      const startTick = state.tick;

      const result1 = step(state, []);
      expect(result1.state.tick).toBe(incrementTick(startTick));

      const result2 = step(result1.state, []);
      expect(result2.state.tick).toBe(incrementTick(incrementTick(startTick)));

      const result3 = step(result2.state, []);
      expect(result3.state.tick).toBe(
        incrementTick(incrementTick(incrementTick(startTick))),
      );
    });

    test("event order is applyCommands → advancePhysics → resolveTransitions (verify by scenario producing multiple events)", () => {
      // Create a scenario that will produce events from all three phases
      const config = createTestConfig({
        gravity32: toQ(1.0), // Fast gravity
        lockDelayTicks: 2 as TickDelta, // Short lock delay
        rngSeed: 456,
      });

      // Set up state with piece that can move and will lock soon
      const state = createTestGameState({
        cfg: config,
        physics: {
          gravityAccum32: toQ(0),
          lock: {
            deadlineTick: null, // No lock yet, will get grounded first
            resetCount: 0,
          },
          softDropOn: false,
        },
        piece: createTestPiece("T", 4, 5), // T-piece in middle area with room to move/rotate
      });

      // Execute commands to produce events from multiple phases
      const commands = createCommandSequence("MoveLeft", "SoftDropOn");
      const result = step(state, commands);

      // Verify we got events from multiple phases
      const moveEvents = findEvents(result.events, "MovedLeft");
      const softDropEvents = findEvents(result.events, "SoftDropToggled");

      expect(moveEvents.length + softDropEvents.length).toBeGreaterThan(0); // applyCommands phase

      // The test primarily verifies the sequence order, exact events depend on game state

      // Verify correct phase ordering
      const hasCorrectOrder = verifyEventPhaseOrder(result.events, [
        "applyCommands",
        "advancePhysics",
        "resolveTransitions",
      ]);
      expect(hasCorrectOrder).toBe(true);
    });

    test("hard drop emits Locked{source:'hardDrop'} on the same tick, then either LinesCleared and/or PieceSpawned", () => {
      // Create a board with an almost complete bottom row (missing cell at x=4)
      const board = createAlmostFullBoard([19], 4); // Row 19 almost full, missing x=4

      const state = createTestGameState({
        board,
        // I-piece in vertical 'right' rotation occupies x = topLeftX + 2; set topLeftX=2 to land at x=4
        piece: createTestPiece("I", 2, 16, "right"),
      });

      const commands = createCommandSequence("HardDrop");
      const result = step(state, commands);

      // Should emit Locked with hardDrop source
      const lockEvent = findEvent(result.events, "Locked");
      expect(lockEvent).toBeDefined();
      expect(lockEvent?.source).toBe("hardDrop");
      expect(lockEvent?.tick).toBe(0); // Events use current tick

      // Should emit LinesCleared
      const clearEvent = findEvent(result.events, "LinesCleared");
      expect(clearEvent).toBeDefined();
      expect(clearEvent?.rows).toHaveLength(1);
      expect(clearEvent?.rows[0]).toBe(19); // Bottom row cleared
      expect(clearEvent?.tick).toBe(0); // Events use current tick

      // Should spawn next piece
      const spawnEvent = findEvent(result.events, "PieceSpawned");
      expect(spawnEvent).toBeDefined();
      expect(spawnEvent?.tick).toBe(0); // Events use current tick

      // Verify event order: Locked → LinesCleared → PieceSpawned
      const eventOrder = result.events.map((e) => e.kind);
      const lockIndex = eventOrder.indexOf("Locked");
      const clearIndex = eventOrder.indexOf("LinesCleared");
      const spawnIndex = eventOrder.indexOf("PieceSpawned");

      expect(lockIndex).toBeLessThan(clearIndex);
      expect(clearIndex).toBeLessThan(spawnIndex);
    });
  });

  describe("stepN()", () => {
    test("deterministic sequence for a fixed seed and fixed per-tick command buckets (replay the same inputs twice and compare events)", () => {
      const config = createTestConfig({
        gravity32: toQ(0.5),
        lockDelayTicks: 30 as TickDelta,
        rngSeed: 789, // Fixed seed for determinism
      });

      // Create identical initial states
      const state1 = init(config, 0 as Tick).state;
      const state2 = init(config, 0 as Tick).state;

      // Define a complex command sequence
      const commandSequence = createTickSequence(
        [], // Tick 1: spawn piece (no commands)
        ["MoveLeft"], // Tick 2: move left
        ["MoveRight"], // Tick 3: move right (skip rotation to avoid space issues)
        ["MoveRight", "MoveRight"], // Tick 4: move right twice
        ["SoftDropOn"], // Tick 5: start soft drop
        [], // Tick 6: just gravity
        [], // Tick 7: just gravity
        ["SoftDropOff"], // Tick 8: stop soft drop
        ["HardDrop"], // Tick 9: hard drop to lock
      );

      // Run the same sequence on both states
      const result1 = stepN(state1, commandSequence);
      const result2 = stepN(state2, commandSequence);

      // Results should be deterministic (same events ignoring tick values)
      expect(compareEventSequences(result1.events, result2.events, true)).toBe(
        true,
      );

      // States should be identical (ignoring tick)
      const state1Clean = { ...result1.state, tick: 0 as Tick };
      const state2Clean = { ...result2.state, tick: 0 as Tick };
      expect(state1Clean).toEqual(state2Clean);

      // Verify we got a rich sequence of events
      expect(result1.events.length).toBeGreaterThan(5); // Should have multiple events

      // Verify expected event types appeared
      const eventKinds = result1.events.map((e) => e.kind);
      expect(eventKinds).toContain("PieceSpawned");
      expect(eventKinds).toContain("MovedLeft");
      expect(eventKinds).toContain("MovedRight");
      expect(eventKinds).toContain("SoftDropToggled");
      expect(eventKinds).toContain("Locked");
    });
  });
});
