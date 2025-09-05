import { normalizeColorBrightness } from "@/ui/utils/colors";

// Helper to compute relative luminance using the same method as production
const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return [r, g, b];
};

const toLinear = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

const relativeLuminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex);
  const rl = toLinear(r);
  const gl = toLinear(g);
  const bl = toLinear(b);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
};

describe("normalizeColorBrightness", () => {
  it("dark colors move up toward target luminance", () => {
    const input = "#222222";
    const target = 0.6;
    const output = normalizeColorBrightness(input, target);

    const before = relativeLuminance(input);
    const after = relativeLuminance(output);

    expect(after).toBeGreaterThan(before);
    // within a reasonable tolerance around target
    expect(Math.abs(after - target)).toBeLessThanOrEqual(0.05);
  });

  it("bright colors move down toward target luminance", () => {
    const input = "#FFFFFF";
    const target = 0.6;
    const output = normalizeColorBrightness(input, target);

    const before = relativeLuminance(input);
    const after = relativeLuminance(output);

    expect(after).toBeLessThan(before);
    expect(Math.abs(after - target)).toBeLessThanOrEqual(0.05);
  });

  it("saturated primaries can still be normalized toward target", () => {
    // This test reveals a limitation/bug in the current implementation:
    // scaling linear RGB uniformly cannot raise luminance for colors that already
    // have a channel at full intensity (e.g., pure red), as it clamps at 1.0.
    // We expect the algorithm to bring luminance near the target.
    const input = "#FF0000"; // very low luminance (≈0.2126) compared to target
    const target = 0.6;
    const output = normalizeColorBrightness(input, target);

    const after = relativeLuminance(output);

    // Expect luminance to approach target within tolerance
    expect(Math.abs(after - target)).toBeLessThanOrEqual(0.08);
  });
});
