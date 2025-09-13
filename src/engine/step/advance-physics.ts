import { gravityStep } from "../physics/gravity.js";
import { updateLock } from "../physics/lock-delay.js";

import type { DomainEvent } from "../events.js";
import type { Tick, GameState } from "../types.js";
import type { CommandSideEffects } from "./apply-commands.js";

export type PhysicsSideEffects = {
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
  // TODO: optionally emit vertical move events; many games don't for down moves.

  // 2) Update grounded flag here if your collision indicates piece is on floor.
  // TODO: set s.physics.grounded based on collision under the piece.

  // 3) Lock delay machine
  const L = updateLock(s, tick, {
    grounded: s.physics.grounded,
    lockResetEligible: cmdFx.lockResetEligible,
  });
  s = L.state;
  if (L.started) events.push({ kind: "LockStarted", tick });
  if (L.reset && L.resetReason !== undefined)
    events.push({ kind: "LockReset", reason: L.resetReason, tick });

  const lockNow = L.lockNow;

  return { events, sideEffects: { lockNow }, state: s };
}
