import { describe, it, expect } from "@jest/globals";

import {
  // Constructor functions
  asCellSizePx,
  asBoardCols,
  asVisibleRows,
  asVanishRows,
  asPixelX,
  asPixelY,
  asCanvasCol,
  asCanvasRow,

  // Grid-to-canvas conversion
  gridToCanvasRow,

  // Conversion helpers
  cellSizePxAsNumber,
  boardColsAsNumber,
  visibleRowsAsNumber,
  vanishRowsAsNumber,
  pixelXAsNumber,
  pixelYAsNumber,
  canvasColAsNumber,
  canvasRowAsNumber,

  // Types
  type CellSizePx,
  type BoardCols,
  type VisibleRows,
  type VanishRows,
  type PixelX,
  type PixelY,
  type CanvasCol,
  type CanvasRow,
  type BoardViewport,
} from "@/ui/types/brands-render";

describe("ui/types/brands-render", () => {
  describe("CellSizePx brand", () => {
    it("asCellSizePx accepts positive finite numbers", () => {
      expect(asCellSizePx(30)).toBe(30 as CellSizePx);
      expect(asCellSizePx(1)).toBe(1 as CellSizePx);
      expect(asCellSizePx(100.5)).toBe(100.5 as CellSizePx);
      expect(asCellSizePx(0.1)).toBe(0.1 as CellSizePx);
    });

    it("asCellSizePx rejects zero", () => {
      expect(() => asCellSizePx(0)).toThrow(
        "CellSizePx must be a positive finite number",
      );
    });

    it("asCellSizePx rejects negative numbers", () => {
      expect(() => asCellSizePx(-1)).toThrow(
        "CellSizePx must be a positive finite number",
      );
      expect(() => asCellSizePx(-30.5)).toThrow(
        "CellSizePx must be a positive finite number",
      );
    });

    it("asCellSizePx rejects infinite values", () => {
      expect(() => asCellSizePx(Infinity)).toThrow(
        "CellSizePx must be a positive finite number",
      );
      expect(() => asCellSizePx(-Infinity)).toThrow(
        "CellSizePx must be a positive finite number",
      );
    });

    it("asCellSizePx rejects NaN", () => {
      expect(() => asCellSizePx(NaN)).toThrow(
        "CellSizePx must be a positive finite number",
      );
    });

    it("cellSizePxAsNumber converts branded value back to number", () => {
      const branded = asCellSizePx(42.5);
      expect(cellSizePxAsNumber(branded)).toBe(42.5);
    });

    it("cellSizePxAsNumber preserves exact value", () => {
      const original = 30;
      const branded = asCellSizePx(original);
      const converted = cellSizePxAsNumber(branded);
      expect(converted).toBe(original);
    });

    it("cellSizePxAsNumber maintains type safety at TypeScript level", () => {
      const branded = asCellSizePx(25);
      const result: number = cellSizePxAsNumber(branded);
      expect(typeof result).toBe("number");
    });
  });

  describe("BoardCols brand", () => {
    it("asBoardCols accepts positive integers", () => {
      expect(asBoardCols(10)).toBe(10 as BoardCols);
      expect(asBoardCols(1)).toBe(1 as BoardCols);
      expect(asBoardCols(50)).toBe(50 as BoardCols);
    });

    it("asBoardCols rejects zero", () => {
      expect(() => asBoardCols(0)).toThrow(
        "BoardCols must be a positive integer",
      );
    });

    it("asBoardCols rejects negative integers", () => {
      expect(() => asBoardCols(-1)).toThrow(
        "BoardCols must be a positive integer",
      );
      expect(() => asBoardCols(-10)).toThrow(
        "BoardCols must be a positive integer",
      );
    });

    it("asBoardCols rejects non-integers", () => {
      expect(() => asBoardCols(10.5)).toThrow(
        "BoardCols must be a positive integer",
      );
      expect(() => asBoardCols(3.14159)).toThrow(
        "BoardCols must be a positive integer",
      );
    });

    it("asBoardCols rejects infinite values", () => {
      expect(() => asBoardCols(Infinity)).toThrow(
        "BoardCols must be a positive integer",
      );
      expect(() => asBoardCols(-Infinity)).toThrow(
        "BoardCols must be a positive integer",
      );
    });

    it("asBoardCols rejects NaN", () => {
      expect(() => asBoardCols(NaN)).toThrow(
        "BoardCols must be a positive integer",
      );
    });

    it("boardColsAsNumber converts branded value back to number", () => {
      const branded = asBoardCols(8);
      expect(boardColsAsNumber(branded)).toBe(8);
    });
  });

  describe("VisibleRows brand", () => {
    it("asVisibleRows accepts positive integers", () => {
      expect(asVisibleRows(20)).toBe(20 as VisibleRows);
      expect(asVisibleRows(1)).toBe(1 as VisibleRows);
      expect(asVisibleRows(100)).toBe(100 as VisibleRows);
    });

    it("asVisibleRows rejects zero", () => {
      expect(() => asVisibleRows(0)).toThrow(
        "VisibleRows must be a positive integer",
      );
    });

    it("asVisibleRows rejects negative integers", () => {
      expect(() => asVisibleRows(-1)).toThrow(
        "VisibleRows must be a positive integer",
      );
      expect(() => asVisibleRows(-20)).toThrow(
        "VisibleRows must be a positive integer",
      );
    });

    it("asVisibleRows rejects non-integers", () => {
      expect(() => asVisibleRows(20.5)).toThrow(
        "VisibleRows must be a positive integer",
      );
    });

    it("asVisibleRows rejects infinite values", () => {
      expect(() => asVisibleRows(Infinity)).toThrow(
        "VisibleRows must be a positive integer",
      );
    });

    it("asVisibleRows rejects NaN", () => {
      expect(() => asVisibleRows(NaN)).toThrow(
        "VisibleRows must be a positive integer",
      );
    });

    it("visibleRowsAsNumber converts branded value back to number", () => {
      const branded = asVisibleRows(16);
      expect(visibleRowsAsNumber(branded)).toBe(16);
    });
  });

  describe("VanishRows brand", () => {
    it("asVanishRows accepts zero", () => {
      expect(asVanishRows(0)).toBe(0 as VanishRows);
    });

    it("asVanishRows accepts positive integers", () => {
      expect(asVanishRows(4)).toBe(4 as VanishRows);
      expect(asVanishRows(1)).toBe(1 as VanishRows);
      expect(asVanishRows(10)).toBe(10 as VanishRows);
    });

    it("asVanishRows rejects negative integers", () => {
      expect(() => asVanishRows(-1)).toThrow(
        "VanishRows must be a non-negative integer",
      );
      expect(() => asVanishRows(-4)).toThrow(
        "VanishRows must be a non-negative integer",
      );
    });

    it("asVanishRows rejects non-integers", () => {
      expect(() => asVanishRows(4.5)).toThrow(
        "VanishRows must be a non-negative integer",
      );
      expect(() => asVanishRows(0.1)).toThrow(
        "VanishRows must be a non-negative integer",
      );
    });

    it("asVanishRows rejects infinite values", () => {
      expect(() => asVanishRows(Infinity)).toThrow(
        "VanishRows must be a non-negative integer",
      );
      expect(() => asVanishRows(-Infinity)).toThrow(
        "VanishRows must be a non-negative integer",
      );
    });

    it("asVanishRows rejects NaN", () => {
      expect(() => asVanishRows(NaN)).toThrow(
        "VanishRows must be a non-negative integer",
      );
    });

    it("vanishRowsAsNumber converts branded value back to number", () => {
      const branded = asVanishRows(3);
      expect(vanishRowsAsNumber(branded)).toBe(3);
    });

    it("vanishRowsAsNumber handles zero correctly", () => {
      const branded = asVanishRows(0);
      expect(vanishRowsAsNumber(branded)).toBe(0);
    });
  });

  describe("Pixel coordinate brands", () => {
    it("asPixelX accepts any number", () => {
      expect(asPixelX(100)).toBe(100 as PixelX);
      expect(asPixelX(0)).toBe(0 as PixelX);
      expect(asPixelX(-50)).toBe(-50 as PixelX);
      expect(asPixelX(123.456)).toBe(123.456 as PixelX);
    });

    it("asPixelX accepts infinite values", () => {
      expect(asPixelX(Infinity)).toBe(Infinity as PixelX);
      expect(asPixelX(-Infinity)).toBe(-Infinity as PixelX);
    });

    it("asPixelX accepts NaN", () => {
      expect(Number.isNaN(asPixelX(NaN) as number)).toBe(true);
    });

    it("asPixelY accepts any number", () => {
      expect(asPixelY(200)).toBe(200 as PixelY);
      expect(asPixelY(0)).toBe(0 as PixelY);
      expect(asPixelY(-100)).toBe(-100 as PixelY);
      expect(asPixelY(456.789)).toBe(456.789 as PixelY);
    });

    it("asPixelY accepts infinite values", () => {
      expect(asPixelY(Infinity)).toBe(Infinity as PixelY);
      expect(asPixelY(-Infinity)).toBe(-Infinity as PixelY);
    });

    it("asPixelY accepts NaN", () => {
      expect(Number.isNaN(asPixelY(NaN) as number)).toBe(true);
    });

    it("pixelXAsNumber converts branded value back to number", () => {
      const branded = asPixelX(250);
      expect(pixelXAsNumber(branded)).toBe(250);
    });

    it("pixelXAsNumber preserves fractional values", () => {
      const branded = asPixelX(123.456);
      expect(pixelXAsNumber(branded)).toBe(123.456);
    });

    it("pixelYAsNumber converts branded value back to number", () => {
      const branded = asPixelY(350);
      expect(pixelYAsNumber(branded)).toBe(350);
    });

    it("pixelYAsNumber preserves negative values", () => {
      const branded = asPixelY(-50);
      expect(pixelYAsNumber(branded)).toBe(-50);
    });
  });

  describe("Canvas coordinate brands", () => {
    it("asCanvasCol accepts any number", () => {
      expect(asCanvasCol(5)).toBe(5 as CanvasCol);
      expect(asCanvasCol(0)).toBe(0 as CanvasCol);
      expect(asCanvasCol(-2)).toBe(-2 as CanvasCol);
      expect(asCanvasCol(7.5)).toBe(7.5 as CanvasCol);
    });

    it("asCanvasRow accepts any number", () => {
      expect(asCanvasRow(10)).toBe(10 as CanvasRow);
      expect(asCanvasRow(0)).toBe(0 as CanvasRow);
      expect(asCanvasRow(-1)).toBe(-1 as CanvasRow);
      expect(asCanvasRow(12.25)).toBe(12.25 as CanvasRow);
    });

    it("canvasColAsNumber converts branded value back to number", () => {
      const branded = asCanvasCol(6);
      expect(canvasColAsNumber(branded)).toBe(6);
    });

    it("canvasRowAsNumber converts branded value back to number", () => {
      const branded = asCanvasRow(15);
      expect(canvasRowAsNumber(branded)).toBe(15);
    });
  });

  describe("gridToCanvasRow", () => {
    it("converts grid coordinates to canvas coordinates", () => {
      const vanishRows = asVanishRows(4);

      // Grid y=-2 (vanish zone) → Canvas y=2
      expect(canvasRowAsNumber(gridToCanvasRow(-2, vanishRows))).toBe(2);

      // Grid y=-1 (vanish zone) → Canvas y=3
      expect(canvasRowAsNumber(gridToCanvasRow(-1, vanishRows))).toBe(3);

      // Grid y=0 (top of play area) → Canvas y=4
      expect(canvasRowAsNumber(gridToCanvasRow(0, vanishRows))).toBe(4);

      // Grid y=19 (bottom of play area) → Canvas y=23
      expect(canvasRowAsNumber(gridToCanvasRow(19, vanishRows))).toBe(23);
    });

    it("handles zero vanish rows", () => {
      const vanishRows = asVanishRows(0);

      // No vanish zone offset
      expect(canvasRowAsNumber(gridToCanvasRow(0, vanishRows))).toBe(0);
      expect(canvasRowAsNumber(gridToCanvasRow(10, vanishRows))).toBe(10);
      expect(canvasRowAsNumber(gridToCanvasRow(-5, vanishRows))).toBe(-5);
    });

    it("handles different vanish zone sizes", () => {
      const smallVanish = asVanishRows(2);
      const largeVanish = asVanishRows(8);

      // Same grid coordinate, different vanish zones
      expect(canvasRowAsNumber(gridToCanvasRow(5, smallVanish))).toBe(7); // 5 + 2
      expect(canvasRowAsNumber(gridToCanvasRow(5, largeVanish))).toBe(13); // 5 + 8
    });

    it("handles negative grid coordinates", () => {
      const vanishRows = asVanishRows(4);

      // Negative grid coordinates (above board)
      expect(canvasRowAsNumber(gridToCanvasRow(-4, vanishRows))).toBe(0); // Top of vanish zone
      expect(canvasRowAsNumber(gridToCanvasRow(-3, vanishRows))).toBe(1);
    });

    it("handles large grid coordinates", () => {
      const vanishRows = asVanishRows(4);

      // Large positive coordinates (below board)
      expect(canvasRowAsNumber(gridToCanvasRow(100, vanishRows))).toBe(104);
      expect(canvasRowAsNumber(gridToCanvasRow(1000, vanishRows))).toBe(1004);
    });

    it("handles fractional grid coordinates", () => {
      const vanishRows = asVanishRows(4);

      // Fractional coordinates (e.g., during tweening)
      expect(canvasRowAsNumber(gridToCanvasRow(5.5, vanishRows))).toBe(9.5);
      expect(canvasRowAsNumber(gridToCanvasRow(-1.25, vanishRows))).toBe(2.75);
    });

    it("maintains mathematical invariant", () => {
      const vanishRows = asVanishRows(6);
      const gridY = 12;

      // INVARIANT: canvasRow = gridRow + vanishRows
      const canvasY = gridToCanvasRow(gridY, vanishRows);
      expect(canvasRowAsNumber(canvasY)).toBe(
        gridY + vanishRowsAsNumber(vanishRows),
      );
    });

    it("is consistent across coordinate transformations", () => {
      const vanishRows = asVanishRows(3);
      const testCoordinates = [-10, -3, -2, -1, 0, 1, 5, 10, 20];

      for (const gridY of testCoordinates) {
        const canvasY = gridToCanvasRow(gridY, vanishRows);
        const expectedCanvasY = gridY + 3;
        expect(canvasRowAsNumber(canvasY)).toBe(expectedCanvasY);
      }
    });
  });

  describe("BoardViewport type", () => {
    it("can be constructed with all required branded types", () => {
      const viewport: BoardViewport = {
        cell: asCellSizePx(30),
        cols: asBoardCols(10),
        vanishRows: asVanishRows(4),
        visibleRows: asVisibleRows(20),
      };

      expect(boardColsAsNumber(viewport.cols)).toBe(10);
      expect(visibleRowsAsNumber(viewport.visibleRows)).toBe(20);
      expect(vanishRowsAsNumber(viewport.vanishRows)).toBe(4);
      expect(cellSizePxAsNumber(viewport.cell)).toBe(30);
    });

    it("maintains readonly properties", () => {
      const viewport: BoardViewport = {
        cell: asCellSizePx(25),
        cols: asBoardCols(8),
        vanishRows: asVanishRows(2),
        visibleRows: asVisibleRows(16),
      };

      // TypeScript should enforce readonly properties
      expect(typeof viewport.cols).toBe("number");
      expect(typeof viewport.visibleRows).toBe("number");
      expect(typeof viewport.vanishRows).toBe("number");
      expect(typeof viewport.cell).toBe("number");
    });

    it("can represent different viewport configurations", () => {
      const standardViewport: BoardViewport = {
        cell: asCellSizePx(30),
        cols: asBoardCols(10),
        vanishRows: asVanishRows(4),
        visibleRows: asVisibleRows(20),
      };

      const miniViewport: BoardViewport = {
        cell: asCellSizePx(20),
        cols: asBoardCols(6),
        vanishRows: asVanishRows(0),
        visibleRows: asVisibleRows(12),
      };

      const largeViewport: BoardViewport = {
        cell: asCellSizePx(40),
        cols: asBoardCols(15),
        vanishRows: asVanishRows(8),
        visibleRows: asVisibleRows(25),
      };

      // All should be valid BoardViewport instances
      expect(standardViewport.cols).toBeDefined();
      expect(miniViewport.cols).toBeDefined();
      expect(largeViewport.cols).toBeDefined();
    });
  });

  describe("type safety and brand isolation", () => {
    it("prevents mixing different branded types at TypeScript level", () => {
      const cellSize = asCellSizePx(30);
      const cols = asBoardCols(10);

      // These should be different types even though both are numbers
      expect(typeof cellSize).toBe("number");
      expect(typeof cols).toBe("number");

      // But they are branded differently (verified by TypeScript compiler)
      expect(cellSizePxAsNumber(cellSize)).toBe(30);
      expect(boardColsAsNumber(cols)).toBe(10);
    });

    it("maintains brand identity through conversion round-trips", () => {
      const originalCellSize = 42.5;
      const brandedCellSize = asCellSizePx(originalCellSize);
      const convertedBack = cellSizePxAsNumber(brandedCellSize);

      expect(convertedBack).toBe(originalCellSize);
      expect(convertedBack).toStrictEqual(originalCellSize);
    });

    it("preserves precision through conversions", () => {
      const preciseCellSize = 30.123456789;
      const branded = asCellSizePx(preciseCellSize);
      const converted = cellSizePxAsNumber(branded);

      expect(converted).toBe(preciseCellSize);
    });

    it("works with all numeric edge cases", () => {
      // Test various numeric edge cases for unconstrained brands
      const edgeCases = [0, -0, 0.1, -0.1, Number.MIN_VALUE, Number.MAX_VALUE];

      for (const value of edgeCases) {
        const pixelX = asPixelX(value);
        const pixelY = asPixelY(value);

        expect(pixelXAsNumber(pixelX)).toBe(value);
        expect(pixelYAsNumber(pixelY)).toBe(value);
      }
    });

    it("enforces constraints consistently", () => {
      // All these should throw for their respective constraints

      // Test positive constraints
      expect(() => asCellSizePx(-1)).toThrow();
      expect(() => asCellSizePx(0)).toThrow();
      expect(() => asCellSizePx(-10)).toThrow();

      expect(() => asBoardCols(-1)).toThrow();
      expect(() => asBoardCols(0)).toThrow();
      expect(() => asBoardCols(-10)).toThrow();

      expect(() => asVisibleRows(-1)).toThrow();
      expect(() => asVisibleRows(0)).toThrow();
      expect(() => asVisibleRows(-10)).toThrow();

      // Test non-negative constraints (vanish rows can be 0)
      expect(() => asVanishRows(-1)).toThrow();
      expect(() => asVanishRows(-10)).toThrow();

      // Test integer constraints
      expect(() => asBoardCols(3.14)).toThrow();
      expect(() => asVisibleRows(3.14)).toThrow();
      expect(() => asVanishRows(3.14)).toThrow();
    });
  });
});
