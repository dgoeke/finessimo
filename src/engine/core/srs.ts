// SRS (Super Rotation System) Wall Kick Tables
//
// This implementation follows standard SRS rules:
// - Only adjacent rotation states are allowed (90° rotations)
// - 180° rotations must be achieved through two sequential 90° rotations
// - No direct transitions between opposite rotation states (spawn↔two, right↔left)
// - Each piece type (I vs JLSTZ) has its own kick table with specific wall kick offsets
//
// Rotation states: spawn (0°) → right (90°) → two (180°) → left (270°) → spawn
//
// Wall Kick Tables

// Standard kicks for JLSTZ pieces (SRS-compliant 4-way rotation)
import { canPlacePiece } from "./board";
import {
  type ActivePiece,
  type Board,
  type Rot,
  createGridCoord,
  gridCoordAsNumber,
} from "./types";

export const KICKS_JLSTZ: Record<
  string,
  ReadonlyArray<readonly [number, number]>
> = {
  // L -> 0 / 0 -> L
  "left->spawn": [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  "left->two": [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  "right->spawn": [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  // R -> 2 / 2 -> R
  "right->two": [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  "spawn->left": [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  // 0 -> R / R -> 0
  "spawn->right": [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  // 2 -> L / L -> 2
  "two->left": [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  "two->right": [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
};

// Standard kicks for I piece (SRS-compliant 4-way rotation)
export const KICKS_I: Record<
  string,
  ReadonlyArray<readonly [number, number]>
> = {
  // L -> 0 / 0 -> L
  "left->spawn": [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  "left->two": [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  "right->spawn": [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  // R -> 2 / 2 -> R
  "right->two": [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
  "spawn->left": [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
  // 0 -> R / R -> 0
  "spawn->right": [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  // 2 -> L / L -> 2
  "two->left": [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  "two->right": [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
};

// Helper function to get the appropriate kick table for a piece
function getKickTable(
  pieceId: string,
): Record<string, ReadonlyArray<readonly [number, number]>> {
  return pieceId === "I" ? KICKS_I : KICKS_JLSTZ;
}

// Helper function to get the next rotation state
export function getNextRotation(currentRot: Rot, direction: "CW" | "CCW"): Rot {
  if (direction === "CW") {
    switch (currentRot) {
      case "spawn":
        return "right";
      case "right":
        return "two";
      case "two":
        return "left";
      case "left":
        return "spawn";
      default:
        return currentRot;
    }
  } else {
    switch (currentRot) {
      case "spawn":
        return "left";
      case "left":
        return "two";
      case "two":
        return "right";
      case "right":
        return "spawn";
      default:
        return currentRot;
    }
  }
}

// Check if a rotation is valid (doesn't perform it, just checks)
export function canRotate(
  piece: ActivePiece,
  targetRot: Rot,
  board: Board,
): boolean {
  // O piece doesn't rotate
  if (piece.id === "O") {
    return piece.rot === targetRot;
  }

  const testPiece = { ...piece, rot: targetRot };
  const kickKey = `${piece.rot}->${targetRot}`;
  const kickTable = getKickTable(piece.id);
  const kicks = kickTable[kickKey];

  if (!kicks) {
    return false;
  }

  // Try each kick offset
  for (const [dx, dy] of kicks) {
    // Wiki offsets use positive y upwards; our grid uses positive y downwards.
    const appliedDy = -dy;
    const kickedPiece = {
      ...testPiece,
      x: createGridCoord(gridCoordAsNumber(piece.x) + dx),
      y: createGridCoord(gridCoordAsNumber(piece.y) + appliedDy),
    };

    if (canPlacePiece(board, kickedPiece)) {
      return true;
    }
  }

  return false;
}

/**
 * Result of attempting a rotation with kick information
 */
export type SRSRotateResult = {
  piece: ActivePiece | null;
  kickIndex: number; // -1 if failed, 0+ for successful kick index
  kickOffset: readonly [number, number]; // dx, dy in SRS (positive up)
};

// Perform a rotation with wall kicks, returns the new piece position or null if invalid
// NOTE: This function only allows adjacent rotation states (90° rotations) per SRS rules.
// Direct 180° rotations (spawn→two, two→spawn, right→left, left→right) are not supported.
export function tryRotate(
  piece: ActivePiece,
  targetRot: Rot,
  board: Board,
): ActivePiece | null {
  const result = tryRotateWithKickInfo(piece, targetRot, board);
  return result.piece;
}

/**
 * Perform rotation with detailed kick information for event classification
 */
export function tryRotateWithKickInfo(
  piece: ActivePiece,
  targetRot: Rot,
  board: Board,
): SRSRotateResult {
  // O piece doesn't rotate
  if (piece.id === "O") {
    return {
      kickIndex: piece.rot === targetRot ? 0 : -1,
      kickOffset: [0, 0],
      piece: piece.rot === targetRot ? piece : null,
    };
  }

  const testPiece = { ...piece, rot: targetRot };
  const kickKey = `${piece.rot}->${targetRot}`;
  const kickTable = getKickTable(piece.id);
  const kicks = kickTable[kickKey];

  if (!kicks) {
    return { kickIndex: -1, kickOffset: [0, 0], piece: null };
  }

  // Try each kick offset
  for (let i = 0; i < kicks.length; i++) {
    const kickOffset = kicks[i];
    if (!kickOffset) continue;

    const [dx, dy] = kickOffset;
    // Invert dy to account for y-down coordinate system
    const appliedDy = -dy;
    const kickedPiece = {
      ...testPiece,
      x: createGridCoord(gridCoordAsNumber(piece.x) + dx),
      y: createGridCoord(gridCoordAsNumber(piece.y) + appliedDy),
    };

    if (canPlacePiece(board, kickedPiece)) {
      return { kickIndex: i, kickOffset: kickOffset, piece: kickedPiece };
    }
  }

  return { kickIndex: -1, kickOffset: [0, 0], piece: null };
}
