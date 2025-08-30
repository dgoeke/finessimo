import {
  type Board,
  type ActivePiece,
  type PieceId,
  idx,
  isCellBlocked,
  createBoardCells,
} from "../state/types";
import { createGridCoord, gridCoordAsNumber } from "../types/brands";

import { PIECES } from "./pieces";

// Brand the cells array to lock dimensions and prevent misuse elsewhere
export function createEmptyBoard(): Board {
  return {
    cells: createBoardCells(),
    height: 20,
    width: 10,
  };
}

// Check if a piece can be placed at a given position
export function canPlacePiece(board: Board, piece: ActivePiece): boolean {
  const shape = PIECES[piece.id];
  const cells = shape.cells[piece.rot];

  for (const [dx, dy] of cells) {
    const x = createGridCoord(gridCoordAsNumber(piece.x) + dx);
    const y = createGridCoord(gridCoordAsNumber(piece.y) + dy);

    if (isCellBlocked(board, x, y)) {
      return false;
    }
  }

  return true;
}

// Check if a piece can move in a given direction
export function canMove(
  board: Board,
  piece: ActivePiece,
  dx: number,
  dy: number,
): boolean {
  const newPiece = {
    ...piece,
    x: createGridCoord(gridCoordAsNumber(piece.x) + dx),
    y: createGridCoord(gridCoordAsNumber(piece.y) + dy),
  };

  return canPlacePiece(board, newPiece);
}

// Move piece as far as possible in a direction (for DAS/ARR and wall charges)
export function moveToWall(
  board: Board,
  piece: ActivePiece,
  direction: -1 | 1,
): ActivePiece {
  let currentPiece = piece;

  while (canMove(board, currentPiece, direction, 0)) {
    currentPiece = {
      ...currentPiece,
      x: createGridCoord(gridCoordAsNumber(currentPiece.x) + direction),
    };
  }

  return currentPiece;
}

// Drop piece to bottom (for hard drop)
export function dropToBottom(board: Board, piece: ActivePiece): ActivePiece {
  let currentPiece = piece;

  while (canMove(board, currentPiece, 0, 1)) {
    currentPiece = {
      ...currentPiece,
      y: createGridCoord(gridCoordAsNumber(currentPiece.y) + 1),
    };
  }

  return currentPiece;
}

// Calculate ghost piece position (same as dropToBottom but more explicit naming)
export function calculateGhostPosition(
  board: Board,
  piece: ActivePiece,
): ActivePiece {
  return dropToBottom(board, piece);
}

// Check if piece is at the bottom (touching ground or other pieces)
export function isAtBottom(board: Board, piece: ActivePiece): boolean {
  return !canMove(board, piece, 0, 1);
}

// Return a new position if valid; otherwise null. Keeps callers pure and branchy.
export function tryMove(
  board: Board,
  piece: ActivePiece,
  dx: number,
  dy: number,
): ActivePiece | null {
  if (canMove(board, piece, dx, dy)) {
    return {
      ...piece,
      x: createGridCoord(gridCoordAsNumber(piece.x) + dx),
      y: createGridCoord(gridCoordAsNumber(piece.y) + dy),
    };
  }
  return null;
}

// Lock a piece onto the board by writing only visible cells; negative y cells are ignored
export function lockPiece(board: Board, piece: ActivePiece): Board {
  const newCells = createBoardCells();
  // Copy existing board state
  for (let i = 0; i < 200; i++) {
    newCells[i] = board.cells[i] ?? 0;
  }
  const shape = PIECES[piece.id];
  const cells = shape.cells[piece.rot];

  // Map piece ID to a stable cell value for color/render lookups
  const cellValue = getPieceValue(piece.id);

  for (const [dx, dy] of cells) {
    const x = gridCoordAsNumber(piece.x) + dx;
    const y = gridCoordAsNumber(piece.y) + dy;

    // Only lock cells that are within the visible board
    if (x >= 0 && x < board.width && y >= 0 && y < board.height) {
      const xCoord = createGridCoord(x);
      const yCoord = createGridCoord(y);
      newCells[idx(xCoord, yCoord, board.width)] = cellValue;
    }
  }

  return {
    ...board,
    cells: newCells,
  };
}

// Convert piece ID to cell value
function getPieceValue(pieceId: PieceId): number {
  const mapping: Record<PieceId, number> = {
    I: 1,
    J: 6,
    L: 7,
    O: 2,
    S: 4,
    T: 3,
    Z: 5,
  };
  return mapping[pieceId];
}

// Check for completed lines
export function getCompletedLines(board: Board): ReadonlyArray<number> {
  const completedLines: Array<number> = [];

  for (let y = 0; y < board.height; y++) {
    let isComplete = true;
    for (let x = 0; x < board.width; x++) {
      const xCoord = createGridCoord(x);
      const yCoord = createGridCoord(y);
      if (board.cells[idx(xCoord, yCoord, board.width)] === 0) {
        isComplete = false;
        break;
      }
    }
    if (isComplete) {
      completedLines.push(y);
    }
  }

  return completedLines;
}

// Clear completed lines from the board
export function clearLines(
  board: Board,
  linesToClear: ReadonlyArray<number>,
): Board {
  if (linesToClear.length === 0) {
    return board;
  }

  const newCells = createBoardCells();
  let targetY = board.height - 1;

  for (let y = board.height - 1; y >= 0; y--) {
    if (linesToClear.includes(y)) {
      continue; // Skip lines to clear
    }

    // Copy this line to the target position
    if (targetY < 0) {
      targetY--;
      continue;
    }

    for (let x = 0; x < board.width; x++) {
      const xCoord = createGridCoord(x);
      const sourceYCoord = createGridCoord(y);
      const targetYCoord = createGridCoord(targetY);
      const sourceIndex = idx(xCoord, sourceYCoord, board.width);
      const targetIndex = idx(xCoord, targetYCoord, board.width);
      newCells[targetIndex] = board.cells[sourceIndex] ?? 0;
    }
    targetY--;
  }

  return {
    ...board,
    cells: newCells,
  };
}

// Shift all rows up by one and insert the provided row at the bottom.
// Pure utility to centralize board cell mutations for garbage insertion.
export function shiftUpAndInsertRow(
  cells: Uint8Array,
  row: ReadonlyArray<number>,
): Uint8Array {
  const newCells = new Uint8Array(200);

  // Shift rows 1..19 into 0..18
  for (let y = 0; y < 19; y++) {
    const sourceBase = (y + 1) * 10;
    const targetBase = y * 10;
    for (let x = 0; x < 10; x++) {
      newCells[targetBase + x] = cells[sourceBase + x] ?? 0;
    }
  }

  // Insert new row at bottom (row 19)
  const bottomBase = 19 * 10;
  for (let x = 0; x < 10; x++) {
    newCells[bottomBase + x] = row[x] ?? 0;
  }

  return newCells;
}
