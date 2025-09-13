import type { GameState } from "../types.js";

type MoveResult = {
  state: GameState;
  moved: boolean;
  fromX: number;
  toX: number;
  lockResetEligible: boolean;
};
type RotateResult = {
  state: GameState;
  rotated: boolean;
  kick: "none" | "wall" | "floor";
  lockResetEligible: boolean;
};

export function tryMoveLeft(state: GameState): MoveResult {
  if (!state.piece)
    return { fromX: 0, lockResetEligible: false, moved: false, state, toX: 0 };
  const p = state.piece;
  const fromX = p.x;
  const toX = p.x - 1;
  // TODO: collision check left
  // const ok = true;
  // if (!ok) return { fromX, lockResetEligible: false, moved: false, state, toX };
  const next = { ...state, piece: { ...p, x: toX } };
  // If grounded before and moved horizontally, this is lock reset eligible
  const lockResetEligible = state.physics.grounded;
  return { fromX, lockResetEligible, moved: true, state: next, toX };
}

export function tryMoveRight(state: GameState): MoveResult {
  if (!state.piece)
    return { fromX: 0, lockResetEligible: false, moved: false, state, toX: 0 };
  const p = state.piece;
  const fromX = p.x;
  const toX = p.x + 1;
  // TODO: collision check right
  // const ok = true;
  // if (!ok) return { fromX, lockResetEligible: false, moved: false, state, toX };
  const next = { ...state, piece: { ...p, x: toX } };
  const lockResetEligible = state.physics.grounded;
  return { fromX, lockResetEligible, moved: true, state: next, toX };
}

export function tryShiftToWall(
  state: GameState,
  dir: "Left" | "Right",
): MoveResult {
  if (!state.piece)
    return { fromX: 0, lockResetEligible: false, moved: false, state, toX: 0 };
  const p = state.piece;
  const fromX = p.x;
  let toX = p.x;
  // TODO: repeatedly move until collision (no board knowledge in control needed)
  // For now just pretend we moved to board edge:
  toX = dir === "Left" ? 0 : state.board.width - 1;
  const next = { ...state, piece: { ...p, x: toX } };
  const lockResetEligible = state.physics.grounded;
  return { fromX, lockResetEligible, moved: toX !== fromX, state: next, toX };
}

function tryRotateInternal(
  state: GameState,
  _direction: "CW" | "CCW",
): RotateResult {
  if (!state.piece)
    return { kick: "none", lockResetEligible: false, rotated: false, state };
  // TODO: SRS kicks
  const next = state; // placeholder
  const lockResetEligible = state.physics.grounded;
  return { kick: "none", lockResetEligible, rotated: true, state: next };
}

export function tryRotateCW(state: GameState): RotateResult {
  return tryRotateInternal(state, "CW");
}

export function tryRotateCCW(state: GameState): RotateResult {
  return tryRotateInternal(state, "CCW");
}

export function tryHardDrop(state: GameState): {
  state: GameState;
  hardDropped: boolean;
} {
  if (!state.piece) return { hardDropped: false, state };
  // TODO: move down until blocked; set physics.lock.deadlineTick = tick to force lock this tick
  return { hardDropped: true, state };
}

export function tryHold(state: GameState): {
  state: GameState;
  emitted: boolean;
  swapped: boolean;
} {
  // TODO: hold rules (only once per piece unless swapped with empty/held piece etc.)
  return { emitted: false, state, swapped: false };
}
