import { tryMove, moveToWall, dropToBottom } from "../core/board";
import { tryRotate, getNextRotation } from "../core/srs";
import {
  type GameState,
  type Tick,
  type PieceId,
  gridCoordAsNumber,
} from "../types";

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
  const fromX = gridCoordAsNumber(p.x);
  const toX = fromX - 1;

  const movedPiece = tryMove(state.board, p, -1, 0);
  if (!movedPiece) {
    return { fromX, lockResetEligible: false, moved: false, state, toX: fromX };
  }

  const next = { ...state, piece: movedPiece };
  // If grounded before and moved horizontally, this is lock reset eligible
  const lockResetEligible = state.physics.grounded;
  return { fromX, lockResetEligible, moved: true, state: next, toX };
}

export function tryMoveRight(state: GameState): MoveResult {
  if (!state.piece)
    return { fromX: 0, lockResetEligible: false, moved: false, state, toX: 0 };
  const p = state.piece;
  const fromX = gridCoordAsNumber(p.x);
  const toX = fromX + 1;

  const movedPiece = tryMove(state.board, p, 1, 0);
  if (!movedPiece) {
    return { fromX, lockResetEligible: false, moved: false, state, toX: fromX };
  }

  const next = { ...state, piece: movedPiece };
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
  const fromX = gridCoordAsNumber(p.x);

  const direction = dir === "Left" ? -1 : 1;
  const movedPiece = moveToWall(state.board, p, direction);
  const toX = gridCoordAsNumber(movedPiece.x);

  const next = { ...state, piece: movedPiece };
  const lockResetEligible = state.physics.grounded;
  return { fromX, lockResetEligible, moved: toX !== fromX, state: next, toX };
}

function tryRotateInternal(
  state: GameState,
  direction: "CW" | "CCW",
): RotateResult {
  if (!state.piece)
    return { kick: "none", lockResetEligible: false, rotated: false, state };

  const targetRot = getNextRotation(state.piece.rot, direction);
  const rotatedPiece = tryRotate(state.piece, targetRot, state.board);

  if (!rotatedPiece) {
    return { kick: "none", lockResetEligible: false, rotated: false, state };
  }

  const next = { ...state, piece: rotatedPiece };
  const lockResetEligible = state.physics.grounded;
  // Determine kick type - for now, simplified
  const kick =
    rotatedPiece.x !== state.piece.x || rotatedPiece.y !== state.piece.y
      ? "wall"
      : "none";
  return { kick, lockResetEligible, rotated: true, state: next };
}

export function tryRotateCW(state: GameState): RotateResult {
  return tryRotateInternal(state, "CW");
}

export function tryRotateCCW(state: GameState): RotateResult {
  return tryRotateInternal(state, "CCW");
}

export function tryHardDrop(
  state: GameState,
  tick: Tick,
): {
  state: GameState;
  hardDropped: boolean;
} {
  if (!state.piece) return { hardDropped: false, state };

  const piece = state.piece;
  const droppedPiece = dropToBottom(state.board, piece);

  // Update piece position and set lock deadline to current tick for immediate lock
  const newState: GameState = {
    ...state,
    physics: {
      ...state.physics,
      grounded: true, // Hard drop always grounds the piece
      lock: {
        deadlineTick: tick, // Force lock on this tick
        resetCount: 0, // Reset count doesn't matter as it locks immediately
      },
    },
    piece: droppedPiece,
  };

  return { hardDropped: true, state: newState };
}

export function tryHold(state: GameState): {
  state: GameState;
  emitted: boolean;
  swapped: boolean;
  pieceToSpawn: PieceId | null;
} {
  // Cannot hold if no active piece
  if (!state.piece) {
    return { emitted: false, pieceToSpawn: null, state, swapped: false };
  }

  // Cannot hold if already used this turn
  if (state.hold.usedThisTurn) {
    return { emitted: false, pieceToSpawn: null, state, swapped: false };
  }

  const currentPieceId = state.piece.id;
  const heldPieceId = state.hold.piece;

  // Clear the active piece and mark hold as used
  const newState: GameState = {
    ...state,
    hold: {
      piece: currentPieceId,
      usedThisTurn: true,
    },
    piece: null, // Clear active piece
  };

  return {
    emitted: true,
    pieceToSpawn: heldPieceId, // null if no piece was held, PieceId if swapping
    state: newState,
    swapped: heldPieceId !== null,
  };
}
