import { PIECES } from "./pieces";
import {
  type Board,
  type ActivePiece,
  type PieceId,
  idx,
  isCellBlocked,
  createBoardCells,
  createGridCoord,
  gridCoordAsNumber,
} from "./types";

// Brand the cells array to lock dimensions and prevent misuse elsewhere
export function createEmptyBoard(): Board {
  return {
    cells: createBoardCells(),
    height: 20,
    totalHeight: 23,
    vanishRows: 3,
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

// Lock a piece onto the board by writing to both vanish and visible ranges
export function lockPiece(board: Board, piece: ActivePiece): Board {
  const newCells = createBoardCells();
  // Copy entire storage (230 cells)
  for (let i = 0; i < board.totalHeight * board.width; i++)
    newCells[i] = board.cells[i] ?? 0;

  const shape = PIECES[piece.id];
  for (const [dx, dy] of shape.cells[piece.rot]) {
    const x = createGridCoord(gridCoordAsNumber(piece.x) + dx);
    const y = createGridCoord(gridCoordAsNumber(piece.y) + dy);
    const xNum = gridCoordAsNumber(x);
    const yNum = gridCoordAsNumber(y);
    if (xNum < 0 || xNum >= board.width) continue;
    if (yNum < -board.vanishRows || yNum >= board.height) continue; // skip OOB and below bottom
    newCells[idx(board, x, y)] = getPieceValue(piece.id);
  }

  return { ...board, cells: newCells };
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
      if (board.cells[idx(board, xCoord, yCoord)] === 0) {
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

// Helper function to copy vanish rows
function copyVanishRows(
  board: Board,
  newCells: ReturnType<typeof createBoardCells>,
): void {
  for (let y = -board.vanishRows; y < 0; y++) {
    for (let x = 0; x < board.width; x++) {
      newCells[idx(board, createGridCoord(x), createGridCoord(y))] =
        board.cells[idx(board, createGridCoord(x), createGridCoord(y))] ?? 0;
    }
  }
}

// Helper function to collect a single row
function collectRow(board: Board, y: number): Array<number> | null {
  const row: Array<number> = [];
  let hasNonZeroCell = false;

  for (let x = 0; x < board.width; x++) {
    const cellValue =
      board.cells[idx(board, createGridCoord(x), createGridCoord(y))] ?? 0;
    row.push(cellValue);
    if (cellValue !== 0) {
      hasNonZeroCell = true;
    }
  }

  return hasNonZeroCell ? row : null;
}

// Helper function to place remaining rows
function placeRemainingRows(
  board: Board,
  newCells: ReturnType<typeof createBoardCells>,
  remainingRows: Array<Array<number>>,
): void {
  let targetY = board.height - 1;

  for (let i = remainingRows.length - 1; i >= 0; i--) {
    const row = remainingRows[i];
    if (row) {
      for (let x = 0; x < board.width; x++) {
        newCells[idx(board, createGridCoord(x), createGridCoord(targetY))] =
          row[x] ?? 0;
      }
      targetY--;
    }
  }
}

// Clear completed lines from the board
export function clearLines(
  board: Board,
  toClear: ReadonlyArray<number>,
): Board {
  if (toClear.length === 0) return board;
  const newCells = createBoardCells();

  // 1) Copy vanish rows unchanged
  copyVanishRows(board, newCells);

  // 2) Collect all non-empty, non-cleared rows
  const remainingRows: Array<Array<number>> = [];

  for (let y = 0; y < board.height; y++) {
    if (!toClear.includes(y)) {
      const row = collectRow(board, y);
      if (row) {
        remainingRows.push(row);
      }
    }
  }

  // 3) Place remaining rows at the bottom
  placeRemainingRows(board, newCells, remainingRows);

  return { ...board, cells: newCells };
}

// Shift all rows up by one and insert the provided row at the bottom.
// Pure utility to centralize board cell mutations for garbage insertion.
export function shiftUpAndInsertRow(
  board: Board,
  row: ReadonlyArray<number>,
): Board["cells"] {
  const newCells = createBoardCells();
  // Shift rows from y = -vanish..(height-2) up by 1
  for (let y = -board.vanishRows; y < board.height - 1; y++) {
    for (let x = 0; x < board.width; x++) {
      newCells[idx(board, createGridCoord(x), createGridCoord(y))] =
        board.cells[idx(board, createGridCoord(x), createGridCoord(y + 1))] ??
        0;
    }
  }
  // Insert garbage at bottom visible row (y = height-1)
  for (let x = 0; x < board.width; x++) {
    newCells[
      idx(board, createGridCoord(x), createGridCoord(board.height - 1))
    ] = row[x] ?? 0;
  }
  return newCells;
}
