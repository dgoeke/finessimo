import { addTicks, isTickAfterOrEqual } from "../utils/tick";

import type { Tick, GameState } from "../types";

type LockUpdateOptions = {
  grounded: boolean;
  lockResetEligible: boolean;
  lockResetReason?: "move" | "rotate" | undefined;
};

export function updateLock(
  state: GameState,
  tick: Tick,
  opts: LockUpdateOptions,
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
    // Airborne—clear deadline but preserve resetCount
    if (lock.deadlineTick !== null) {
      s = {
        ...s,
        physics: {
          ...s.physics,
          lock: { deadlineTick: null, resetCount: lock.resetCount },
        },
      };
    }
    return { lockNow, reset, resetReason: undefined, started, state: s };
  }

  // Grounded
  if (lock.deadlineTick === null) {
    // Start lock
    const deadline = addTicks(tick, cfg.lockDelayTicks);
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
      const deadline = addTicks(tick, cfg.lockDelayTicks);
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
      resetReason = opts.lockResetReason;
    }
  }

  // Check deadline
  if (
    s.physics.lock.deadlineTick !== null &&
    isTickAfterOrEqual(tick, s.physics.lock.deadlineTick)
  ) {
    lockNow = true;
  }

  return { lockNow, reset, resetReason, started, state: s };
}
