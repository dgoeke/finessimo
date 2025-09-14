import { isPieceEntirelyInVanishZone } from "../core/spawning";
import {
  placeActivePiece,
  clearCompletedLines,
  spawnPiece,
} from "../gameplay/spawn";

import type { DomainEvent } from "../events";
import type { GameState } from "../types";
import type { PhysicsSideEffects } from "./advance-physics";

function handleLocking(
  state: GameState,
  physFx: PhysicsSideEffects,
): { state: GameState; events: Array<DomainEvent>; shouldExit: boolean } {
  const events: Array<DomainEvent> = [];
  let s = state;

  if (!s.piece || !physFx.lockNow) {
    return { events, shouldExit: false, state: s };
  }

  // Keep a copy of the active piece state *before* locking
  const justLockedPiece = s.piece;

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
  const didClear = cleared.rows.length > 0;
  s = cleared.state;

  // Detect lock-out: piece locked entirely in vanish zone and no clear
  if (!didClear && isPieceEntirelyInVanishZone(justLockedPiece)) {
    // End the game immediately; skip spawning
    events.push({ kind: "TopOut", tick: s.tick });
    return { events, shouldExit: true, state: s };
  }

  if (didClear) {
    events.push({ kind: "LinesCleared", rows: cleared.rows, tick: s.tick });
  }

  return { events, shouldExit: false, state: s };
}

function handleSpawning(
  state: GameState,
  physFx: PhysicsSideEffects,
): { state: GameState; events: Array<DomainEvent> } {
  const events: Array<DomainEvent> = [];
  let s = state;

  if (s.piece) {
    return { events, state: s };
  }

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

  return { events, state: s };
}

export function resolveTransitions(
  state: GameState,
  physFx: PhysicsSideEffects,
): { state: GameState; events: ReadonlyArray<DomainEvent> } {
  let s = state;
  const allEvents: Array<DomainEvent> = [];

  // 1) Handle locking path
  const lockResult = handleLocking(s, physFx);
  s = lockResult.state;
  allEvents.push(...lockResult.events);

  if (lockResult.shouldExit) {
    return { events: allEvents, state: s };
  }

  // 2) Handle spawning path
  const spawnResult = handleSpawning(s, physFx);
  s = spawnResult.state;
  allEvents.push(...spawnResult.events);

  return { events: allEvents, state: s };
}
