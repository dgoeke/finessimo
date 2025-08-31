import { describe, it, expect } from "@jest/globals";

import { cellsForActivePiece } from "../../src/engine/util/cell-projection";
import { createGridCoord } from "../../src/types/brands";

import type { ActivePiece } from "../../src/state/types";

describe("cell-projection.ts", () => {
  describe("cellsForActivePiece", () => {
    it("should project T-piece at origin in spawn rotation", () => {
      const tPiece: ActivePiece = {
        id: "T" as const,
        rot: "spawn",
        x: createGridCoord(0),
        y: createGridCoord(0),
      };

      const cells = cellsForActivePiece(tPiece);

      // T-piece spawn shape:
      // .#.
      // ###
      // Expected: [(1,0), (0,1), (1,1), (2,1)] based on actual PIECES data
      expect(cells).toHaveLength(4);

      const cellCoords = cells.map(([x, y]) => [
        x as unknown as number,
        y as unknown as number,
      ]);
      expect(cellCoords).toEqual(
        expect.arrayContaining([
          [1, 0],
          [0, 1],
          [1, 1],
          [2, 1],
        ]),
      );
    });

    it("should project I-piece at origin in spawn rotation", () => {
      const iPiece: ActivePiece = {
        id: "I" as const,
        rot: "spawn",
        x: createGridCoord(0),
        y: createGridCoord(0),
      };

      const cells = cellsForActivePiece(iPiece);

      // I-piece spawn shape: ####
      // Expected: [(0,1), (1,1), (2,1), (3,1)] based on actual PIECES data
      expect(cells).toHaveLength(4);

      const cellCoords = cells.map(([x, y]) => [
        x as unknown as number,
        y as unknown as number,
      ]);
      expect(cellCoords).toEqual(
        expect.arrayContaining([
          [0, 1],
          [1, 1],
          [2, 1],
          [3, 1],
        ]),
      );
    });

    it("should apply piece position offset correctly", () => {
      const tPiece: ActivePiece = {
        id: "T" as const,
        rot: "spawn",
        x: createGridCoord(5),
        y: createGridCoord(10),
      };

      const cells = cellsForActivePiece(tPiece);

      // T-piece at (5,10): should be offset by piece position
      const cellCoords = cells.map(([x, y]) => [
        x as unknown as number,
        y as unknown as number,
      ]);
      expect(cellCoords).toEqual(
        expect.arrayContaining([
          [6, 10],
          [5, 11],
          [6, 11],
          [7, 11],
        ]),
      );
    });

    it("should handle different rotations correctly", () => {
      const tPieceSpawn: ActivePiece = {
        id: "T" as const,
        rot: "spawn",
        x: createGridCoord(0),
        y: createGridCoord(0),
      };

      const tPieceRight: ActivePiece = {
        id: "T" as const,
        rot: "right",
        x: createGridCoord(0),
        y: createGridCoord(0),
      };

      const spawnCells = cellsForActivePiece(tPieceSpawn);
      const rightCells = cellsForActivePiece(tPieceRight);

      // Different rotations should produce different cell arrangements
      expect(spawnCells).toHaveLength(4);
      expect(rightCells).toHaveLength(4);
      expect(spawnCells).not.toEqual(rightCells);
    });

    it("should handle O-piece (all rotations identical)", () => {
      const oPiece: ActivePiece = {
        id: "O" as const,
        rot: "spawn",
        x: createGridCoord(0),
        y: createGridCoord(0),
      };

      const cells = cellsForActivePiece(oPiece);

      // O-piece: 2x2 square
      expect(cells).toHaveLength(4);

      const cellCoords = cells.map(([x, y]) => [
        x as unknown as number,
        y as unknown as number,
      ]);
      expect(cellCoords).toEqual(
        expect.arrayContaining([
          [1, 0],
          [2, 0],
          [1, 1],
          [2, 1],
        ]),
      );
    });

    it("should handle all piece types without throwing", () => {
      const pieceTypes: Array<ActivePiece["id"]> = [
        "I",
        "O",
        "T",
        "S",
        "Z",
        "J",
        "L",
      ];
      const rotations: Array<ActivePiece["rot"]> = ["spawn", "right", "left"];

      pieceTypes.forEach((id) => {
        rotations.forEach((rot) => {
          const piece: ActivePiece = {
            id,
            rot,
            x: createGridCoord(0),
            y: createGridCoord(0),
          };

          expect(() => cellsForActivePiece(piece)).not.toThrow();

          const cells = cellsForActivePiece(piece);
          expect(cells).toHaveLength(4);
          expect(Array.isArray(cells)).toBe(true);

          // Verify each cell is a coordinate tuple
          cells.forEach((cell) => {
            expect(Array.isArray(cell)).toBe(true);
            expect(cell).toHaveLength(2);
          });
        });
      });
    });
  });
});
