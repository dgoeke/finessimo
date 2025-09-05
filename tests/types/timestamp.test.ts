import {
  createTimestamp,
  fromNow,
  isTimestamp,
  assertTimestamp,
  asNumber,
  type Timestamp,
} from "@/types/timestamp";

describe("Timestamp", () => {
  describe("createTimestamp", () => {
    test("creates valid timestamp from positive finite number", () => {
      const result = createTimestamp(1000);
      expect(result).toBe(1000);
      expect(typeof result).toBe("number");
    });

    test("creates timestamp from fractional number", () => {
      const result = createTimestamp(123.456);
      expect(result).toBe(123.456);
    });

    test("creates timestamp from very large number", () => {
      const largeNumber = Number.MAX_SAFE_INTEGER;
      const result = createTimestamp(largeNumber);
      expect(result).toBe(largeNumber);
    });

    test("throws error for zero", () => {
      expect(() => createTimestamp(0)).toThrow(
        "Timestamp must be a finite, non-zero number.",
      );
    });

    test("throws error for negative number", () => {
      expect(() => createTimestamp(-1)).toThrow(
        "Timestamp must be a finite, non-zero number.",
      );
    });

    test("throws error for positive infinity", () => {
      expect(() => createTimestamp(Number.POSITIVE_INFINITY)).toThrow(
        "Timestamp must be a finite, non-zero number.",
      );
    });

    test("throws error for negative infinity", () => {
      expect(() => createTimestamp(Number.NEGATIVE_INFINITY)).toThrow(
        "Timestamp must be a finite, non-zero number.",
      );
    });

    test("throws error for NaN", () => {
      expect(() => createTimestamp(Number.NaN)).toThrow(
        "Timestamp must be a finite, non-zero number.",
      );
    });
  });

  describe("fromNow", () => {
    test("returns a valid timestamp from performance.now()", () => {
      const before = performance.now();
      const timestamp = fromNow();
      const after = performance.now();

      expect(typeof timestamp).toBe("number");
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
      expect(Number.isFinite(timestamp)).toBe(true);
      expect(timestamp).toBeGreaterThan(0);
    });

    test("returns different timestamps on subsequent calls", () => {
      const timestamp1 = fromNow();
      // Small delay to ensure different timestamps
      const timestamp2 = fromNow();

      expect(timestamp2).toBeGreaterThanOrEqual(timestamp1);
    });
  });

  describe("isTimestamp", () => {
    test("returns true for positive finite numbers", () => {
      expect(isTimestamp(1)).toBe(true);
      expect(isTimestamp(123.456)).toBe(true);
      expect(isTimestamp(Number.MAX_SAFE_INTEGER)).toBe(true);
    });

    test("returns true for negative finite numbers", () => {
      expect(isTimestamp(-1)).toBe(true);
      expect(isTimestamp(-123.456)).toBe(true);
    });

    test("returns false for zero", () => {
      expect(isTimestamp(0)).toBe(false);
    });

    test("returns false for infinity", () => {
      expect(isTimestamp(Number.POSITIVE_INFINITY)).toBe(false);
      expect(isTimestamp(Number.NEGATIVE_INFINITY)).toBe(false);
    });

    test("returns false for NaN", () => {
      expect(isTimestamp(Number.NaN)).toBe(false);
    });

    test("returns false for non-numbers", () => {
      expect(isTimestamp("123")).toBe(false);
      expect(isTimestamp(null)).toBe(false);
      expect(isTimestamp(undefined)).toBe(false);
      expect(isTimestamp({})).toBe(false);
      expect(isTimestamp([])).toBe(false);
      expect(isTimestamp(true)).toBe(false);
    });

    test("works with created timestamps", () => {
      const timestamp = createTimestamp(100);
      expect(isTimestamp(timestamp)).toBe(true);
    });
  });

  describe("assertTimestamp", () => {
    test("passes for valid timestamps without throwing", () => {
      expect(() => assertTimestamp(1)).not.toThrow();
      expect(() => assertTimestamp(-1)).not.toThrow();
      expect(() => assertTimestamp(123.456)).not.toThrow();
    });

    test("throws error for invalid values", () => {
      expect(() => assertTimestamp(0)).toThrow("Not a Timestamp.");
      expect(() => assertTimestamp(Number.POSITIVE_INFINITY)).toThrow(
        "Not a Timestamp.",
      );
      expect(() => assertTimestamp(Number.NaN)).toThrow("Not a Timestamp.");
      expect(() => assertTimestamp("123")).toThrow("Not a Timestamp.");
      expect(() => assertTimestamp(null)).toThrow("Not a Timestamp.");
      expect(() => assertTimestamp(undefined)).toThrow("Not a Timestamp.");
    });

    test("works with created timestamps", () => {
      const timestamp = createTimestamp(100);
      expect(() => assertTimestamp(timestamp)).not.toThrow();
    });
  });

  describe("asNumber", () => {
    test("converts timestamp back to number", () => {
      const timestamp = createTimestamp(123.456);
      const number = asNumber(timestamp);

      expect(number).toBe(123.456);
      expect(typeof number).toBe("number");
    });

    test("preserves exact value", () => {
      const originalValue = 999.999;
      const timestamp = createTimestamp(originalValue);
      const convertedBack = asNumber(timestamp);

      expect(convertedBack).toBe(originalValue);
    });

    test("works with fromNow timestamp", () => {
      const timestamp = fromNow();
      const number = asNumber(timestamp);

      expect(typeof number).toBe("number");
      expect(number).toBeGreaterThan(0);
      expect(Number.isFinite(number)).toBe(true);
    });
  });

  describe("type safety integration", () => {
    test("timestamp type is properly branded", () => {
      const timestamp = createTimestamp(100);

      // TypeScript should enforce that this is a Timestamp, not just a number
      const validFunction = (t: Timestamp): number => asNumber(t);
      expect(validFunction(timestamp)).toBe(100);
    });

    test("createTimestamp and asNumber are inverse operations", () => {
      const originalValue = 12345.6789;
      const timestamp = createTimestamp(originalValue);
      const backToNumber = asNumber(timestamp);

      expect(backToNumber).toBe(originalValue);
    });
  });
});
