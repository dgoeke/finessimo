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

// Stub function for checking if a rotation is valid
export function canRotate(
  piece: ActivePiece, 
  targetRot: Rot, 
  _board: Board, 
  _allow180: boolean = true
): boolean {
  // Stub implementation - always returns true for now
  console.log(`canRotate: ${piece.id} from ${piece.rot} to ${targetRot}`);
  return true;
}

// Stub function for performing a rotation with wall kicks
export function tryRotate(
  piece: ActivePiece, 
  targetRot: Rot, 
  _board: Board, 
  _allow180: boolean = true
): ActivePiece | null {
  // Stub implementation - returns piece with new rotation
  console.log(`tryRotate: ${piece.id} from ${piece.rot} to ${targetRot}`);
  return {
    ...piece,
    rot: targetRot
  };
}