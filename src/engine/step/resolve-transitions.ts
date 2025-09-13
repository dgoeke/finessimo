import {
  placeActivePiece,
  clearCompletedLines,
  spawnNextOrTopOut,
} from "../gameplay/spawn.js";

import type { DomainEvent } from "../events.js";
import type { Tick, GameState } from "../types.js";
import type { PhysicsSideEffects } from "./advance-physics.js";

export function resolveTransitions(
  state: GameState,
  tick: Tick,
  physFx: PhysicsSideEffects,
): { state: GameState; events: ReadonlyArray<DomainEvent> } {
  let s = state;
  const events: Array<DomainEvent> = [];

  if (physFx.lockNow) {
    // Place piece
    const placed = placeActivePiece(s);
    s = placed.state;
    events.push({
      kind: "Locked",
      pieceId: placed.pieceId,
      source: "ground",
      tick,
    });

    // Clear lines
    const cleared = clearCompletedLines(s);
    s = cleared.state;
    if (cleared.rows.length > 0) {
      events.push({ kind: "LinesCleared", rows: cleared.rows, tick });
    }

    // Spawn next or topout
    const sp = spawnNextOrTopOut(s);
    s = sp.state;
    if (sp.topOut) {
      events.push({ kind: "TopOut", tick });
    } else if (sp.spawnedId !== null) {
      events.push({ kind: "PieceSpawned", pieceId: sp.spawnedId, tick });
    }
  }

  // Advance state's tick marker
  // @ts-ignore - arithmetic on branded type is OK here
  s = { ...s, tick: (s.tick + 1) as Tick };

  return { events, state: s };
}
