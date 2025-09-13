// Tests for @/engine/utils/fixedpoint.ts — Q16.16 fixed-point math
import { toQ, addQ, floorQ, fracQ } from "@/engine/utils/fixedpoint";

import type { Q16_16 } from "@/engine/types";

describe("@/engine/utils/fixedpoint — Q16.16 math", () => {
  test("toQ(n) encodes n * 65536; floorQ(toQ(1.75)) === 1", () => {
    // Test basic integer encoding
    expect(toQ(0)).toBe(0);
    expect(toQ(1)).toBe(65536); // 2^16
    expect(toQ(2)).toBe(131072); // 2 * 2^16
    expect(toQ(-1)).toBe(-65536);

    // Test fractional encoding - Q16.16 format stores fractional part in lower 16 bits
    const q1_75 = toQ(1.75);
    expect(floorQ(q1_75)).toBe(1); // Integer part should be 1

    // 1.75 = 1 + 0.75, where 0.75 * 65536 = 49152
    expect(q1_75).toBe(65536 + 49152); // 1 * 65536 + 0.75 * 65536

    // Test other fractional values
    const q0_5 = toQ(0.5);
    expect(floorQ(q0_5)).toBe(0);
    expect(q0_5).toBe(32768); // 0.5 * 65536

    const q2_25 = toQ(2.25);
    expect(floorQ(q2_25)).toBe(2);
    expect(q2_25).toBe(131072 + 16384); // 2 * 65536 + 0.25 * 65536

    // Test negative fractional values
    const qNeg1_5 = toQ(-1.5);
    expect(floorQ(qNeg1_5)).toBe(-2); // Floor of -1.5 is -2 (towards negative infinity)

    // Test zero and very small values
    const qSmall = toQ(0.00001);
    expect(floorQ(qSmall)).toBe(0);

    // Test larger values
    const qLarge = toQ(100.125);
    expect(floorQ(qLarge)).toBe(100);
  });

  test("addQ maintains associativity for small integers and preserves fractional parts", () => {
    // Test associativity: (a + b) + c = a + (b + c)
    const a = toQ(1.5);
    const b = toQ(2.25);
    const c = toQ(0.75);

    const leftAssoc = addQ(addQ(a, b), c);
    const rightAssoc = addQ(a, addQ(b, c));

    expect(leftAssoc).toBe(rightAssoc);
    expect(floorQ(leftAssoc)).toBe(4); // 1.5 + 2.25 + 0.75 = 4.5, floor = 4

    // Test integer addition
    const int1 = toQ(5);
    const int2 = toQ(3);
    const intSum = addQ(int1, int2);
    expect(floorQ(intSum)).toBe(8);
    expect(fracQ(intSum)).toBe(0); // No fractional part

    // Test fractional part preservation
    const f1 = toQ(1.25); // 0.25 fractional part
    const f2 = toQ(2.5); // 0.5 fractional part
    const fracSum = addQ(f1, f2);
    expect(floorQ(fracSum)).toBe(3); // 1.25 + 2.5 = 3.75, floor = 3
    expect(fracQ(fracSum)).toBe(toQ(0.75)); // 0.25 + 0.5 = 0.75

    // Test with zero
    const zero = toQ(0);
    expect(addQ(a, zero)).toBe(a);
    expect(addQ(zero, a)).toBe(a);

    // Test negative addition
    const neg = toQ(-1.25);
    const pos = toQ(3.75);
    const mixedSum = addQ(neg, pos);
    expect(floorQ(mixedSum)).toBe(2); // -1.25 + 3.75 = 2.5, floor = 2

    // Test associativity with more complex values
    const x = toQ(10.125);
    const y = toQ(5.875);
    const z = toQ(2.5);

    const assoc1 = addQ(addQ(x, y), z);
    const assoc2 = addQ(x, addQ(y, z));
    expect(assoc1).toBe(assoc2);

    // Verify the sum is correct
    expect(floorQ(assoc1)).toBe(18); // 10.125 + 5.875 + 2.5 = 18.5
  });

  test("fracQ(toQ(1.75)) encodes only the fractional remainder; addQ(fracQ(a), fracQ(b)) may carry into an extra cell when crossing 1.0 boundary", () => {
    // Test basic fractional extraction
    const q1_75 = toQ(1.75);
    const frac1_75 = fracQ(q1_75);

    // Fractional part of 1.75 is 0.75
    expect(frac1_75).toBe(toQ(0.75));
    expect(floorQ(frac1_75)).toBe(0); // Fractional part should have 0 integer component

    // Test other fractional values
    expect(fracQ(toQ(2.5))).toBe(toQ(0.5));
    expect(fracQ(toQ(0.25))).toBe(toQ(0.25));
    expect(fracQ(toQ(3.0))).toBe(0); // No fractional part

    // Test that fracQ only returns the lower 16 bits (fractional part)
    const q5_125 = toQ(5.125);
    const frac5_125 = fracQ(q5_125);
    expect(frac5_125).toBe(toQ(0.125));

    // Test carry behavior when adding fractional parts
    // Use exactly representable fractions to ensure deterministic behavior
    const a = toQ(1.5); // 0.5 fractional part (exactly representable)
    const b = toQ(2.75); // 0.75 fractional part (exactly representable)
    const fracA = fracQ(a);
    const fracB = fracQ(b);

    // 0.5 + 0.75 = 1.25, which should carry into the integer part
    const fracSum = addQ(fracA, fracB);
    expect(floorQ(fracSum)).toBe(1); // Carried over 1.0 boundary
    // Exact equality - no tolerance needed for deterministic fixed-point arithmetic
    expect(fracQ(fracSum)).toBe(toQ(0.25)); // Exact fractional remainder

    // Test boundary crossing with exact 1.0
    const half1 = fracQ(toQ(3.5)); // 0.5
    const half2 = fracQ(toQ(7.5)); // 0.5
    const exactOne = addQ(half1, half2);
    expect(floorQ(exactOne)).toBe(1);
    expect(fracQ(exactOne)).toBe(0);

    // Test multiple carries with exactly representable values
    const f1 = fracQ(toQ(1.75)); // 0.75 (exactly representable)
    const f2 = fracQ(toQ(2.875)); // 0.875 (exactly representable as 7/8)
    const multiCarry = addQ(f1, f2);
    expect(floorQ(multiCarry)).toBe(1); // 0.75 + 0.875 = 1.625, floor = 1
    // Exact equality - deterministic fixed-point arithmetic
    expect(fracQ(multiCarry)).toBe(toQ(0.625)); // Exact fractional remainder

    // Test that fracQ works with negative numbers (handles two's complement)
    const qNeg1_25 = toQ(-1.25);
    const fracNeg = fracQ(qNeg1_25);
    // For negative numbers in Q16.16, fracQ extracts the lower 16 bits
    // This should give us the bitwise fractional representation
    expect(fracNeg).toBe((qNeg1_25 & 0xffff) as Q16_16);

    // Test with zero fractional part
    const qInt = toQ(5);
    expect(fracQ(qInt)).toBe(0);

    // Test edge cases near boundaries
    const qAlmostOne = toQ(0.999999);
    const fracAlmost = fracQ(qAlmostOne);
    expect(floorQ(fracAlmost)).toBe(0);
    // Should be very close to but less than toQ(1.0)
    expect(fracAlmost).toBeLessThan(toQ(1.0));
  });

  test("Edge cases and boundary conditions", () => {
    // Test maximum safe values for Q16.16
    // Q16.16 uses signed 32-bit integers, so max safe integer part is 2^15 - 1 = 32767
    const maxSafe = toQ(32767.99);
    expect(floorQ(maxSafe)).toBe(32767);

    // Test minimum safe values
    const minSafe = toQ(-32768);
    expect(floorQ(minSafe)).toBe(-32768);

    // Test precision limits
    // Q16.16 has 16 bits for fractional part, so smallest representable fraction is 1/65536
    const smallest = toQ(1 / 65536);
    expect(smallest).toBe(1);
    expect(floorQ(smallest)).toBe(0);
    expect(fracQ(smallest)).toBe(1);

    // Test rounding behavior with very small fractions
    const verySmall = toQ(0.000001); // Much smaller than 1/65536
    expect(floorQ(verySmall)).toBe(0);

    // Test addQ with zero
    const someValue = toQ(42.75);
    const zero = toQ(0);
    expect(addQ(someValue, zero)).toBe(someValue);
    expect(addQ(zero, someValue)).toBe(someValue);

    // Test that operations maintain the Q16_16 branded type
    const branded1: Q16_16 = toQ(1.5);
    const branded2: Q16_16 = toQ(2.5);
    const sum: Q16_16 = addQ(branded1, branded2);
    expect(typeof sum).toBe("number");
  });

  test("Consistency between floorQ and fracQ", () => {
    // Test that floorQ + fracQ reconstructs the original exactly
    // Use exactly representable values to ensure deterministic behavior
    const testValues = [0, 1, 1.5, 2.75, -1.25, 100.125, -0.5];

    testValues.forEach((value) => {
      const q = toQ(value);
      const floor = floorQ(q);
      const frac = fracQ(q);

      // Reconstruct: floor * 65536 + frac should equal original q exactly
      const reconstructed = addQ(toQ(floor), frac);
      // Exact equality - fixed-point operations are deterministic
      expect(reconstructed).toBe(q);
    });

    // Test deterministic conversion behavior separately
    const nonExact = toQ(0.999); // Non-exactly representable in binary
    const floor999 = floorQ(nonExact);
    const frac999 = fracQ(nonExact);
    const reconstructed999 = addQ(toQ(floor999), frac999);
    // Note: toQ stores as float, but bit operations truncate to integer
    // So reconstructed will be the truncated integer version
    const expectedTruncated = Math.floor(0.999 * 65536) as Q16_16;
    expect(reconstructed999).toBe(expectedTruncated);
  });

  test("Deterministic behavior - fixed-point operations are exact", () => {
    // Q16.16 operations should be 100% deterministic and repeatable
    const val1 = toQ(3.125); // 3 + 1/8, exactly representable
    const val2 = toQ(5.25); // 5 + 1/4, exactly representable

    // Same operations should always yield identical results
    const sum1 = addQ(val1, val2);
    const sum2 = addQ(val1, val2);
    expect(sum1).toBe(sum2);

    // Order should not affect determinism (commutativity)
    const sum3 = addQ(val2, val1);
    expect(sum1).toBe(sum3);

    // Floor and frac operations are exact
    expect(floorQ(sum1)).toBe(floorQ(sum2));
    expect(fracQ(sum1)).toBe(fracQ(sum2));

    // Test that conversion is deterministic for the same input
    const converted1 = toQ(7.375);
    const converted2 = toQ(7.375);
    expect(converted1).toBe(converted2);

    // Complex operations chain deterministically
    const chain1 = fracQ(addQ(fracQ(toQ(1.5)), fracQ(toQ(2.25))));
    const chain2 = fracQ(addQ(fracQ(toQ(1.5)), fracQ(toQ(2.25))));
    expect(chain1).toBe(chain2);
  });

  test("Mathematical properties", () => {
    // Test commutativity: a + b = b + a
    const values: ReadonlyArray<Q16_16> = [
      toQ(1.5),
      toQ(2.25),
      toQ(-1.75),
      toQ(0.5),
    ] as const;

    values.forEach((a) => {
      values.forEach((b) => {
        if (a !== b) {
          expect(addQ(a, b)).toBe(addQ(b, a)); // Test commutativity
        }
      });
    });

    // Test that toQ is consistent with multiplication
    const n = 3.75;
    expect(toQ(n)).toBe(Math.round(n * 65536));

    // Test that floorQ implements proper floor function
    expect(floorQ(toQ(1.9))).toBe(1);
    expect(floorQ(toQ(-1.1))).toBe(-2); // Floor towards negative infinity
    expect(floorQ(toQ(-1.9))).toBe(-2);
  });
});
