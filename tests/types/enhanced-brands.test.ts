import { describe, expect, it } from "@jest/globals";

import {
  createPercentage,
  percentageAsNumber,
  createUnbrandedMs,
  unbrandedMsAsNumber,
  createDurationMs,
} from "../../src/types/brands";

describe("Enhanced Branded Types", () => {
  describe("Percentage", () => {
    it("creates valid percentage", () => {
      expect(() => createPercentage(50)).not.toThrow();
      expect(() => createPercentage(0)).not.toThrow();
      expect(() => createPercentage(100)).not.toThrow();
    });

    it("rejects invalid percentages", () => {
      expect(() => createPercentage(-1)).toThrow("Percentage must be 0-100");
      expect(() => createPercentage(101)).toThrow("Percentage must be 0-100");
      expect(() => createPercentage(NaN)).toThrow("Percentage must be 0-100");
      expect(() => createPercentage(Infinity)).toThrow(
        "Percentage must be 0-100",
      );
    });

    it("converts back to number", () => {
      const p = createPercentage(75);
      expect(percentageAsNumber(p)).toBe(75);
    });
  });

  describe("UnbrandedMs", () => {
    it("creates from DurationMs", () => {
      const duration = createDurationMs(1000);
      const unbranded = createUnbrandedMs(duration);
      expect(unbrandedMsAsNumber(unbranded)).toBe(1000);
    });

    it("preserves the numeric value", () => {
      const original = 5432;
      const duration = createDurationMs(original);
      const unbranded = createUnbrandedMs(duration);
      expect(unbrandedMsAsNumber(unbranded)).toBe(original);
    });
  });
});
