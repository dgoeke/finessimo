import { isAtBottom } from "@/engine/core/board";
import { gravityStep } from "@/engine/physics/gravity";
import { updateLock } from "@/engine/physics/lock-delay";

import type { DomainEvent } from "@/engine/events";
import type { CommandSideEffects } from "@/engine/step/apply-commands";
import type { GameState, PieceId } from "@/engine/types";

export type PhysicsSideEffects = {
  hardDropped: boolean;
  lockNow: boolean;
  spawnOverride?: PieceId;
};

export function advancePhysics(
  state: GameState,
  cmdFx: CommandSideEffects,
): {
  state: GameState;
  events: ReadonlyArray<DomainEvent>;
  sideEffects: PhysicsSideEffects;
} {
  let s = state;
  const events: Array<DomainEvent> = [];

  // 1) Apply gravity (may move the piece down multiple cells)
  const g = gravityStep(s);
  s = g.state;

  // 2) Compute grounded flag based on whether piece is at bottom (not stored in state)
  const grounded = s.piece ? isAtBottom(s.board, s.piece) : false;

  // 3) Hard drop bypasses lock delay system entirely
  if (cmdFx.hardDropped) {
    // If piece just became grounded and had no deadline, emit LockStarted
    const wasAirborne = s.physics.lock.deadlineTick === null;
    if (grounded && wasAirborne) {
      events.push({ kind: "LockStarted", tick: s.tick });
    }

    const sideEffects: PhysicsSideEffects = {
      hardDropped: true,
      lockNow: true,
    };

    if (cmdFx.spawnOverride !== undefined) {
      sideEffects.spawnOverride = cmdFx.spawnOverride;
    }

    return {
      events,
      sideEffects,
      state: s,
    };
  }

  // 4) Normal lock delay machine (only for non-hard-drop cases)
  const L = updateLock(s, s.tick, {
    grounded,
    lockResetEligible: cmdFx.lockResetEligible,
    lockResetReason: cmdFx.lockResetReason,
  });
  s = L.state;
  if (L.started) events.push({ kind: "LockStarted", tick: s.tick });
  if (L.reset && L.resetReason !== undefined)
    events.push({ kind: "LockReset", reason: L.resetReason, tick: s.tick });

  const lockNow = L.lockNow;

  const sideEffects: PhysicsSideEffects = {
    hardDropped: cmdFx.hardDropped,
    lockNow,
  };

  if (cmdFx.spawnOverride !== undefined) {
    sideEffects.spawnOverride = cmdFx.spawnOverride;
  }

  return {
    events,
    sideEffects,
    state: s,
  };
}
