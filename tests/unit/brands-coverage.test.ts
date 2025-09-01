import { describe, it, expect } from "@jest/globals";

import {
  assertLockDelayResetCount,
  createLockDelayResetCount,
  isLockDelayResetCount,
  lockDelayResetCountAsNumber,
  stringToSeed,
  createUiEffectId,
  uiEffectIdAsNumber,
} from "../../src/types/brands";

describe("brands coverage: lock delay + ui effect id + seed", () => {
  it("lock delay reset count constructors/guards/asserts", () => {
    // Valid boundaries
    const zero = createLockDelayResetCount(0);
    const fifteen = createLockDelayResetCount(15);
    expect(lockDelayResetCountAsNumber(zero)).toBe(0);
    expect(lockDelayResetCountAsNumber(fifteen)).toBe(15);

    // Guard checks
    expect(isLockDelayResetCount(10)).toBe(true);
    expect(isLockDelayResetCount(2.5)).toBe(false);
    expect(isLockDelayResetCount(-1)).toBe(false);
    expect(isLockDelayResetCount(16)).toBe(false);

    // Assert passes/fails
    expect(() => assertLockDelayResetCount(3)).not.toThrow();
    expect(() => assertLockDelayResetCount(20)).toThrow();

    // Constructor failure paths (exercise all disjuncts): non-integer, negative, > 15
    expect(() => createLockDelayResetCount(1.2)).toThrow();
    expect(() => createLockDelayResetCount(-1)).toThrow();
    expect(() => createLockDelayResetCount(16)).toThrow();
  });

  it("stringToSeed brands seed inputs", () => {
    const s = stringToSeed("abc");
    // Ensure unbranding via toString still yields underlying string
    expect(String(s)).toBe("abc");
  });

  it("UiEffectId brand/unbrand works and truncates", () => {
    const id = createUiEffectId(12.9);
    expect(uiEffectIdAsNumber(id)).toBe(12);
    const id2 = createUiEffectId(7);
    expect(uiEffectIdAsNumber(id2)).toBe(7);
  });
});
