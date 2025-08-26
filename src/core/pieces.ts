import { type PieceId, type TetrominoShape } from "../state/types";

export const PIECES: Record<PieceId, TetrominoShape> = {
  I: {
    cells: {
      left: [
        [1, 0],
        [1, 1],
        [1, 2],
        [1, 3],
      ],
      right: [
        [2, 0],
        [2, 1],
        [2, 2],
        [2, 3],
      ],
      spawn: [
        [0, 1],
        [1, 1],
        [2, 1],
        [3, 1],
      ],
      two: [
        [0, 2],
        [1, 2],
        [2, 2],
        [3, 2],
      ],
    },
    color: "#00FFFF", // I - light blue/cyan
    id: "I",
    spawnTopLeft: [3, -1],
  },
  J: {
    cells: {
      left: [
        [1, 0],
        [0, 2],
        [1, 1],
        [1, 2],
      ],
      right: [
        [1, 0],
        [2, 0],
        [1, 1],
        [1, 2],
      ],
      spawn: [
        [0, 0],
        [0, 1],
        [1, 1],
        [2, 1],
      ],
      two: [
        [0, 1],
        [1, 1],
        [2, 1],
        [2, 2],
      ],
    },
    color: "#0000FF", // J - dark blue
    id: "J",
    spawnTopLeft: [3, -2],
  },
  L: {
    cells: {
      left: [
        [0, 0],
        [1, 0],
        [1, 1],
        [1, 2],
      ],
      right: [
        [1, 0],
        [1, 1],
        [1, 2],
        [2, 2],
      ],
      spawn: [
        [2, 0],
        [0, 1],
        [1, 1],
        [2, 1],
      ],
      two: [
        [0, 1],
        [1, 1],
        [2, 1],
        [0, 2],
      ],
    },
    color: "#FF7F00", // L - orange
    id: "L",
    spawnTopLeft: [3, -2],
  },
  O: {
    cells: {
      left: [
        [1, 0],
        [2, 0],
        [1, 1],
        [2, 1],
      ],
      right: [
        [1, 0],
        [2, 0],
        [1, 1],
        [2, 1],
      ],
      spawn: [
        [1, 0],
        [2, 0],
        [1, 1],
        [2, 1],
      ],
      two: [
        [1, 0],
        [2, 0],
        [1, 1],
        [2, 1],
      ],
    },
    color: "#FFFF00", // O - yellow
    id: "O",
    spawnTopLeft: [4, -2],
  },
  S: {
    cells: {
      left: [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 2],
      ],
      right: [
        [1, 0],
        [1, 1],
        [2, 1],
        [2, 2],
      ],
      spawn: [
        [1, 0],
        [2, 0],
        [0, 1],
        [1, 1],
      ],
      two: [
        [1, 1],
        [2, 1],
        [0, 2],
        [1, 2],
      ],
    },
    color: "#00FF00", // S - green
    id: "S",
    spawnTopLeft: [3, -2],
  },
  T: {
    cells: {
      left: [
        [1, 0],
        [0, 1],
        [1, 1],
        [1, 2],
      ],
      right: [
        [1, 0],
        [1, 1],
        [2, 1],
        [1, 2],
      ],
      spawn: [
        [1, 0],
        [0, 1],
        [1, 1],
        [2, 1],
      ],
      two: [
        [0, 1],
        [1, 1],
        [2, 1],
        [1, 2],
      ],
    },
    color: "#FF00FF", // T - magenta
    id: "T",
    spawnTopLeft: [3, -2],
  },
  Z: {
    cells: {
      left: [
        [1, 0],
        [0, 1],
        [1, 1],
        [0, 2],
      ],
      right: [
        [2, 0],
        [1, 1],
        [2, 1],
        [1, 2],
      ],
      spawn: [
        [0, 0],
        [1, 0],
        [1, 1],
        [2, 1],
      ],
      two: [
        [0, 1],
        [1, 1],
        [1, 2],
        [2, 2],
      ],
    },
    color: "#FF0000", // Z - red
    id: "Z",
    spawnTopLeft: [3, -2],
  },
};
