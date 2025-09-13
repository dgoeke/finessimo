import { isAtBottom } from "../core/board";
import { gravityStep } from "../physics/gravity";
import { updateLock } from "../physics/lock-delay";

import type { DomainEvent } from "../events";
import type { Tick, GameState } from "../types";
import type { CommandSideEffects } from "./apply-commands";

export type PhysicsSideEffects = {
  hardDropped: boolean;
  lockNow: boolean;
};

export function advancePhysics(
  state: GameState,
  tick: Tick,
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

  // 2) Update grounded flag based on whether piece is at bottom
  const grounded = s.piece ? isAtBottom(s.board, s.piece) : false;
  s = {
    ...s,
    physics: {
      ...s.physics,
      grounded,
    },
  };

  // 3) Lock delay machine
  const L = updateLock(s, tick, {
    grounded,
    lockResetEligible: cmdFx.lockResetEligible,
    lockResetReason: cmdFx.lockResetReason,
  });
  s = L.state;
  if (L.started) events.push({ kind: "LockStarted", tick });
  if (L.reset && L.resetReason !== undefined)
    events.push({ kind: "LockReset", reason: L.resetReason, tick });

  // Hard drop forces immediate lock regardless of lock delay
  const lockNow = L.lockNow || cmdFx.hardDropped;

  return {
    events,
    sideEffects: { hardDropped: cmdFx.hardDropped, lockNow },
    state: s,
  };
}
