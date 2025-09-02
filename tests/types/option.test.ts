import { describe, expect, it } from "@jest/globals";

import {
  mapOption,
  flatMapOption,
  getOrElse,
  filterOption,
  isSome,
  isNone,
} from "../../src/types/option";

describe("Option Utilities", () => {
  describe("mapOption", () => {
    it("maps non-null values", () => {
      const result = mapOption(10, (x) => x * 2, 0);
      expect(result).toBe(20);
    });

    it("returns default for null", () => {
      const result = mapOption(null, (x: number) => x * 2, 999);
      expect(result).toBe(999);
    });

    it("returns default for undefined", () => {
      const result = mapOption(undefined, (x: number) => x * 2, 999);
      expect(result).toBe(999);
    });
  });

  describe("flatMapOption", () => {
    it("chains non-null values", () => {
      const result = flatMapOption(5, (x) => (x > 0 ? x * 2 : null));
      expect(result).toBe(10);
    });

    it("returns null for null input", () => {
      const result = flatMapOption(null, (x: number) => x * 2);
      expect(result).toBeNull();
    });

    it("returns null when chain function returns null", () => {
      const result = flatMapOption(5, (_x) => null);
      expect(result).toBeNull();
    });
  });

  describe("getOrElse", () => {
    it("returns value when present", () => {
      expect(getOrElse("hello", "default")).toBe("hello");
    });

    it("returns default for null", () => {
      expect(getOrElse(null, "default")).toBe("default");
    });

    it("returns default for undefined", () => {
      expect(getOrElse(undefined, "default")).toBe("default");
    });
  });

  describe("filterOption", () => {
    it("preserves values that match predicate", () => {
      const result = filterOption(10, (x) => x > 5);
      expect(result).toBe(10);
    });

    it("filters out values that don't match", () => {
      const result = filterOption(3, (x) => x > 5);
      expect(result).toBeNull();
    });

    it("returns null for null input", () => {
      const result = filterOption(null, (x: number) => x > 5);
      expect(result).toBeNull();
    });
  });

  describe("type guards", () => {
    it("isSome correctly identifies values", () => {
      expect(isSome(42)).toBe(true);
      expect(isSome("hello")).toBe(true);
      expect(isSome(0)).toBe(true);
      expect(isSome(false)).toBe(true);
      expect(isSome(null)).toBe(false);
      expect(isSome(undefined)).toBe(false);
    });

    it("isNone correctly identifies null/undefined", () => {
      expect(isNone(null)).toBe(true);
      expect(isNone(undefined)).toBe(true);
      expect(isNone(0)).toBe(false);
      expect(isNone(false)).toBe(false);
      expect(isNone("")).toBe(false);
    });
  });
});
