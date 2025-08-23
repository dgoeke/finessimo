import { Board, ActivePiece, PieceId, idx, isCellBlocked } from '../state/types';
import { PIECES } from './pieces';

// Create an empty board
export function createEmptyBoard(): Board {
  return {
    width: 10,
    height: 20,
    cells: new Uint8Array(200)
  };
}

// Check if a piece can be placed at a given position
export function canPlacePiece(board: Board, piece: ActivePiece): boolean {
  const shape = PIECES[piece.id];
  const cells = shape.cells[piece.rot];
  
  for (const [dx, dy] of cells) {
    const x = piece.x + dx;
    const y = piece.y + dy;
    
    if (isCellBlocked(board, x, y)) {
      return false;
    }
  }
  
  return true;
}

// Check if a piece can move in a given direction
export function canMove(board: Board, piece: ActivePiece, dx: number, dy: number): boolean {
  const newPiece = {
    ...piece,
    x: piece.x + dx,
    y: piece.y + dy
  };
  
  return canPlacePiece(board, newPiece);
}

// Move piece as far as possible in a direction (for DAS/ARR and wall charges)
export function moveToWall(board: Board, piece: ActivePiece, direction: -1 | 1): ActivePiece {
  let currentPiece = piece;
  
  while (canMove(board, currentPiece, direction, 0)) {
    currentPiece = {
      ...currentPiece,
      x: currentPiece.x + direction
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
      y: currentPiece.y + 1
    };
  }
  
  return currentPiece;
}

// Check if piece is at the bottom (touching ground or other pieces)
export function isAtBottom(board: Board, piece: ActivePiece): boolean {
  return !canMove(board, piece, 0, 1);
}

// Try to move a piece, return new position or null if invalid
export function tryMove(board: Board, piece: ActivePiece, dx: number, dy: number): ActivePiece | null {
  if (canMove(board, piece, dx, dy)) {
    return {
      ...piece,
      x: piece.x + dx,
      y: piece.y + dy
    };
  }
  return null;
}

// Lock a piece onto the board
export function lockPiece(board: Board, piece: ActivePiece): Board {
  const newCells = new Uint8Array(board.cells);
  const shape = PIECES[piece.id];
  const cells = shape.cells[piece.rot];
  
  // Convert piece ID to cell value (simple mapping for now)
  const cellValue = getPieceValue(piece.id);
  
  for (const [dx, dy] of cells) {
    const x = piece.x + dx;
    const y = piece.y + dy;
    
    // Only lock cells that are within the visible board
    if (x >= 0 && x < board.width && y >= 0 && y < board.height) {
      newCells[idx(x, y)] = cellValue;
    }
  }
  
  return {
    ...board,
    cells: newCells
  };
}

// Convert piece ID to cell value
function getPieceValue(pieceId: PieceId): number {
  const mapping: Record<PieceId, number> = {
    'I': 1, 'O': 2, 'T': 3, 'S': 4, 'Z': 5, 'J': 6, 'L': 7
  };
  return mapping[pieceId];
}

// Check for completed lines
export function getCompletedLines(board: Board): number[] {
  const completedLines: number[] = [];
  
  for (let y = 0; y < board.height; y++) {
    let isComplete = true;
    for (let x = 0; x < board.width; x++) {
      if (board.cells[idx(x, y)] === 0) {
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
export function clearLines(board: Board, linesToClear: number[]): Board {
  if (linesToClear.length === 0) {
    return board;
  }
  
  const newCells = new Uint8Array(200);
  let targetY = board.height - 1;
  
  for (let y = board.height - 1; y >= 0; y--) {
    if (!linesToClear.includes(y)) {
      // Copy this line to the target position
      if (targetY >= 0) {
        for (let x = 0; x < board.width; x++) {
          const sourceIndex = idx(x, y);
          const targetIndex = idx(x, targetY);
          newCells[targetIndex] = board.cells[sourceIndex] || 0;
        }
      }
      targetY--;
    }
  }
  
  return {
    ...board,
    cells: newCells
  };
}