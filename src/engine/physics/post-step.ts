import { isAtBottom } from "../../core/board";
import { durationMsAsNumber } from "../../types/brands";
import { createPendingLock } from "../lock-utils";

import { stepLockDelay, Airborne } from "./lock-delay.machine";

import type {
  GameState,
  Action,
  ActivePiece,
  LockSource,
} from "../../state/types";
import type { Timestamp } from "../../types/timestamp";

// Lock-delay resets only when the piece actually changes position/rotation.
// Avoid spurious resets from no-op actions or redundant renders.
function pieceChanged(
  prev: ActivePiece | undefined,
  next: ActivePiece | undefined,
): boolean {
  if (!prev || !next) return prev !== next;
  return prev.x !== next.x || prev.y !== next.y || prev.rot !== next.rot;
}

// Only movement-like inputs can reset lock delay while grounded.
function canActionResetLockDelay(actionType: Action["type"]): boolean {
  return ["TapMove", "HoldMove", "RepeatMove", "Rotate", "SoftDrop"].includes(
    actionType,
  );
}

// Actions that may start lock delay upon first ground contact.
// Includes gravity landings via Tick and Spawn/Hold transitions that place a piece.
function canActionStartLockDelay(actionType: Action["type"]): boolean {
  return [
    "TapMove",
    "HoldMove",
    "RepeatMove",
    "Rotate",
    "SoftDrop",
    "Spawn",
    "Hold",
    "RetryPendingLock",
    "Tick", // Gravity landing can initiate LD even without direct input
  ].includes(actionType);
}

// Soft drop only resets LD if it actually advanced the piece downward.
function isSoftDropResetValid(
  action: Action,
  previousState: GameState,
  newState: GameState,
): boolean {
  if (action.type !== "SoftDrop" || !action.on || !newState.active) return true;
  return newState.active.y > (previousState.active?.y ?? 0);
}

// Only timestamped actions may advance the LD machine to keep timing deterministic.
// Some actions (e.g., Spawn/Hold) can be dispatched without timestamps; ignore them for LD.
function shouldProcessLockDelay(
  action: Action,
  newState: GameState,
): { shouldProcess: boolean; timestamp: Timestamp | null } {
  if (!canActionStartLockDelay(action.type) || !newState.active) {
    return { shouldProcess: false, timestamp: null };
  }

  const timestamp = "timestampMs" in action ? action.timestampMs : null;
  if (!timestamp && action.type !== "Hold" && action.type !== "Spawn") {
    return { shouldProcess: false, timestamp: null };
  }
  if (!timestamp) {
    return { shouldProcess: false, timestamp: null };
  }

  return { shouldProcess: true, timestamp };
}

// Skip stepping the LD machine when nothing changed; Tick is the exception
// because it drives timeout checks even without movement.
function shouldSkipLockDelayProcessing(params: {
  prev: GameState;
  next: GameState;
  action: Action;
  moved: boolean;
  wasGrounded: boolean;
  isNowGrounded: boolean;
}): boolean {
  const { action, isNowGrounded, moved, next, prev, wasGrounded } = params;
  // Early exit: if piece didn't move and ground state didn't change, no processing needed
  // Exception: Tick actions advance time and must check for timeout
  if (!moved && wasGrounded === isNowGrounded && action.type !== "Tick") {
    return true;
  }

  // Guard against illegitimate soft-drop resets
  if (!isSoftDropResetValid(action, prev, next)) {
    return true;
  }

  // Respect reset cap: once reached, movement stops affecting LD entirely.
  const currentResets =
    next.physics.lockDelay.tag === "Grounded"
      ? next.physics.lockDelay.resets
      : 0;
  const atResetLimit = currentResets >= next.timing.lockDelayMaxResets;

  // If at reset limit and this is a movement action, don't process lock delay at all
  if (atResetLimit && moved && canActionResetLockDelay(action.type)) {
    return true;
  }

  return false;
}

// Centralize transition to resolvingLock and materialize PendingLock
// with an explicit source; reset LD to Airborne for the next piece.
function createLockedState(next: GameState, timestamp: Timestamp): GameState {
  if (!next.active) {
    throw new Error("Cannot create locked state without active piece");
  }
  const lockSource: LockSource = next.physics.isSoftDropping
    ? "softDrop"
    : "gravity";
  const pending = createPendingLock(
    next.board,
    next.active,
    lockSource,
    timestamp,
  );

  return {
    ...next,
    active: undefined,
    pendingLock: pending,
    physics: {
      ...next.physics,
      lockDelay: Airborne(),
    },
    status: "resolvingLock",
  };
}

/**
 * Physics post-step: advance the lock-delay state machine after reducers run.
 * Keeps action handlers pure and local to their domain (movement/rotation/etc.)
 * while centralizing ground-contact and lock timing here for consistency.
 */
export function physicsPostStep(
  prev: GameState,
  next: GameState,
  action: Action,
): GameState {
  if (!next.active) return next;

  const { shouldProcess, timestamp } = shouldProcessLockDelay(action, next);
  if (!shouldProcess || !timestamp) {
    return next;
  }

  // Calculate ground contact state
  const wasGrounded = prev.active ? isAtBottom(prev.board, prev.active) : false;
  const isNowGrounded = isAtBottom(next.board, next.active);
  const moved = pieceChanged(prev.active, next.active);

  // Check if we should skip lock delay processing
  if (
    shouldSkipLockDelayProcessing({
      action,
      isNowGrounded,
      moved,
      next,
      prev,
      wasGrounded,
    })
  ) {
    return next;
  }

  // Advance the lock-delay machine with current contact/motion context
  const { ld, lockNow } = stepLockDelay({
    delayMs: durationMsAsNumber(next.timing.lockDelayMs),
    grounded: isNowGrounded,
    ld: next.physics.lockDelay,
    maxResets: next.timing.lockDelayMaxResets,
    movedWhileGrounded:
      isNowGrounded &&
      wasGrounded &&
      moved &&
      canActionResetLockDelay(action.type),
    ts: timestamp,
  });

  // If not locking, persist the updated lock-delay state only when it changed
  if (!lockNow) {
    if (ld === next.physics.lockDelay) {
      return next;
    }
    return {
      ...next,
      physics: {
        ...next.physics,
        lockDelay: ld,
      },
    };
  }

  // Machine requested lock: create PendingLock and transition to resolvingLock
  return createLockedState(next, timestamp);
}
