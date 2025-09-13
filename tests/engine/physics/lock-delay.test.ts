// Scaffold tests for @/engine/physics/lock-delay.ts
// import { updateLock } from "@/engine/physics/lock-delay";

describe("@/engine/physics/lock-delay — deadlines & caps", () => {
  test.todo(
    "Starts lock when grounded; sets deadlineTick = now + cfg.lockDelayTicks; emits LockStarted once per ground-touch",
  );

  test.todo(
    "Extends deadline on eligible move/rotate while grounded until maxLockResets is reached",
  );

  test.todo(
    "Past maxLockResets, further eligible inputs do NOT extend deadline or emit LockReset",
  );

  test.todo(
    "At or after deadlineTick, lockNow=true; next ResolveTransitions should lock piece",
  );
});
