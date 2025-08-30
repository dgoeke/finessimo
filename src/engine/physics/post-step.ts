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

// Helper function to determine if piece changed position
function pieceChanged(
  prev: ActivePiece | undefined,
  next: ActivePiece | undefined,
): boolean {
  if (!prev || !next) return prev !== next;
  return prev.x !== next.x || prev.y !== next.y || prev.rot !== next.rot;
}

// Helper function to determine if action can reset lock delay
function canActionResetLockDelay(actionType: Action["type"]): boolean {
  return ["TapMove", "HoldMove", "RepeatMove", "Rotate", "SoftDrop"].includes(
    actionType,
  );
}

// Helper function to determine if action can start lock delay
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
    "Tick", // Tick can start lock delay via gravity landing
  ].includes(actionType);
}

// Check if soft drop should reset lock delay (only if piece moved down)
function isSoftDropResetValid(
  action: Action,
  previousState: GameState,
  newState: GameState,
): boolean {
  if (action.type !== "SoftDrop" || !action.on || !newState.active) return true;
  return newState.active.y > (previousState.active?.y ?? 0);
}

// Check if action should be processed for lock delay
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

// Helper to check early exit conditions
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
  // Exception: Tick actions always need processing to check for timeout
  if (!moved && wasGrounded === isNowGrounded && action.type !== "Tick") {
    return true;
  }

  // Check soft drop reset validity
  if (!isSoftDropResetValid(action, prev, next)) {
    return true;
  }

  // Calculate if this movement should trigger any lock delay processing
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

// Helper to create locked state
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
 * Physics post-step function that handles lock delay state transitions
 * using the lock delay machine. Replaces the old postProcessLockDelay.
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

  // Use the lock delay machine to handle transitions
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

  // If not locking, just update the lock delay state
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

  // Lock is triggered - create pending lock and transition to resolvingLock
  return createLockedState(next, timestamp);
}
