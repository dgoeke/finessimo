import { createGridCoord } from "@/engine/core/types";
import { advancePhysics } from "@/engine/step/advance-physics";
import { toQ } from "@/engine/utils/fixedpoint";
import { asTick, asTickDelta, addTicks } from "@/engine/utils/tick";

import {
  createTestGameState,
  createTestPiece,
  setupBoardWithFloor,
  createTestConfig,
} from "../../test-helpers";

import type { CommandSideEffects } from "@/engine/step/apply-commands";

describe("@/engine/step/advance-physics — gravity and lock-delay", () => {
  test("gravityStep: accumulates Q16.16 gravity; floorQ(accum) cells moved, fracQ(accum) stored for next tick", () => {
    // Test with gravity32 = 0.5 (Q16.16): should accumulate over 2 ticks
    const piece = createTestPiece("T", 4, 0);
    const state = createTestGameState(
      { piece },
      toQ(0.5), // 0.5 cells per tick
    );

    // Create no-op command side effects
    const cmdFx: CommandSideEffects = {
      hardDropped: false,
      lockResetEligible: false,
    };

    // First tick: accumulator = 0.5, no movement yet
    const result1 = advancePhysics(state, cmdFx);
    const state1 = result1.state;

    expect(state1.piece).toBeTruthy();
    expect(state1.piece?.y).toBe(createGridCoord(0)); // Still at y=0
    expect(state1.physics.gravityAccum32).toBe(toQ(0.5)); // Fractional remainder stored

    // Second tick: accumulator = 0.5 + 0.5 = 1.0, piece moves down 1 cell
    const result2 = advancePhysics(state1, cmdFx);
    const state2 = result2.state;

    expect(state2.piece).toBeTruthy();
    expect(state2.piece?.y).toBe(createGridCoord(1)); // Moved to y=1
    expect(state2.physics.gravityAccum32).toBe(toQ(0.0)); // Accumulator reset to 0
    expect(state2.piece?.x).toBe(createGridCoord(4)); // X position unchanged
    expect(state2.piece?.id).toBe("T"); // Piece type unchanged
  });

  test("gravityStep: with softDropOn=true, use cfg.softDrop32 (or multiplier once implemented); piece descends faster", () => {
    const piece = createTestPiece("T", 4, 0);
    const cfg = createTestConfig({
      gravity32: toQ(0.5), // Normal gravity: 0.5 cells per tick
      softDrop32: toQ(2.0), // Soft drop: 2.0 cells per tick
    });

    // State with soft drop ON
    const stateWithSoftDrop = createTestGameState({
      cfg,
      physics: {
        gravityAccum32: toQ(0),
        lock: { deadlineTick: null, resetCount: 0 },
        softDropOn: true,
      },
      piece,
    });

    const cmdFx: CommandSideEffects = {
      hardDropped: false,
      lockResetEligible: false,
    };

    // With soft drop on, should move 2 cells in one tick
    const result = advancePhysics(stateWithSoftDrop, cmdFx);
    const finalState = result.state;

    expect(finalState.piece).toBeTruthy();
    expect(finalState.piece?.y).toBe(createGridCoord(2)); // Moved down 2 cells
    expect(finalState.physics.gravityAccum32).toBe(toQ(0)); // No remainder

    // Compare with soft drop OFF
    const stateWithoutSoftDrop = createTestGameState({
      cfg,
      physics: {
        gravityAccum32: toQ(0),
        lock: { deadlineTick: null, resetCount: 0 },
        softDropOn: false,
      },
      piece,
    });

    const resultWithoutSoftDrop = advancePhysics(stateWithoutSoftDrop, cmdFx);

    expect(resultWithoutSoftDrop.state.piece).toBeTruthy();
    expect(resultWithoutSoftDrop.state.piece?.y).toBe(createGridCoord(0)); // No movement with normal gravity
    expect(resultWithoutSoftDrop.state.physics.gravityAccum32).toBe(toQ(0.5)); // 0.5 remainder
  });

  test("updateLock: when piece grounded and no deadline set, start lock (emit LockStarted) with deadlineTick = now + cfg.lockDelayTicks", () => {
    const currentTick = asTick(100);
    const lockDelayTicks = asTickDelta(30);
    const expectedDeadline = addTicks(currentTick, lockDelayTicks);

    // Piece at bottom (grounded)
    const piece = createTestPiece("T", 4, 17); // Position above floor
    const state = createTestGameState({
      board: setupBoardWithFloor(19), // Floor at y=19
      cfg: createTestConfig({ lockDelayTicks }),
      physics: {
        gravityAccum32: toQ(0),
        lock: { deadlineTick: null, resetCount: 0 }, // No deadline set
        softDropOn: false,
      },
      piece,
      tick: currentTick,
    });

    const cmdFx: CommandSideEffects = {
      hardDropped: false,
      lockResetEligible: false,
    };

    const result = advancePhysics(state, cmdFx);

    // Should emit LockStarted event
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      kind: "LockStarted",
      tick: currentTick,
    });

    // Should set deadline in physics state
    expect(result.state.physics.lock.deadlineTick).toBe(expectedDeadline);
    expect(result.state.physics.lock.resetCount).toBe(0);
    expect(result.sideEffects.lockNow).toBe(false); // Not yet at deadline
  });

  test("updateLock: lock resets extend deadline and increment resetCount only while resetCount < maxLockResets", () => {
    const currentTick = asTick(100);
    const lockDelayTicks = asTickDelta(30);
    const maxLockResets = 2; // Low limit for easier testing
    const oldDeadline = asTick(90); // Past deadline for reset testing

    const piece = createTestPiece("T", 4, 17);
    const baseState = createTestGameState({
      board: setupBoardWithFloor(19),
      cfg: createTestConfig({ lockDelayTicks, maxLockResets }),
      physics: {
        gravityAccum32: toQ(0),
        lock: { deadlineTick: oldDeadline, resetCount: 0 },
        softDropOn: false,
      },
      piece,
      tick: currentTick,
    });

    // Test 1: First reset (should succeed)
    const cmdFx1: CommandSideEffects = {
      hardDropped: false,
      lockResetEligible: true,
      lockResetReason: "move",
    };

    const result1 = advancePhysics(baseState, cmdFx1);

    expect(result1.events).toHaveLength(1);
    expect(result1.events[0]).toEqual({
      kind: "LockReset",
      reason: "move",
      tick: currentTick,
    });
    expect(result1.state.physics.lock.resetCount).toBe(1);
    expect(result1.state.physics.lock.deadlineTick).toBe(
      addTicks(currentTick, lockDelayTicks),
    );

    // Test 2: Second reset (should succeed)
    const stateAfterFirstReset = {
      ...result1.state,
      physics: {
        ...result1.state.physics,
        lock: { deadlineTick: oldDeadline, resetCount: 1 },
      },
    };

    const cmdFx2: CommandSideEffects = {
      hardDropped: false,
      lockResetEligible: true,
      lockResetReason: "rotate",
    };

    const result2 = advancePhysics(stateAfterFirstReset, cmdFx2);

    expect(result2.events).toHaveLength(1);
    expect(result2.events[0]).toEqual({
      kind: "LockReset",
      reason: "rotate",
      tick: currentTick,
    });
    expect(result2.state.physics.lock.resetCount).toBe(2);

    // Test 3: Third reset attempt (should fail - at maxLockResets)
    const stateAfterSecondReset = {
      ...result2.state,
      physics: {
        ...result2.state.physics,
        lock: { deadlineTick: oldDeadline, resetCount: 2 },
      },
    };

    const result3 = advancePhysics(stateAfterSecondReset, cmdFx2);

    expect(result3.events).toHaveLength(0); // No reset event
    expect(result3.state.physics.lock.resetCount).toBe(2); // Unchanged
    expect(result3.state.physics.lock.deadlineTick).toBe(oldDeadline); // Unchanged
  });

  test("updateLock: when tick >= deadlineTick, lockNow=true (unless already hardDropped), emit no reset", () => {
    const currentTick = asTick(120);
    const deadlineTick = asTick(100); // Past deadline

    const piece = createTestPiece("T", 4, 17);
    const maxLockResets = 15; // Use default max resets
    const state = createTestGameState({
      board: setupBoardWithFloor(19),
      cfg: createTestConfig({ maxLockResets }),
      physics: {
        gravityAccum32: toQ(0),
        lock: { deadlineTick, resetCount: maxLockResets }, // At max resets - no more resets allowed
        softDropOn: false,
      },
      piece,
      tick: currentTick,
    });

    const cmdFx: CommandSideEffects = {
      hardDropped: false,
      lockResetEligible: true, // Even if eligible, should not reset at max resets
      lockResetReason: "move",
    };

    const result = advancePhysics(state, cmdFx);

    // Should set lockNow=true
    expect(result.sideEffects.lockNow).toBe(true);

    // Should not emit any events (no reset or lock start)
    expect(result.events).toHaveLength(0);

    // State should remain unchanged (no reset performed)
    expect(result.state.physics.lock.deadlineTick).toBe(deadlineTick);
    expect(result.state.physics.lock.resetCount).toBe(maxLockResets);
  });

  test("hardDropped side-effect: forces lockNow=true regardless of deadline state; bypasses lock delay system", () => {
    const currentTick = asTick(50);
    const futurDeadline = asTick(200); // Far in the future

    const piece = createTestPiece("T", 4, 17);
    const state = createTestGameState({
      board: setupBoardWithFloor(19),
      physics: {
        gravityAccum32: toQ(0),
        lock: { deadlineTick: futurDeadline, resetCount: 3 },
        softDropOn: false,
      },
      piece,
      tick: currentTick,
    });

    const cmdFx: CommandSideEffects = {
      hardDropped: true, // Force immediate lock
      lockResetEligible: true, // Should be ignored - hard drop bypasses lock delay
      lockResetReason: "move",
    };

    const result = advancePhysics(state, cmdFx);

    // Should force lockNow=true and bypass lock delay system
    expect(result.sideEffects.lockNow).toBe(true);
    expect(result.sideEffects.hardDropped).toBe(true);

    // Should NOT emit any events - hard drop bypasses lock delay entirely
    expect(result.events).toHaveLength(0);

    // State should remain unchanged - no lock delay processing occurred
    expect(result.state.physics.lock.deadlineTick).toBe(futurDeadline);
    expect(result.state.physics.lock.resetCount).toBe(3);
  });

  test("hardDropped from airborne state emits LockStarted before immediate lock", () => {
    const currentTick = asTick(50);
    const piece = createTestPiece("T", 4, 17);

    // Piece grounded but no lock deadline (was airborne)
    const stateNoDeadline = createTestGameState({
      board: setupBoardWithFloor(19),
      physics: {
        gravityAccum32: toQ(0),
        lock: { deadlineTick: null, resetCount: 0 },
        softDropOn: false,
      },
      piece,
      tick: currentTick,
    });

    const cmdFx: CommandSideEffects = {
      hardDropped: true,
      lockResetEligible: false,
    };

    const result = advancePhysics(stateNoDeadline, cmdFx);

    // Should emit LockStarted for airborne->grounded transition
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      kind: "LockStarted",
      tick: currentTick,
    });

    // Should still force immediate lock
    expect(result.sideEffects.lockNow).toBe(true);
    expect(result.sideEffects.hardDropped).toBe(true);

    // State should remain unchanged (no deadline set by updateLock)
    expect(result.state.physics.lock.deadlineTick).toBe(null);
    expect(result.state.physics.lock.resetCount).toBe(0);
  });

  // Integration test: verify command side effects are properly forwarded
  test("forwards spawnOverride from command side effects", () => {
    const state = createTestGameState({
      piece: createTestPiece("T", 4, 10),
    });

    const cmdFx: CommandSideEffects = {
      hardDropped: false,
      lockResetEligible: false,
      spawnOverride: "I", // Should be forwarded to physics side effects
    };

    const result = advancePhysics(state, cmdFx);

    expect(result.sideEffects.spawnOverride).toBe("I");
  });

  test("forwards spawnOverride from command side effects with hard drop", () => {
    const state = createTestGameState({
      board: setupBoardWithFloor(19),
      piece: createTestPiece("T", 4, 17),
    });

    const cmdFx: CommandSideEffects = {
      hardDropped: true,
      lockResetEligible: false,
      spawnOverride: "L", // Should be forwarded even with hard drop
    };

    const result = advancePhysics(state, cmdFx);

    expect(result.sideEffects.spawnOverride).toBe("L");
    expect(result.sideEffects.hardDropped).toBe(true);
    expect(result.sideEffects.lockNow).toBe(true);
  });

  test("no side effects when piece is airborne", () => {
    const state = createTestGameState({
      physics: {
        gravityAccum32: toQ(0),
        lock: { deadlineTick: asTick(100), resetCount: 2 }, // Had lock deadline
        softDropOn: false,
      },
      piece: createTestPiece("T", 4, 5), // Floating piece
    });

    const cmdFx: CommandSideEffects = {
      hardDropped: false,
      lockResetEligible: true,
      lockResetReason: "move",
    };

    const result = advancePhysics(state, cmdFx);

    // When airborne, deadline should be cleared but resetCount preserved
    expect(result.state.physics.lock.deadlineTick).toBe(null);
    expect(result.state.physics.lock.resetCount).toBe(2);

    // No events should be emitted
    expect(result.events).toHaveLength(0);

    // lockNow should be false
    expect(result.sideEffects.lockNow).toBe(false);
  });
});
