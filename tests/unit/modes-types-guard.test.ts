import { isExtendedModeData } from "../../src/modes/types";
import { createGridCoord } from "../../src/types/brands";

describe("modes/types.isExtendedModeData", () => {
  test("rejects null and non-objects", () => {
    expect(isExtendedModeData(null)).toBe(false);
    expect(isExtendedModeData(123)).toBe(false);
    expect(isExtendedModeData("x")).toBe(false);
  });

  test("accepts empty object (all optional)", () => {
    expect(isExtendedModeData({})).toBe(true);
  });

  test("accepts ghostEnabled boolean and valid targets shape", () => {
    const cell = {
      color: "#f00",
      x: createGridCoord(3),
      y: createGridCoord(10),
    };
    expect(isExtendedModeData({ ghostEnabled: true, targets: [[cell]] })).toBe(
      true,
    );
  });

  test("rejects invalid targets entries", () => {
    // pattern contains non-object
    expect(isExtendedModeData({ targets: [[null]] })).toBe(false);
  });
});
