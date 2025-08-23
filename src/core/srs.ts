// Wall Kick Tables (with 180° rotations)

// Standard CW/CCW kicks for JLSTZ pieces
export const KICKS_JLSTZ: Record<string, ReadonlyArray<readonly [number, number]>> = {
  'spawn->right': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  'right->spawn': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  'right->left':  [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  'left->right':  [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  'left->spawn':  [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  'spawn->left':  [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  'reverse->right': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  'right->reverse': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  'reverse->left':  [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  'left->reverse':  [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
};

// Standard CW/CCW kicks for I piece
export const KICKS_I: Record<string, ReadonlyArray<readonly [number, number]>> = {
  'spawn->right': [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
  'right->spawn': [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
  'reverse->right': [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
  'right->reverse': [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
  'left->spawn':  [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
  'spawn->left':  [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
  'reverse->left':  [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
  'left->reverse':  [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
};

// 180-degree kicks for JLSTZ pieces
export const KICKS_JLSTZ_180: Record<string, ReadonlyArray<readonly [number, number]>> = {
  'spawn->reverse': [[0,0],[1,0],[-2,0],[1,-1],[-2,-1]],
  'reverse->spawn': [[0,0],[-1,0],[2,0],[-1,1],[2,1]],
  'right->left':    [[0,0],[2,0],[-1,0],[2,1],[-1,1]],
  'left->right':    [[0,0],[-2,0],[1,0],[-2,-1],[1,-1]],
};

// 180-degree kicks for I piece
export const KICKS_I_180: Record<string, ReadonlyArray<readonly [number, number]>> = {
  'spawn->reverse': [[0,0],[-1,0],[2,0],[-1,1],[2,1]],
  'reverse->spawn': [[0,0],[1,0],[-2,0],[1,-1],[-2,-1]],
  'right->left':    [[0,0],[1,0],[-2,0],[1,-2],[-2,-2]],
  'left->right':    [[0,0],[-1,0],[2,0],[-1,2],[2,2]],
};

import { ActivePiece, Board, Rot } from '../state/types';
import { PIECES } from './pieces';
import { canPlacePiece } from './board';

// Helper function to get the appropriate kick table for a piece
function getKickTable(pieceId: string, is180: boolean): Record<string, ReadonlyArray<readonly [number, number]>> {
  if (is180) {
    return pieceId === 'I' ? KICKS_I_180 : KICKS_JLSTZ_180;
  } else {
    return pieceId === 'I' ? KICKS_I : KICKS_JLSTZ;
  }
}

// Helper function to determine if a rotation is 180 degrees
function is180Rotation(fromRot: Rot, toRot: Rot): boolean {
  const rotations: Rot[] = ['spawn', 'right', 'reverse', 'left'];
  const fromIndex = rotations.indexOf(fromRot);
  const toIndex = rotations.indexOf(toRot);
  const diff = Math.abs(toIndex - fromIndex);
  return diff === 2;
}

// Helper function to get the next rotation state
export function getNextRotation(currentRot: Rot, direction: 'CW' | 'CCW' | '180'): Rot {
  if (direction === '180') {
    switch (currentRot) {
      case 'spawn': return 'reverse';
      case 'right': return 'left';
      case 'reverse': return 'spawn';
      case 'left': return 'right';
    }
  }
  
  if (direction === 'CW') {
    switch (currentRot) {
      case 'spawn': return 'right';
      case 'right': return 'reverse';
      case 'reverse': return 'left';
      case 'left': return 'spawn';
    }
  }
  
  if (direction === 'CCW') {
    switch (currentRot) {
      case 'spawn': return 'left';
      case 'left': return 'reverse';
      case 'reverse': return 'right';
      case 'right': return 'spawn';
    }
  }
  
  return currentRot;
}

// Check if a rotation is valid (doesn't perform it, just checks)
export function canRotate(
  piece: ActivePiece, 
  targetRot: Rot, 
  board: Board, 
  allow180: boolean = true
): boolean {
  // O piece doesn't rotate
  if (piece.id === 'O') {
    return piece.rot === targetRot;
  }
  
  // Check if 180-degree rotation is allowed
  if (!allow180 && is180Rotation(piece.rot, targetRot)) {
    return false;
  }
  
  const testPiece = { ...piece, rot: targetRot };
  const kickKey = `${piece.rot}->${targetRot}`;
  const is180 = is180Rotation(piece.rot, targetRot);
  const kickTable = getKickTable(piece.id, is180);
  const kicks = kickTable[kickKey];
  
  if (!kicks) {
    return false;
  }
  
  // Try each kick offset
  for (const [dx, dy] of kicks) {
    const kickedPiece = {
      ...testPiece,
      x: piece.x + dx,
      y: piece.y + dy
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
  board: Board, 
  allow180: boolean = true
): ActivePiece | null {
  // O piece doesn't rotate
  if (piece.id === 'O') {
    return piece.rot === targetRot ? piece : null;
  }
  
  // Check if 180-degree rotation is allowed
  if (!allow180 && is180Rotation(piece.rot, targetRot)) {
    return null;
  }
  
  const testPiece = { ...piece, rot: targetRot };
  const kickKey = `${piece.rot}->${targetRot}`;
  const is180 = is180Rotation(piece.rot, targetRot);
  const kickTable = getKickTable(piece.id, is180);
  const kicks = kickTable[kickKey];
  
  if (!kicks) {
    return null;
  }
  
  // Try each kick offset
  for (const [dx, dy] of kicks) {
    const kickedPiece = {
      ...testPiece,
      x: piece.x + dx,
      y: piece.y + dy
    };
    
    if (canPlacePiece(board, kickedPiece)) {
      return kickedPiece;
    }
  }
  
  return null;
}