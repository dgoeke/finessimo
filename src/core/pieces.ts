import { PieceId, TetrominoShape } from '../state/types';

export const PIECES: Record<PieceId, TetrominoShape> = {
  T: {
    id: 'T',
    cells: {
      spawn: [[1,0],[0,1],[1,1],[2,1]],
      right: [[1,0],[1,1],[2,1],[1,2]],
      left:  [[1,0],[0,1],[1,1],[1,2]],
    },
    spawnTopLeft: [3, -2], color: '#a000f0',
  },
  J: {
    id: 'J',
    cells: {
      spawn: [[0,0],[0,1],[1,1],[2,1]],
      right: [[1,0],[2,0],[1,1],[1,2]],
      left:  [[1,0],[0,2],[1,1],[1,2]],
    },
    spawnTopLeft: [3, -2], color: '#0000f0',
  },
  L: {
    id: 'L',
    cells: {
      spawn: [[2,0],[0,1],[1,1],[2,1]],
      right: [[1,0],[1,1],[1,2],[2,2]],
      left:  [[0,0],[1,0],[1,1],[1,2]],
    },
    spawnTopLeft: [3, -2], color: '#f0a000',
  },
  S: {
    id: 'S',
    cells: {
      spawn: [[1,0],[2,0],[0,1],[1,1]],
      right: [[1,0],[1,1],[2,1],[2,2]],
      left:  [[0,0],[0,1],[1,1],[1,2]],
    },
    spawnTopLeft: [3, -2], color: '#00f000',
  },
  Z: {
    id: 'Z',
    cells: {
      spawn: [[0,0],[1,0],[1,1],[2,1]],
      right: [[2,0],[1,1],[2,1],[1,2]],
      left:  [[0,1],[1,1],[1,2],[2,2]],
    },
    spawnTopLeft: [3, -2], color: '#f00000',
  },
  I: {
    id: 'I',
    cells: {
      spawn: [[0,1],[1,1],[2,1],[3,1]],
      right: [[2,0],[2,1],[2,2],[2,3]],
      left:  [[1,0],[1,1],[1,2],[1,3]],
    },
    spawnTopLeft: [3, -1], color: '#00f0f0',
  },
  O: {
    id: 'O',
    cells: {
      spawn: [[1,0],[2,0],[1,1],[2,1]],
      right: [[1,0],[2,0],[1,1],[2,1]],
      left:  [[1,0],[2,0],[1,1],[2,1]],
    },
    spawnTopLeft: [4, -2], color: '#f0f000',
  },
};