import {
  tryMove,
  isAtBottom,
  lockPiece,
  getCompletedLines,
} from "../../core/board";
import { durationMsAsNumber } from "../../types/brands";
import { createTimestamp } from "../../types/timestamp";

import { stepLockDelay, Airborne } from "./lock-delay.machine";

import type { GameState, PendingLock, LockSource } from "../../state/types";
import type { Timestamp } from "../../types/timestamp";

export function shouldApplyGravity(s: GameState): boolean {
  return Boolean(s.timing.gravityEnabled && s.active);
}

export function gravityIntervalMs(s: GameState): number {
  let base = durationMsAsNumber(s.timing.gravityMs);
  if (s.physics.isSoftDropping) {
    if (s.timing.softDrop === "infinite") return 1;
    const m = Math.max(1, s.timing.softDrop);
    base = Math.max(1, Math.floor(durationMsAsNumber(s.timing.gravityMs) / m));
  }
  return base;
}

export function applyOneGravityStep(s: GameState, ts: Timestamp): GameState {
  if (!s.active) return s;

  const moved = tryMove(s.board, s.active, 0, 1);
  if (moved) {
    return {
      ...s,
      active: moved,
      physics: { ...s.physics, lastGravityTime: ts },
    };
  }

  // Piece can't move down due to gravity - this means it just became grounded
  // Use stepLockDelay to handle lock delay logic
  const grounded = isAtBottom(s.board, s.active);
  const { ld, lockNow } = stepLockDelay({
    delayMs: durationMsAsNumber(s.timing.lockDelayMs),
    grounded,
    ld: s.physics.lockDelay,
    maxResets: s.timing.lockDelayMaxResets,
    movedWhileGrounded: false,
    ts,
  });

  if (!lockNow) {
    return {
      ...s,
      physics: {
        ...s.physics,
        lastGravityTime: ts,
        lockDelay: ld,
      },
    };
  }

  // Create pending lock for lock resolution
  const lockSource: LockSource = s.physics.isSoftDropping
    ? "softDrop"
    : "gravity";

  // Create pending lock (inline logic from reducer)
  const finalPos = s.active;
  const simulatedBoard = lockPiece(s.board, finalPos);
  const completedLines = getCompletedLines(simulatedBoard);

  const pending: PendingLock = {
    completedLines,
    finalPos,
    pieceId: s.active.id,
    source: lockSource,
    timestampMs: createTimestamp(ts as unknown as number),
  };

  return {
    ...s,
    active: undefined,
    pendingLock: pending,
    physics: { ...s.physics, lockDelay: Airborne() },
    status: "resolvingLock",
  };
}
