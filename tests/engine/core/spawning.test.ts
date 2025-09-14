import { createEmptyBoard, lockPiece } from "@/engine/core/board";
import {
  createActivePiece,
  isTopOut,
  isPieceEntirelyInVanishZone,
  canSpawnPiece,
} from "@/engine/core/spawning";
import {
  type Board,
  type PieceId,
  type ActivePiece,
  createGridCoord,
  gridCoordAsNumber,
  isGridCoord,
  idx,
} from "@/engine/core/types";

describe("@/engine/core/spawning — piece creation & collision detection", () => {
  // Helper: All piece IDs for exhaustive testing
  const ALL_PIECES: ReadonlyArray<PieceId> = [
    "I",
    "O",
    "T",
    "S",
    "Z",
    "J",
    "L",
  ] as const;

  // Helper: Create board with specific collisions in vanish zone
  function createBoardWithVanishCollision(): Board {
    const board = createEmptyBoard();
    // Place blocks in vanish zone (y = -1)
    const cells = new Uint8Array(board.cells);
    cells[idx(board, createGridCoord(3), createGridCoord(-1))] = 8; // garbage
    cells[idx(board, createGridCoord(4), createGridCoord(-1))] = 8;
    cells[idx(board, createGridCoord(5), createGridCoord(-1))] = 8;
    return { ...board, cells } as Board;
  }

  // Helper: Create board with collision at visible area (y = 0)
  function createBoardWithVisibleCollision(): Board {
    const board = createEmptyBoard();
    const cells = new Uint8Array(board.cells);
    // Place blocks at top of visible area (y = 0)
    cells[idx(board, createGridCoord(3), createGridCoord(0))] = 8;
    cells[idx(board, createGridCoord(4), createGridCoord(0))] = 8;
    cells[idx(board, createGridCoord(5), createGridCoord(0))] = 8;
    return { ...board, cells } as Board;
  }

  describe("createActivePiece()", () => {
    test("creates ActivePiece for all 7 piece types with spawn orientation", () => {
      ALL_PIECES.forEach((pieceId) => {
        const piece = createActivePiece(pieceId);

        expect(piece.id).toBe(pieceId);
        expect(piece.rot).toBe("spawn");
        expect(isGridCoord(piece.x)).toBe(true);
        expect(isGridCoord(piece.y)).toBe(true);
      });
    });

    test("creates pieces at spawn position [3, -2] for all piece types", () => {
      ALL_PIECES.forEach((pieceId) => {
        const piece = createActivePiece(pieceId);

        expect(gridCoordAsNumber(piece.x)).toBe(3);
        expect(gridCoordAsNumber(piece.y)).toBe(-2);
      });
    });

    test("returns branded GridCoord coordinates", () => {
      const piece = createActivePiece("T");

      // Verify coordinates are properly branded
      expect(isGridCoord(piece.x)).toBe(true);
      expect(isGridCoord(piece.y)).toBe(true);
    });

    test("maintains referential equality for same piece ID calls", () => {
      const piece1 = createActivePiece("O");
      const piece2 = createActivePiece("O");

      // Since SPAWN_ACTIVE is precomputed, should return same reference
      expect(piece1).toBe(piece2);
    });

    test("precomputed pieces are immutable references", () => {
      const piece1 = createActivePiece("I");
      const piece2 = createActivePiece("I");

      // Precomputed objects should have referential equality
      expect(piece1).toBe(piece2);
      expect(piece1).toEqual(piece2);
    });
  });

  describe("canSpawnPiece()", () => {
    test("returns true for all pieces on empty board", () => {
      const emptyBoard = createEmptyBoard();

      ALL_PIECES.forEach((pieceId) => {
        expect(canSpawnPiece(emptyBoard, pieceId)).toBe(true);
      });
    });

    test("returns false when collision occurs in spawn area", () => {
      const boardWithVanishCollision = createBoardWithVanishCollision();

      // I piece has cells at [3,-1], [4,-1], [5,-1], [6,-1] - collides with blocks at 3,4,5
      expect(canSpawnPiece(boardWithVanishCollision, "I")).toBe(false);

      // T piece has cells at [4,-2], [3,-1], [4,-1], [5,-1] - collides with blocks at 3,4,5
      expect(canSpawnPiece(boardWithVanishCollision, "T")).toBe(false);
    });

    test("returns true when pieces do not collide", () => {
      const boardWithVisibleCollision = createBoardWithVisibleCollision();

      // Pieces spawn at y=-2/-1, blocks are at y=0, so no collision
      ALL_PIECES.forEach((pieceId) => {
        expect(canSpawnPiece(boardWithVisibleCollision, pieceId)).toBe(true);
      });
    });
  });

  describe("isTopOut()", () => {
    test("returns false for all pieces on empty board", () => {
      const emptyBoard = createEmptyBoard();

      ALL_PIECES.forEach((pieceId) => {
        expect(isTopOut(emptyBoard, pieceId)).toBe(false);
      });
    });

    test("returns true when pieces cannot spawn due to collision", () => {
      const boardWithVanishCollision = createBoardWithVanishCollision();

      // Should be topped out for pieces that collide
      expect(isTopOut(boardWithVanishCollision, "T")).toBe(true);
      expect(isTopOut(boardWithVanishCollision, "I")).toBe(true);
    });

    test("correctly detects collision vs. vanish zone occupancy", () => {
      const board = createEmptyBoard();
      const cells = new Uint8Array(board.cells);

      // Fill only rows above spawn area
      for (let x = 0; x < 10; x++) {
        cells[idx(board, createGridCoord(x), createGridCoord(-3))] = 8;
      }

      const boardWithHighVanishBlocks = { ...board, cells } as Board;

      // Should still be able to spawn since spawn area is clear
      ALL_PIECES.forEach((pieceId) => {
        expect(isTopOut(boardWithHighVanishBlocks, pieceId)).toBe(false);
      });
    });
  });

  describe("isPieceEntirelyInVanishZone()", () => {
    test("returns true for pieces entirely above y=0", () => {
      // Create piece positioned entirely in vanish zone
      const pieceInVanish: ActivePiece = {
        id: "O",
        rot: "spawn",
        x: createGridCoord(4),
        y: createGridCoord(-3), // O piece at y=-3 should be entirely above y=0
      };

      expect(isPieceEntirelyInVanishZone(pieceInVanish)).toBe(true);
    });

    test("returns true for pieces at spawn position (all spawn in vanish zone)", () => {
      // All pieces spawn entirely within vanish zone at standard spawn position
      ALL_PIECES.forEach((pieceId) => {
        const spawnPiece = createActivePiece(pieceId);
        expect(isPieceEntirelyInVanishZone(spawnPiece)).toBe(true);
      });
    });

    test("returns false for piece with cells at or below y=0", () => {
      const pieceAtVisible: ActivePiece = {
        id: "I",
        rot: "spawn",
        x: createGridCoord(3),
        y: createGridCoord(0), // I piece body at y=1 (spawn + 1)
      };

      expect(isPieceEntirelyInVanishZone(pieceAtVisible)).toBe(false);
    });

    test("handles different piece orientations correctly", () => {
      // Test with different rotations
      const piece: ActivePiece = {
        id: "T",
        rot: "right", // Different rotation
        x: createGridCoord(4),
        y: createGridCoord(-4), // Well above visible area
      };

      expect(isPieceEntirelyInVanishZone(piece)).toBe(true);
    });

    test("correctly calculates for all piece types positioned in vanish zone", () => {
      ALL_PIECES.forEach((pieceId) => {
        const highPiece: ActivePiece = {
          id: pieceId,
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(-5), // All pieces should be entirely in vanish at y=-5
        };

        expect(isPieceEntirelyInVanishZone(highPiece)).toBe(true);
      });
    });
  });

  describe("edge cases and boundaries", () => {
    test("spawn position consistency across all pieces", () => {
      ALL_PIECES.forEach((pieceId) => {
        const piece = createActivePiece(pieceId);
        // All pieces spawn at same x,y but different shapes
        expect(gridCoordAsNumber(piece.x)).toBe(3);
        expect(gridCoordAsNumber(piece.y)).toBe(-2);
      });
    });

    test("vanish zone boundary at y=0", () => {
      const board = createEmptyBoard();
      const cells = new Uint8Array(board.cells);

      // Block exactly at y=0 boundary
      cells[idx(board, createGridCoord(4), createGridCoord(0))] = 8;

      const testBoard = { ...board, cells } as Board;

      // All pieces spawn above y=0, so should not be blocked by y=0 collision
      ALL_PIECES.forEach((pieceId) => {
        expect(canSpawnPiece(testBoard, pieceId)).toBe(true);
      });
    });

    test("immutability of spawning operations", () => {
      const originalBoard = createEmptyBoard();
      const originalCells = originalBoard.cells;

      // Spawning checks should not modify board
      ALL_PIECES.forEach((pieceId) => {
        canSpawnPiece(originalBoard, pieceId);
        isTopOut(originalBoard, pieceId);
      });

      expect(originalBoard.cells).toBe(originalCells);
      expect(originalBoard.cells).toEqual(originalCells);
    });

    test("type safety of branded coordinates", () => {
      const piece = createActivePiece("S");

      // Coordinates should pass type guard checks
      expect(isGridCoord(piece.x)).toBe(true);
      expect(isGridCoord(piece.y)).toBe(true);

      // Should be usable as numbers through accessor
      const xNum = gridCoordAsNumber(piece.x);
      const yNum = gridCoordAsNumber(piece.y);
      expect(typeof xNum).toBe("number");
      expect(typeof yNum).toBe("number");
      expect(Number.isInteger(xNum)).toBe(true);
      expect(Number.isInteger(yNum)).toBe(true);
    });
  });

  describe("integration with board collision system", () => {
    test("spawn collision detection integrates with board state", () => {
      let board = createEmptyBoard();

      // Lock a piece high in vanish zone and verify spawn detection still works
      const testPiece: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: createGridCoord(0), // Far left to avoid spawn area
        y: createGridCoord(-3),
      };
      board = lockPiece(board, testPiece);

      // Should still be able to spawn pieces (no collision with spawn area)
      expect(isTopOut(board, "I")).toBe(false);
    });
  });
});
