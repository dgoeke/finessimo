import { addQ, fracQ } from "../utils/fixedpoint";
// import { floorQ } from "../utils/fixedpoint"; // Will be needed when implementing tryMoveDownNTimes

import type { GameState } from "../types";

/**
 * Advance gravity/softdrop accumulator and attempt to descend piece.
 * This function does not emit events; it only updates state.
 */
export function gravityStep(state: GameState): { state: GameState } {
  const s = state;
  if (!s.piece) return { state: s };
  const g =
    s.physics.softDropOn && s.cfg.softDrop32 != null
      ? s.cfg.softDrop32
      : s.cfg.gravity32;
  const accum = addQ(s.physics.gravityAccum32, g);
  // const cells = floorQ(accum); // Will be used when implementing tryMoveDownNTimes
  const nextAccum = fracQ(accum);

  let next = s;
  // TODO: attempt to move piece down up to `cells` times, stopping if collision blocks
  // next = tryMoveDownNTimes(next, cells);

  next = { ...next, physics: { ...next.physics, gravityAccum32: nextAccum } };
  return { state: next };
}
