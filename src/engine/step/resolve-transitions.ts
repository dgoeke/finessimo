import { isPieceEntirelyInVanishZone } from "@/engine/core/spawning";
import {
  placeActivePiece,
  clearCompletedLines,
  spawnPiece,
} from "@/engine/gameplay/spawn";

import type { DomainEvent } from "@/engine/events";
import type { PhysicsSideEffects } from "@/engine/step/advance-physics";
import type { GameState } from "@/engine/types";

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

  // Place piece (guaranteed to have pieceId since we checked s.piece exists above)
  const placed = placeActivePiece(s);
  s = placed.state;
  // By contract: placeActivePiece only returns null when !state.piece, but we confirmed s.piece exists
  const pieceId = placed.pieceId;
  if (pieceId === null) {
    // This should never happen given our preconditions, but satisfies TypeScript
    throw new Error(
      "Unexpected: placeActivePiece returned null when piece exists",
    );
  }
  events.push({
    kind: "Locked",
    pieceId,
    source: physFx.hardDropped ? "hardDrop" : "ground",
    tick: s.tick,
  });

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
  } else {
    // By contract: spawnPiece only returns null spawnedId when topOut is true
    const spawnedId = sp.spawnedId;
    if (spawnedId === null) {
      // This should never happen when topOut is false, but satisfies TypeScript
      throw new Error(
        "Unexpected: spawnPiece returned null spawnedId when not top-out",
      );
    }
    events.push({
      kind: "PieceSpawned",
      pieceId: spawnedId,
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
