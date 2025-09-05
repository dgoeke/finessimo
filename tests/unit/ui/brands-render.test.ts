import { describe, it, expect } from "@jest/globals";

import {
  asCellSizePx,
  asBoardCols,
  asVisibleRows,
  asVanishRows,
  asPixelX,
  asPixelY,
  asCanvasCol,
  asCanvasRow,
  cellSizePxAsNumber,
  boardColsAsNumber,
  visibleRowsAsNumber,
  vanishRowsAsNumber,
  pixelXAsNumber,
  pixelYAsNumber,
  canvasColAsNumber,
  canvasRowAsNumber,
} from "@/ui/types/brands-render";

describe("brands-render types", () => {
  it("asCellSizePx should create from positive numbers", () => {
    expect(asCellSizePx(1)).toBeDefined();
    expect(asCellSizePx(30)).toBeDefined();
    expect(() => asCellSizePx(0)).toThrow();
    expect(() => asCellSizePx(-1)).toThrow();
  });

  it("asBoardCols should create from positive integers", () => {
    expect(asBoardCols(1)).toBeDefined();
    expect(asBoardCols(10)).toBeDefined();
    expect(() => asBoardCols(0)).toThrow();
    expect(() => asBoardCols(1.5)).toThrow();
  });

  it("asVisibleRows should create from positive integers", () => {
    expect(asVisibleRows(1)).toBeDefined();
    expect(asVisibleRows(20)).toBeDefined();
    expect(() => asVisibleRows(0)).toThrow();
    expect(() => asVisibleRows(20.5)).toThrow();
  });

  it("asVanishRows should create from non-negative integers", () => {
    expect(asVanishRows(0)).toBeDefined();
    expect(asVanishRows(5)).toBeDefined();
    expect(() => asVanishRows(-1)).toThrow();
    expect(() => asVanishRows(2.5)).toThrow();
  });

  it("asPixelX and asPixelY should accept any numbers", () => {
    expect(asPixelX(0)).toBeDefined();
    expect(asPixelX(-50)).toBeDefined();
    expect(asPixelY(100)).toBeDefined();
    expect(asPixelY(-25.5)).toBeDefined();
  });

  it("asCanvasCol and asCanvasRow should accept any numbers", () => {
    expect(asCanvasCol(0)).toBeDefined();
    expect(asCanvasCol(10.5)).toBeDefined();
    expect(asCanvasRow(5)).toBeDefined();
    expect(asCanvasRow(-3.2)).toBeDefined();
  });

  it("conversion functions should extract underlying values", () => {
    const cellSize = asCellSizePx(30);
    const cols = asBoardCols(10);
    const rows = asVisibleRows(20);
    const vanish = asVanishRows(2);
    const pixelX = asPixelX(150);
    const pixelY = asPixelY(200);
    const canvasCol = asCanvasCol(5.5);
    const canvasRow = asCanvasRow(7.3);

    expect(cellSizePxAsNumber(cellSize)).toBe(30);
    expect(boardColsAsNumber(cols)).toBe(10);
    expect(visibleRowsAsNumber(rows)).toBe(20);
    expect(vanishRowsAsNumber(vanish)).toBe(2);
    expect(pixelXAsNumber(pixelX)).toBe(150);
    expect(pixelYAsNumber(pixelY)).toBe(200);
    expect(canvasColAsNumber(canvasCol)).toBe(5.5);
    expect(canvasRowAsNumber(canvasRow)).toBe(7.3);
  });
});
