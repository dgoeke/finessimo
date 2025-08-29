/**
 * Shared color manipulation utilities for UI components
 */

/**
 * Lightens a hex color by the specified amount
 * @param color - Hex color string (e.g., "#FF0000")
 * @param amount - Amount to lighten (0-1, where 0.3 = 30% lighter)
 * @returns Lightened hex color string
 */
export function lightenColor(color: string, amount: number): string {
  const hex = color.replace("#", "");
  const r = Math.min(
    255,
    parseInt(hex.substring(0, 2), 16) + Math.floor(255 * amount),
  );
  const g = Math.min(
    255,
    parseInt(hex.substring(2, 4), 16) + Math.floor(255 * amount),
  );
  const b = Math.min(
    255,
    parseInt(hex.substring(4, 6), 16) + Math.floor(255 * amount),
  );
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Darkens a hex color by the specified amount
 * @param color - Hex color string (e.g., "#FF0000")
 * @param amount - Amount to darken (0-1, where 0.3 = 30% darker)
 * @returns Darkened hex color string
 */
export function darkenColor(color: string, amount: number): string {
  const hex = color.replace("#", "");
  const r = Math.max(
    0,
    parseInt(hex.substring(0, 2), 16) - Math.floor(255 * amount),
  );
  const g = Math.max(
    0,
    parseInt(hex.substring(2, 4), 16) - Math.floor(255 * amount),
  );
  const b = Math.max(
    0,
    parseInt(hex.substring(4, 6), 16) - Math.floor(255 * amount),
  );
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Normalizes a hex color to have consistent perceived brightness for glow effects
 * Uses relative luminance formula to account for human perception
 * @param color - Hex color string (e.g., "#FF0000")
 * @param targetLuminance - Target perceived brightness (0-1, default 0.6 for good glow visibility)
 * @returns Color adjusted to target luminance while preserving hue
 */
export function normalizeColorBrightness(
  color: string,
  targetLuminance = 0.6,
): string {
  // Clamp target to [0,1]
  const target = Math.max(0, Math.min(1, targetLuminance));
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  // Convert to linear RGB for accurate luminance calculation
  const toLinear = (c: number): number =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const rLinear = toLinear(r);
  const gLinear = toLinear(g);
  const bLinear = toLinear(b);

  // Calculate relative luminance using ITU-R BT.709 coefficients
  const currentLuminance =
    0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;

  // Scale the linear RGB values to achieve target luminance.
  // Luminance in linear RGB scales linearly with a uniform channel scale, so use ratio.
  const safeCurrent = Math.max(currentLuminance, 1e-6);
  const scaleFactor = target / safeCurrent;
  let scaledRLinear = Math.min(1, rLinear * scaleFactor);
  let scaledGLinear = Math.min(1, gLinear * scaleFactor);
  let scaledBLinear = Math.min(1, bLinear * scaleFactor);

  // If we are brightening (scaleFactor > 1) and clamping prevents reaching target,
  // blend toward white in linear space to reach the exact target luminance while
  // minimally altering hue (desaturation only).
  const scaledLum =
    0.2126 * scaledRLinear + 0.7152 * scaledGLinear + 0.0722 * scaledBLinear;
  if (scaleFactor > 1 && scaledLum + 1e-9 < target) {
    const t = Math.max(0, Math.min(1, (target - scaledLum) / (1 - scaledLum)));
    scaledRLinear = scaledRLinear + t * (1 - scaledRLinear);
    scaledGLinear = scaledGLinear + t * (1 - scaledGLinear);
    scaledBLinear = scaledBLinear + t * (1 - scaledBLinear);
  }

  // Convert back to sRGB
  const fromLinear = (c: number): number =>
    c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  const finalR = fromLinear(scaledRLinear);
  const finalG = fromLinear(scaledGLinear);
  const finalB = fromLinear(scaledBLinear);

  // Convert back to hex
  const toHex = (c: number): string =>
    Math.round(Math.min(255, Math.max(0, c * 255)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(finalR)}${toHex(finalG)}${toHex(finalB)}`;
}
