import {
  tryMove,
  moveToWall,
  dropToBottom,
  isAtBottom,
} from "@/engine/core/board";
import {
  tryRotateWithKickInfo,
  getNextRotation,
  type SRSRotateResult,
} from "@/engine/core/srs";
import {
  type GameState,
  type PieceId,
  gridCoordAsNumber,
} from "@/engine/types";

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
  const lockResetEligible = isAtBottom(state.board, state.piece);
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
  const lockResetEligible = isAtBottom(state.board, state.piece);
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
  const lockResetEligible = isAtBottom(state.board, state.piece);
  return { fromX, lockResetEligible, moved: toX !== fromX, state: next, toX };
}

/**
 * Classifies kick type based on kick index from SRS table
 * - Index 0: No kick (basic rotation)
 * - Index 1-4: Wall kicks (horizontal or vertical adjustments)
 * - Floor kicks involve upward movement (negative Y in SRS coordinate system)
 */
function classifyKick(
  kickIndex: number,
  kickOffset: readonly [number, number],
): "none" | "wall" | "floor" {
  if (kickIndex === 0) return "none"; // Basic rotation, no kick needed

  // Check for floor kick: upward movement. Negative Y is upward in board coords,
  // but positive Y is up in SRS coords and kickOffset is in SRS coords.
  if (kickOffset[1] > 0) {
    return "floor"; //
  }

  return "wall";
}

function tryRotateInternal(
  state: GameState,
  direction: "CW" | "CCW",
): RotateResult {
  if (!state.piece)
    return { kick: "none", lockResetEligible: false, rotated: false, state };

  const targetRot = getNextRotation(state.piece.rot, direction);
  const rotateResult: SRSRotateResult = tryRotateWithKickInfo(
    state.piece,
    targetRot,
    state.board,
  );

  if (rotateResult.piece === null) {
    return { kick: "none", lockResetEligible: false, rotated: false, state };
  }

  const next = { ...state, piece: rotateResult.piece };
  const lockResetEligible = isAtBottom(state.board, state.piece);

  // Classify kick based on the kick index and offset
  const kick = classifyKick(rotateResult.kickIndex, rotateResult.kickOffset);

  return { kick, lockResetEligible, rotated: true, state: next };
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

  const piece = state.piece;
  const droppedPiece = dropToBottom(state.board, piece);

  // Pure hard drop: only move piece to bottom, don't mutate lock state
  // Lock handling is done in advance-physics via hardDropped flag
  const newState: GameState = {
    ...state,
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
