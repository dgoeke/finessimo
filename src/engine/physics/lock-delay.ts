import type { Tick, GameState } from "../types.js";

export function updateLock(
  state: GameState,
  tick: Tick,
  opts: { grounded: boolean; lockResetEligible: boolean },
): {
  state: GameState;
  started: boolean;
  reset: boolean;
  resetReason: "move" | "rotate" | undefined;
  lockNow: boolean;
} {
  let s = state;
  let started = false;
  let reset = false;
  let resetReason: "move" | "rotate" | undefined;
  let lockNow = false;

  const { lock } = s.physics;
  const cfg = s.cfg;

  if (!opts.grounded) {
    // Airborne—clear deadline
    if (lock.deadlineTick !== null) {
      s = {
        ...s,
        physics: { ...s.physics, lock: { deadlineTick: null, resetCount: 0 } },
      };
    }
    return { lockNow, reset, resetReason: undefined, started, state: s };
  }

  // Grounded
  if (lock.deadlineTick === null) {
    // Start lock
    // @ts-ignore arithmetic on branded Tick at boundary
    const deadline = (tick + cfg.lockDelayTicks) as Tick;
    s = {
      ...s,
      physics: {
        ...s.physics,
        lock: { deadlineTick: deadline, resetCount: 0 },
      },
    };
    started = true;
  } else {
    // Maybe reset
    if (
      opts.lockResetEligible &&
      s.physics.lock.resetCount < cfg.maxLockResets
    ) {
      // @ts-ignore arithmetic on branded Tick at boundary
      const deadline = (tick + cfg.lockDelayTicks) as Tick;
      s = {
        ...s,
        physics: {
          ...s.physics,
          lock: {
            deadlineTick: deadline,
            resetCount: s.physics.lock.resetCount + 1,
          },
        },
      };
      reset = true;
      resetReason = "move"; // TODO: differentiate rotate vs move in ApplyCommands flags if desired
    }
  }

  // Check deadline
  if (
    s.physics.lock.deadlineTick !== null &&
    tick >= s.physics.lock.deadlineTick
  ) {
    lockNow = true;
  }

  return { lockNow, reset, resetReason, started, state: s };
}
