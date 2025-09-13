import {
  placeActivePiece,
  clearCompletedLines,
  spawnPiece,
} from "../gameplay/spawn";

import type { DomainEvent } from "../events";
import type { Tick, GameState } from "../types";
import type { PhysicsSideEffects } from "./advance-physics";

export function resolveTransitions(
  state: GameState,
  tick: Tick,
  physFx: PhysicsSideEffects,
): { state: GameState; events: ReadonlyArray<DomainEvent> } {
  let s = state;
  const events: Array<DomainEvent> = [];

  // Handle initial spawn if no piece exists
  if (!s.piece) {
    const sp = spawnPiece(s);
    s = sp.state;
    if (sp.topOut) {
      events.push({ kind: "TopOut", tick });
    } else if (sp.spawnedId !== null) {
      events.push({ kind: "PieceSpawned", pieceId: sp.spawnedId, tick });
    }
  } else if (physFx.lockNow) {
    // Place piece
    const placed = placeActivePiece(s);
    s = placed.state;
    if (placed.pieceId !== null) {
      events.push({
        kind: "Locked",
        pieceId: placed.pieceId,
        source: physFx.hardDropped ? "hardDrop" : "ground",
        tick,
      });
    }

    // Clear lines
    const cleared = clearCompletedLines(s);
    s = cleared.state;
    if (cleared.rows.length > 0) {
      events.push({ kind: "LinesCleared", rows: cleared.rows, tick });
    }

    // Spawn next or topout
    const sp = spawnPiece(s);
    s = sp.state;
    if (sp.topOut) {
      events.push({ kind: "TopOut", tick });
    } else if (sp.spawnedId !== null) {
      events.push({ kind: "PieceSpawned", pieceId: sp.spawnedId, tick });
    }
  }

  return { events, state: s };
}
