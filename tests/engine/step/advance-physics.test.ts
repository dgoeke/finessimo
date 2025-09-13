// Scaffold tests for @/engine/step/advance-physics.ts
// import { advancePhysics } from "@/engine/step/advance-physics";

describe("@/engine/step/advance-physics — gravity and lock-delay", () => {
  test.todo(
    "gravityStep: accumulates Q16.16 gravity; floorQ(accum) cells moved, fracQ(accum) stored for next tick",
  );

  test.todo(
    "gravityStep: with softDropOn=true, use cfg.softDrop32 (or multiplier once implemented); piece descends faster",
  );

  test.todo(
    "updateLock: when piece grounded and no deadline set, start lock (emit LockStarted) with deadlineTick = now + cfg.lockDelayTicks",
  );

  test.todo(
    "updateLock: lock resets extend deadline and increment resetCount only while resetCount < maxLockResets",
  );

  test.todo(
    "updateLock: when tick >= deadlineTick, lockNow=true (unless already hardDropped), emit no reset",
  );

  test.todo(
    "hardDropped side-effect: forces lockNow=true regardless of deadline state; do not extend deadline on that tick",
  );
});
