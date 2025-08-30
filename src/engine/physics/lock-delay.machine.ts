import { type Timestamp, asNumber } from "../../types/timestamp";

import type { LockDelayState } from "../../state/types";

export function Airborne(resets = 0): LockDelayState {
  return { resets, tag: "Airborne" };
}

export function Grounded(start: Timestamp, resets = 0): LockDelayState {
  return { resets, start, tag: "Grounded" };
}

export function isGrounded(
  ld: LockDelayState,
): ld is Extract<LockDelayState, { tag: "Grounded" }> {
  return ld.tag === "Grounded";
}

export function startLockDelay(
  _ld: LockDelayState,
  ts: Timestamp,
): LockDelayState {
  // Always start fresh - this maintains reset count behavior across airborne transitions
  return Grounded(ts, 0);
}

export function resetLockDelay(
  _ld: LockDelayState,
  ts: Timestamp,
  prevResets: number,
): LockDelayState {
  return Grounded(ts, prevResets + 1);
}

export function cancelLockDelay(ld: LockDelayState): LockDelayState {
  return Airborne(ld.resets);
}

export function stepLockDelay(params: {
  delayMs: number;
  grounded: boolean;
  ld: LockDelayState;
  maxResets: number;
  movedWhileGrounded: boolean;
  ts: Timestamp;
}): { ld: LockDelayState; lockNow: boolean } {
  const { delayMs, grounded, ld, maxResets, movedWhileGrounded, ts } = params;

  if (!grounded) {
    // any off-ground state cancels delay but preserves reset count
    return { ld: Airborne(ld.resets), lockNow: false };
  }

  if (ld.tag === "Airborne") {
    // resuming contact starts delay with preserved resets
    return { ld: Grounded(ts, ld.resets), lockNow: false };
  }

  // grounded state - ld.tag === "Grounded" guaranteed
  const groundedState: LockDelayState = ld;

  if (groundedState.resets >= maxResets) {
    return { ld, lockNow: true };
  }

  if (movedWhileGrounded) {
    return { ld: Grounded(ts, groundedState.resets + 1), lockNow: false };
  }

  const elapsed = asNumber(ts) - asNumber(groundedState.start);
  if (elapsed >= delayMs) {
    return { ld, lockNow: true };
  }

  return { ld, lockNow: false };
}
