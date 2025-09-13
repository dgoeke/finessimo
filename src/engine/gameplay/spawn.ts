import type { GameState } from "../types.js";

export function placeActivePiece(state: GameState): {
  state: GameState;
  pieceId: number;
} {
  // TODO: write the active piece blocks into board.cells
  const id = state.piece ? state.piece.id : -1;
  const next = state; // placeholder
  return { pieceId: id, state: next };
}

export function clearCompletedLines(state: GameState): {
  state: GameState;
  rows: Array<number>;
} {
  // TODO: detect full rows; remove them; collapse board
  return { rows: [], state };
}

export function spawnNextOrTopOut(state: GameState): {
  state: GameState;
  spawnedId: number | null;
  topOut: boolean;
} {
  // TODO: bag RNG and spawn logic; if blocked, topOut = true
  return { spawnedId: null, state, topOut: false };
}
