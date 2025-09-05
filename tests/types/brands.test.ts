import { describe, it, expect } from "@jest/globals";

import {
  assertCellValue,
  assertDurationMs,
  assertFrame,
  assertGridCoord,
  assertSeed,
  cellValueAsNumber,
  createCellValue,
  createDurationMs,
  createFrame,
  createGridCoord,
  createSeed,
  durationMsAsNumber,
  frameAsNumber,
  gridCoordAsNumber,
  isCellValue,
  isDurationMs,
  isFrame,
  isGridCoord,
  isSeed,
  numberToCellValue,
  numberToDurationMs,
  numberToFrame,
  numberToGridCoord,
  seedAsString,
} from "../../src/types/brands";

describe("brands.ts", () => {
  it("constructors accept valid inputs and brand correctly", () => {
    const d = createDurationMs(123);
    expect(durationMsAsNumber(d)).toBe(123);

    const g = createGridCoord(5);
    expect(gridCoordAsNumber(g)).toBe(5);

    const c = createCellValue(8);
    expect(cellValueAsNumber(c)).toBe(8);

    const f = createFrame(42);
    expect(frameAsNumber(f)).toBe(42);

    const s = createSeed("seed");
    expect(seedAsString(s)).toBe("seed");
  });

  it("constructors reject invalid inputs", () => {
    expect(() => createDurationMs(-1)).toThrow();
    expect(() => createGridCoord(1.5)).toThrow();
    expect(() => createCellValue(9)).toThrow();
    expect(() => createFrame(-1)).toThrow();

    expect(() => createSeed("")).toThrow();
  });

  it("guards and asserts work as expected", () => {
    expect(isDurationMs(10)).toBe(true);
    expect(isDurationMs(-1)).toBe(false);
    expect(() => assertDurationMs(10)).not.toThrow();
    expect(() => assertDurationMs(-1)).toThrow();

    expect(isGridCoord(3)).toBe(true);
    expect(isGridCoord(3.14)).toBe(false);
    expect(() => assertGridCoord(7)).not.toThrow();
    expect(() => assertGridCoord(7.1)).toThrow();

    expect(isCellValue(0)).toBe(true);
    expect(isCellValue(9)).toBe(false);
    expect(() => assertCellValue(8)).not.toThrow();
    expect(() => assertCellValue(9)).toThrow();

    expect(isFrame(0)).toBe(true);
    expect(isFrame(-1)).toBe(false);
    expect(() => assertFrame(0)).not.toThrow();
    expect(() => assertFrame(-1)).toThrow();

    expect(isSeed("x")).toBe(true);
    expect(isSeed(123)).toBe(false);
    expect(() => assertSeed("ok")).not.toThrow();
    expect(() => assertSeed(123)).toThrow();
  });

  it("numberTo* helpers brand values safely", () => {
    expect(durationMsAsNumber(numberToDurationMs(5))).toBe(5);
    expect(gridCoordAsNumber(numberToGridCoord(2))).toBe(2);
    expect(cellValueAsNumber(numberToCellValue(7))).toBe(7);
    expect(frameAsNumber(numberToFrame(11))).toBe(11);
  });
});
