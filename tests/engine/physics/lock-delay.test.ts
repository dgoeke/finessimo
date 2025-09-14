// Tests for @/engine/physics/lock-delay.ts — Lock timing mechanics
import { updateLock } from "@/engine/physics/lock-delay";
import {
  mkInitialState,
  type GameState,
  type EngineConfig,
  type Tick,
  type TickDelta,
  type PhysicsState,
  type Q16_16,
} from "@/engine/types";
import { toQ } from "@/engine/utils/fixedpoint";
import { addTicks } from "@/engine/utils/tick";

// Test helper functions
function createTestConfig(
  lockDelayTicks: TickDelta = 30 as TickDelta,
  maxLockResets = 15,
): EngineConfig {
  return {
    gravity32: toQ(0.5),
    height: 20,
    lockDelayTicks,
    maxLockResets,
    previewCount: 7,
    rngSeed: 12345,
    width: 10,
  };
}

function createTestGameState(
  overrides: Partial<GameState> = {},
  lockDelayTicks: TickDelta = 30 as TickDelta,
  maxLockResets = 15,
): GameState {
  const cfg = createTestConfig(lockDelayTicks, maxLockResets);
  const baseState = mkInitialState(cfg, 0 as Tick);

  return {
    ...baseState,
    ...overrides,
    physics: { ...baseState.physics, ...overrides.physics },
  };
}

function createPhysicsState(
  gravityAccum32: Q16_16 = toQ(0.0),
  softDropOn = false,
  deadlineTick: Tick | null = null,
  resetCount = 0,
): PhysicsState {
  return {
    gravityAccum32,
    lock: {
      deadlineTick,
      resetCount,
    },
    softDropOn,
  };
}

describe("@/engine/physics/lock-delay — deadlines & caps", () => {
  test("Starts lock when grounded; sets deadlineTick = now + cfg.lockDelayTicks; emits LockStarted once per ground-touch", () => {
    const lockDelay = 30 as TickDelta;
    const currentTick = 100 as Tick;
    const expectedDeadline = addTicks(currentTick, lockDelay);

    // Create state with no active deadline
    const state = createTestGameState(
      {
        physics: createPhysicsState(toQ(0), false, null, 0), // No deadline
        tick: currentTick,
      },
      lockDelay,
    );

    // First ground contact should start lock
    const result = updateLock(state, currentTick, {
      grounded: true,
      lockResetEligible: false,
    });

    // Should start lock and set deadline
    expect(result.started).toBe(true);
    expect(result.reset).toBe(false);
    expect(result.resetReason).toBeUndefined();
    expect(result.lockNow).toBe(false);
    expect(result.state.physics.lock.deadlineTick).toBe(expectedDeadline);
    expect(result.state.physics.lock.resetCount).toBe(0);
  });

  test("Does not start lock when airborne; clears existing deadline but preserves resetCount", () => {
    const currentTick = 100 as Tick;
    const existingDeadline = 150 as Tick;
    const existingResetCount = 3;

    // Create state with existing deadline and reset count
    const state = createTestGameState({
      physics: createPhysicsState(
        toQ(0),
        false,
        existingDeadline,
        existingResetCount,
      ),
      tick: currentTick,
    });

    // Airborne should clear deadline but preserve resetCount
    const result = updateLock(state, currentTick, {
      grounded: false,
      lockResetEligible: false,
    });

    expect(result.started).toBe(false);
    expect(result.reset).toBe(false);
    expect(result.resetReason).toBeUndefined();
    expect(result.lockNow).toBe(false);
    expect(result.state.physics.lock.deadlineTick).toBeNull();
    expect(result.state.physics.lock.resetCount).toBe(existingResetCount); // Preserved
  });

  test("Extends deadline on eligible move/rotate while grounded until maxLockResets is reached", () => {
    const lockDelay = 30 as TickDelta;
    const maxResets = 3;
    const currentTick = 100 as Tick;
    const initialDeadline = 120 as Tick;
    const expectedNewDeadline = addTicks(currentTick, lockDelay);

    // Create state with existing deadline and resetCount below limit
    const state = createTestGameState(
      {
        physics: createPhysicsState(
          toQ(0),
          false,
          initialDeadline,
          2, // Below maxResets
        ),
        tick: currentTick,
      },
      lockDelay,
      maxResets,
    );

    // Test move reset
    const moveResult = updateLock(state, currentTick, {
      grounded: true,
      lockResetEligible: true,
      lockResetReason: "move",
    });

    expect(moveResult.started).toBe(false);
    expect(moveResult.reset).toBe(true);
    expect(moveResult.resetReason).toBe("move");
    expect(moveResult.lockNow).toBe(false);
    expect(moveResult.state.physics.lock.deadlineTick).toBe(
      expectedNewDeadline,
    );
    expect(moveResult.state.physics.lock.resetCount).toBe(3);

    // Test rotate reset with the updated state
    const rotateResult = updateLock(moveResult.state, currentTick, {
      grounded: true,
      lockResetEligible: true,
      lockResetReason: "rotate",
    });

    // Should not reset when at maxResets
    expect(rotateResult.started).toBe(false);
    expect(rotateResult.reset).toBe(false);
    expect(rotateResult.resetReason).toBeUndefined();
    expect(rotateResult.lockNow).toBe(false);
    expect(rotateResult.state.physics.lock.deadlineTick).toBe(
      expectedNewDeadline,
    ); // Unchanged
    expect(rotateResult.state.physics.lock.resetCount).toBe(3); // Unchanged
  });

  test("Past maxLockResets, further eligible inputs do NOT extend deadline or emit LockReset", () => {
    const lockDelay = 30 as TickDelta;
    const maxResets = 2;
    const currentTick = 100 as Tick;
    const existingDeadline = 120 as Tick;

    // Create state with resetCount at maxResets
    const state = createTestGameState(
      {
        physics: createPhysicsState(
          toQ(0),
          false,
          existingDeadline,
          maxResets, // At maximum
        ),
        tick: currentTick,
      },
      lockDelay,
      maxResets,
    );

    // Try to reset when already at max
    const result = updateLock(state, currentTick, {
      grounded: true,
      lockResetEligible: true,
      lockResetReason: "move",
    });

    // Should not reset
    expect(result.started).toBe(false);
    expect(result.reset).toBe(false);
    expect(result.resetReason).toBeUndefined();
    expect(result.lockNow).toBe(false);
    expect(result.state.physics.lock.deadlineTick).toBe(existingDeadline); // Unchanged
    expect(result.state.physics.lock.resetCount).toBe(maxResets); // Unchanged
  });

  test("At or after deadlineTick, lockNow=true; next ResolveTransitions should lock piece", () => {
    const currentTick = 100 as Tick;
    const deadlineTick = 90 as Tick; // In the past

    // Create state with deadline in the past
    const state = createTestGameState({
      physics: createPhysicsState(toQ(0), false, deadlineTick, 5),
      tick: currentTick,
    });

    const result = updateLock(state, currentTick, {
      grounded: true,
      lockResetEligible: false,
    });

    // Should trigger lock
    expect(result.started).toBe(false);
    expect(result.reset).toBe(false);
    expect(result.resetReason).toBeUndefined();
    expect(result.lockNow).toBe(true);
    expect(result.state.physics.lock.deadlineTick).toBe(deadlineTick);
    expect(result.state.physics.lock.resetCount).toBe(5);
  });

  test("Exactly at deadline tick triggers lockNow", () => {
    const currentTick = 100 as Tick;
    const deadlineTick = 100 as Tick; // Exactly at deadline

    const state = createTestGameState({
      physics: createPhysicsState(toQ(0), false, deadlineTick, 0),
      tick: currentTick,
    });

    const result = updateLock(state, currentTick, {
      grounded: true,
      lockResetEligible: false,
    });

    expect(result.lockNow).toBe(true);
  });

  test("Before deadline tick does not trigger lockNow", () => {
    const currentTick = 100 as Tick;
    const deadlineTick = 101 as Tick; // In the future

    const state = createTestGameState({
      physics: createPhysicsState(toQ(0), false, deadlineTick, 0),
      tick: currentTick,
    });

    const result = updateLock(state, currentTick, {
      grounded: true,
      lockResetEligible: false,
    });

    expect(result.lockNow).toBe(false);
  });

  test("Reset without lockResetEligible does not extend deadline", () => {
    const lockDelay = 30 as TickDelta;
    const currentTick = 100 as Tick;
    const existingDeadline = 120 as Tick;

    const state = createTestGameState(
      {
        physics: createPhysicsState(toQ(0), false, existingDeadline, 0),
        tick: currentTick,
      },
      lockDelay,
    );

    // Not eligible for reset
    const result = updateLock(state, currentTick, {
      grounded: true,
      lockResetEligible: false,
      lockResetReason: "move",
    });

    expect(result.started).toBe(false);
    expect(result.reset).toBe(false);
    expect(result.resetReason).toBeUndefined();
    expect(result.state.physics.lock.deadlineTick).toBe(existingDeadline); // Unchanged
    expect(result.state.physics.lock.resetCount).toBe(0); // Unchanged
  });

  test("Airborne piece with no existing deadline leaves state unchanged", () => {
    const currentTick = 100 as Tick;
    const resetCount = 5;

    // Create state with no deadline (null) but some reset count
    const state = createTestGameState({
      physics: createPhysicsState(toQ(0), false, null, resetCount),
      tick: currentTick,
    });

    // Airborne with no deadline should be no-op
    const result = updateLock(state, currentTick, {
      grounded: false,
      lockResetEligible: false,
    });

    expect(result.started).toBe(false);
    expect(result.reset).toBe(false);
    expect(result.resetReason).toBeUndefined();
    expect(result.lockNow).toBe(false);
    expect(result.state.physics.lock.deadlineTick).toBeNull(); // Still null
    expect(result.state.physics.lock.resetCount).toBe(resetCount); // Unchanged
    expect(result.state).toBe(state); // Exact same state object (no mutation)
  });
});
