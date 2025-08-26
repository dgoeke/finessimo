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
