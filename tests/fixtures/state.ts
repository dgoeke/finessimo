/**
 * Test fixtures for game state types.
 * Creates properly typed Board and ActivePiece instances for use in tests.
 */

import { createActivePiece as coreCreateActivePiece } from "../../src/core/spawning";
import { createBoardCells } from "../../src/state/types";
import { createGridCoord } from "../../src/types/brands";

import type { Board, ActivePiece, PieceId, Rot } from "../../src/state/types";

// Create a Board with custom cells or defaults
export function createBoard(overrides: Partial<Board> = {}): Board {
  return {
    cells: createBoardCells(),
    height: 20,
    totalHeight: 23,
    vanishRows: 3,
    width: 10,
    ...overrides,
  };
}

// Create an ActivePiece with position/rotation overrides
export function createActivePiece(config: {
  id: PieceId;
  x?: number;
  y?: number;
  rot?: Rot;
}): ActivePiece {
  const basePiece = coreCreateActivePiece(config.id);
  return {
    ...basePiece,
    rot: config.rot ?? basePiece.rot,
    x: config.x !== undefined ? createGridCoord(config.x) : basePiece.x,
    y: config.y !== undefined ? createGridCoord(config.y) : basePiece.y,
  };
}
