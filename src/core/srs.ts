// Wall Kick Tables

// Standard CW/CCW kicks for JLSTZ pieces
export const KICKS_JLSTZ: Record<string, ReadonlyArray<readonly [number, number]>> = {
  'spawn->right': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  'right->spawn': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  'right->left':  [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  'left->right':  [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  'left->spawn':  [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  'spawn->left':  [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
};

// Standard CW/CCW kicks for I piece
export const KICKS_I: Record<string, ReadonlyArray<readonly [number, number]>> = {
  'spawn->right': [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
  'right->spawn': [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
  'right->left':  [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
  'left->right':  [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
  'left->spawn':  [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
  'spawn->left':  [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
};

import { ActivePiece, Board, Rot } from '../state/types';
import { PIECES } from './pieces';
import { canPlacePiece } from './board';

// Helper function to get the appropriate kick table for a piece
function getKickTable(pieceId: string): Record<string, ReadonlyArray<readonly [number, number]>> {
  return pieceId === 'I' ? KICKS_I : KICKS_JLSTZ;
}

// Helper function to get the next rotation state
export function getNextRotation(currentRot: Rot, direction: 'CW' | 'CCW'): Rot {
  if (direction === 'CW') {
    switch (currentRot) {
      case 'spawn': return 'right';
      case 'right': return 'left';
      case 'left': return 'spawn';
    }
  }
  
  if (direction === 'CCW') {
    switch (currentRot) {
      case 'spawn': return 'left';
      case 'left': return 'right';
      case 'right': return 'spawn';
    }
  }
  
  return currentRot;
}

// Check if a rotation is valid (doesn't perform it, just checks)
export function canRotate(
  piece: ActivePiece, 
  targetRot: Rot, 
  board: Board
): boolean {
  // O piece doesn't rotate
  if (piece.id === 'O') {
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
      x: piece.x + dx,
      y: piece.y + appliedDy
    };
    
    if (canPlacePiece(board, kickedPiece)) {
      return true;
    }
  }
  
  return false;
}

// Perform a rotation with wall kicks, returns the new piece position or null if invalid
export function tryRotate(
  piece: ActivePiece, 
  targetRot: Rot, 
  board: Board
): ActivePiece | null {
  // O piece doesn't rotate
  if (piece.id === 'O') {
    return piece.rot === targetRot ? piece : null;
  }
  
  const testPiece = { ...piece, rot: targetRot };
  const kickKey = `${piece.rot}->${targetRot}`;
  const kickTable = getKickTable(piece.id);
  const kicks = kickTable[kickKey];
  
  if (!kicks) {
    return null;
  }
  
  // Try each kick offset
  for (const [dx, dy] of kicks) {
    // Invert dy to account for y-down coordinate system
    const appliedDy = -dy;
    const kickedPiece = {
      ...testPiece,
      x: piece.x + dx,
      y: piece.y + appliedDy
    };
    
    if (canPlacePiece(board, kickedPiece)) {
      return kickedPiece;
    }
  }
  
  return null;
}