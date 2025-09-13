// Tests for @/engine/core/pieces.ts
import { PIECES } from "@/engine/core/pieces";

import type { PieceId, Rot } from "@/engine/core/types";

// Helper functions for testing
function normalizeCells(
  cells: ReadonlyArray<readonly [number, number]>,
): ReadonlyArray<readonly [number, number]> {
  return [...cells].sort((a, b) => {
    if (a[1] !== b[1]) return a[1] - b[1]; // Sort by y first
    return a[0] - b[0]; // Then by x
  });
}

function areCellSetsEqual(
  a: ReadonlyArray<readonly [number, number]>,
  b: ReadonlyArray<readonly [number, number]>,
): boolean {
  if (a.length !== b.length) return false;
  const aNorm = normalizeCells(a);
  const bNorm = normalizeCells(b);
  return aNorm.every(([x, y], i) => {
    const bCell = bNorm[i];
    if (!bCell) return false;
    const [bx, by] = bCell;
    return x === bx && y === by;
  });
}

function getCellBounds(cells: ReadonlyArray<readonly [number, number]>): {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
} {
  if (cells.length === 0) {
    throw new Error("Cannot get bounds of empty cell array");
  }

  const firstCell = cells[0];
  if (!firstCell) {
    throw new Error("Cannot get bounds of empty cell array");
  }

  let minX = firstCell[0];
  let maxX = firstCell[0];
  let minY = firstCell[1];
  let maxY = firstCell[1];

  for (const [x, y] of cells) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  return { maxX, maxY, minX, minY };
}

function fitsInSRSBox(
  cells: ReadonlyArray<readonly [number, number]>,
): boolean {
  const bounds = getCellBounds(cells);
  const width = bounds.maxX - bounds.minX + 1;
  const height = bounds.maxY - bounds.minY + 1;
  return width <= 4 && height <= 4;
}

const ALL_PIECE_IDS: ReadonlyArray<PieceId> = [
  "I",
  "O",
  "T",
  "S",
  "Z",
  "J",
  "L",
] as const;
const ALL_ROTATIONS: ReadonlyArray<Rot> = [
  "spawn",
  "right",
  "two",
  "left",
] as const;

describe("@/engine/core/pieces — shape sanity", () => {
  test("Each piece has four rotations (spawn/right/two/left) with exactly 4 cells", () => {
    for (const pieceId of ALL_PIECE_IDS) {
      const piece = PIECES[pieceId];

      // Each piece should have all 4 rotations
      for (const rot of ALL_ROTATIONS) {
        expect(piece.cells[rot]).toBeDefined();
        expect(piece.cells[rot]).toHaveLength(4);

        // Each cell should be a valid [x, y] coordinate pair
        for (const [x, y] of piece.cells[rot]) {
          expect(typeof x).toBe("number");
          expect(typeof y).toBe("number");
          expect(Number.isInteger(x)).toBe(true);
          expect(Number.isInteger(y)).toBe(true);
        }
      }

      // Verify piece has the expected properties
      expect(piece.id).toBe(pieceId);
      expect(typeof piece.color).toBe("string");
      expect(piece.spawnTopLeft).toHaveLength(2);
      expect(typeof piece.spawnTopLeft[0]).toBe("number");
      expect(typeof piece.spawnTopLeft[1]).toBe("number");
    }
  });

  test("O-piece rotations are identical sets; I/J/L/S/T/Z follow SRS footprint expectations", () => {
    // Test O-piece rotations are identical
    const oPiece = PIECES.O;
    const oSpawnCells = oPiece.cells.spawn;

    for (const rot of ALL_ROTATIONS) {
      expect(areCellSetsEqual(oPiece.cells[rot], oSpawnCells)).toBe(true);
    }

    // Test other pieces follow SRS footprint expectations
    const nonOPieces: ReadonlyArray<PieceId> = [
      "I",
      "J",
      "L",
      "S",
      "T",
      "Z",
    ] as const;

    for (const pieceId of nonOPieces) {
      const piece = PIECES[pieceId];

      // Each rotation should fit within SRS 4x4 bounding box
      for (const rot of ALL_ROTATIONS) {
        expect(fitsInSRSBox(piece.cells[rot])).toBe(true);
      }

      // Rotations should be distinct for non-O pieces
      const rotations = ALL_ROTATIONS.map((rot) => piece.cells[rot]);

      // Check that all rotations are different from each other
      for (let i = 0; i < rotations.length; i++) {
        for (let j = i + 1; j < rotations.length; j++) {
          const rotA = rotations[i];
          const rotB = rotations[j];
          if (rotA && rotB) {
            expect(areCellSetsEqual(rotA, rotB)).toBe(false);
          }
        }
      }
    }

    // Verify I-piece has the characteristic long shapes
    const iPiece = PIECES.I;
    const iSpawn = getCellBounds(iPiece.cells.spawn);
    const iRight = getCellBounds(iPiece.cells.right);

    // Spawn and two rotations should be horizontal (width = 4, height = 1)
    expect(iSpawn.maxX - iSpawn.minX + 1).toBe(4);
    expect(iSpawn.maxY - iSpawn.minY + 1).toBe(1);

    // Right and left rotations should be vertical (width = 1, height = 4)
    expect(iRight.maxX - iRight.minX + 1).toBe(1);
    expect(iRight.maxY - iRight.minY + 1).toBe(4);
  });

  test("spawnTopLeft values position spawn boxes correctly relative to SRS", () => {
    // All pieces should spawn at [3, -2] per SRS guidelines
    const expectedSpawnPosition = [3, -2] as const;

    for (const pieceId of ALL_PIECE_IDS) {
      const piece = PIECES[pieceId];

      expect(piece.spawnTopLeft).toEqual(expectedSpawnPosition);
    }

    // Additional validation: spawn cells should be positioned correctly
    // relative to spawnTopLeft for standard Tetris pieces
    for (const pieceId of ALL_PIECE_IDS) {
      const piece = PIECES[pieceId];
      const [spawnX, spawnY] = piece.spawnTopLeft;
      const spawnCells = piece.cells.spawn;

      // All spawn cells should be within reasonable bounds relative to spawn position
      for (const [cellX, cellY] of spawnCells) {
        // Cells should be within a 4x4 box from spawn position
        expect(cellX).toBeGreaterThanOrEqual(0);
        expect(cellX).toBeLessThan(4);
        expect(cellY).toBeGreaterThanOrEqual(0);
        expect(cellY).toBeLessThan(4);

        // When placed at spawn position, pieces should fit within board bounds
        const absoluteX = spawnX + cellX;
        const absoluteY = spawnY + cellY;

        // Should fit horizontally in 10-wide board
        expect(absoluteX).toBeGreaterThanOrEqual(0);
        expect(absoluteX).toBeLessThan(10);

        // Should be above or at the visible area (y >= -3 for vanish zone)
        expect(absoluteY).toBeGreaterThanOrEqual(-3);
      }
    }

    // Specific validation for known piece shapes
    // I-piece spawn should be the horizontal line
    const iPieceSpawn = PIECES.I.cells.spawn;
    expect(iPieceSpawn).toEqual([
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ]);

    // O-piece spawn should be the 2x2 square
    const oPieceSpawn = PIECES.O.cells.spawn;
    expect(normalizeCells(oPieceSpawn)).toEqual([
      [1, 0],
      [2, 0],
      [1, 1],
      [2, 1],
    ]);

    // T-piece spawn should be the T shape
    const tPieceSpawn = PIECES.T.cells.spawn;
    expect(normalizeCells(tPieceSpawn)).toEqual([
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ]);
  });
});
