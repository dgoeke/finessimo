// Board dimensions and vanish zone constants
export const BOARD_WIDTH = 10 as const;
export const VISIBLE_HEIGHT = 20 as const; // rows 0..19
export const VANISH_ROWS = 3 as const; // rows -3..-1
export const TOTAL_HEIGHT = 23 as const; // VISIBLE_HEIGHT + VANISH_ROWS

// Grid coordinates - for board positions (must be integers)
declare const GridCoordBrand: unique symbol;
export type GridCoord = number & { readonly [GridCoordBrand]: true };
export const gridCoordAsNumber = (g: GridCoord): number => g as number;

// Cell values - 0=empty, 1-7=tetrominos, 8=garbage
declare const CellValueBrand: unique symbol;
export type CellValue = (0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8) & {
  readonly [CellValueBrand]: true;
};

// GridCoord constructors and guards
export function createGridCoord(value: number): GridCoord {
  if (!Number.isInteger(value)) {
    throw new Error("GridCoord must be an integer");
  }
  return value as GridCoord;
}

export function isGridCoord(n: unknown): n is GridCoord {
  return typeof n === "number" && Number.isInteger(n);
}

export function assertGridCoord(n: unknown): asserts n is GridCoord {
  if (!isGridCoord(n)) throw new Error("Not a valid GridCoord");
}

// CellValue constructors and guards
export function createCellValue(value: number): CellValue {
  if (!Number.isInteger(value) || value < 0 || value > 8) {
    throw new Error("CellValue must be an integer from 0 to 8");
  }
  return value as CellValue;
}

export function isCellValue(n: unknown): n is CellValue {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 8;
}

export function assertCellValue(n: unknown): asserts n is CellValue {
  if (!isCellValue(n)) throw new Error("Not a valid CellValue");
}

// Board representation with enforced dimensions
declare const BoardCellsBrand: unique symbol;
export type BoardCells = Uint8Array & { readonly length: 230 } & {
  readonly [BoardCellsBrand]: true;
};

// BoardCells constructor
export function createBoardCells(): BoardCells {
  return new Uint8Array(TOTAL_HEIGHT * BOARD_WIDTH) as BoardCells;
}

export type Board = {
  readonly width: 10;
  readonly height: 20; // visible height only
  readonly vanishRows: 3; // additional rows above visible area (-3..-1)
  readonly totalHeight: 23; // total including vanish rows
  readonly cells: BoardCells; // exactly 230 cells (23×10), values: 0..8 (0=empty, 1-7=tetrominos, 8=garbage)
};

// Helper for array indexing with vanish zone awareness
export function idx(board: Board, x: GridCoord, y: GridCoord): number {
  const xNum = gridCoordAsNumber(x);
  const yNum = gridCoordAsNumber(y);
  // Storage row 0 corresponds to y = -board.vanishRows
  const storageRow = yNum + board.vanishRows; // e.g., y = -3 → 0; y = 0 → 3
  return storageRow * board.width + xNum;
}

// Safe indexer with bounds checking
export function idxSafe(board: Board, x: GridCoord, y: GridCoord): number {
  const xNum = gridCoordAsNumber(x);
  const yNum = gridCoordAsNumber(y);
  if (
    xNum < 0 ||
    xNum >= board.width ||
    yNum < -board.vanishRows ||
    yNum >= board.height
  ) {
    throw new Error("idxSafe: out-of-bounds");
  }
  return idx(board, x, y);
}

// Collision check with vanish zone support - treats -3..-1 as collidable
export function isCellBlocked(
  board: Board,
  x: GridCoord,
  y: GridCoord
): boolean {
  const xNum = gridCoordAsNumber(x);
  const yNum = gridCoordAsNumber(y);

  // Out-of-bounds horizontally or below bottom
  if (xNum < 0 || xNum >= board.width) return true;
  if (yNum >= board.height) return true; // below visible bottom → blocked

  // Above the stored top (beyond vanish zone) → blocked
  if (yNum < -board.vanishRows) return true;

  // Collidable in both vanish (−3..−1) and visible (0..19) ranges
  return board.cells[idx(board, x, y)] !== 0;
}

// Pieces and rotation
export type PieceId = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
export type Rot = "spawn" | "right" | "two" | "left";

export type TetrominoShape = {
  id: PieceId;
  cells: Record<Rot, ReadonlyArray<readonly [number, number]>>;
  spawnTopLeft: readonly [number, number];
  color: string;
};

export type ActivePiece = {
  id: PieceId;
  rot: Rot;
  x: GridCoord;
  y: GridCoord;
};
