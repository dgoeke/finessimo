import {
  placeActivePiece,
  clearCompletedLines,
  spawnPiece,
} from "../gameplay/spawn";

import type { DomainEvent } from "../events";
import type { GameState } from "../types";
import type { PhysicsSideEffects } from "./advance-physics";

export function resolveTransitions(
  state: GameState,
  physFx: PhysicsSideEffects,
): { state: GameState; events: ReadonlyArray<DomainEvent> } {
  let s = state;
  const events: Array<DomainEvent> = [];

  // 1) Handle locking path
  if (s.piece && physFx.lockNow) {
    // Place piece
    const placed = placeActivePiece(s);
    s = placed.state;
    if (placed.pieceId !== null) {
      events.push({
        kind: "Locked",
        pieceId: placed.pieceId,
        source: physFx.hardDropped ? "hardDrop" : "ground",
        tick: s.tick,
      });
    }

    // Clear lines
    const cleared = clearCompletedLines(s);
    s = cleared.state;
    if (cleared.rows.length > 0) {
      events.push({ kind: "LinesCleared", rows: cleared.rows, tick: s.tick });
    }
  }

  // 2) Handle spawning path - centralized single source of truth
  if (!s.piece) {
    const sp = spawnPiece(s, physFx.spawnOverride);
    s = sp.state;
    if (sp.topOut) {
      events.push({ kind: "TopOut", tick: s.tick });
    } else if (sp.spawnedId !== null) {
      events.push({
        kind: "PieceSpawned",
        pieceId: sp.spawnedId,
        tick: s.tick,
      });
    }
  }

  return { events, state: s };
}
