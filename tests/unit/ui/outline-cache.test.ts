/**
 * Simple unit test for outline cache implementation.
 */

import { createOutlineCache } from "../../../src/ui/renderers/outline-cache";

describe("outline cache", () => {
  it("should create a cache instance", () => {
    const cache = createOutlineCache();
    expect(cache).toBeDefined();
    expect(typeof cache.get).toBe("function");
  });

  it("should handle empty cell arrays", () => {
    const cache = createOutlineCache();
    const result = cache.get([]);
    expect(Array.isArray(result)).toBe(true);
  });
});
