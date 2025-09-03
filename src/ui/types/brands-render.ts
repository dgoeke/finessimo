// Branded types for render space coordinates and viewport dimensions

/**
 * Render Space Brands
 *
 * These brands prevent mixing up different coordinate systems and dimensions
 * used in the game board rendering pipeline:
 * - Grid coordinates: logical game board positions (may be negative)
 * - Canvas coordinates: physical pixel positions (always non-negative)
 * - Viewport dimensions: rendering viewport configuration
 */

// Viewport dimension brands
declare const CellSizePxBrand: unique symbol;
export type CellSizePx = number & { readonly [CellSizePxBrand]: true };

declare const BoardColsBrand: unique symbol;
export type BoardCols = number & { readonly [BoardColsBrand]: true };

declare const VisibleRowsBrand: unique symbol;
export type VisibleRows = number & { readonly [VisibleRowsBrand]: true };

declare const VanishRowsBrand: unique symbol;
export type VanishRows = number & { readonly [VanishRowsBrand]: true };

// Pixel coordinate brands
declare const PixelXBrand: unique symbol;
export type PixelX = number & { readonly [PixelXBrand]: true };

declare const PixelYBrand: unique symbol;
export type PixelY = number & { readonly [PixelYBrand]: true };

// Canvas grid coordinate brands (grid coordinates used for canvas space)
declare const CanvasColBrand: unique symbol;
export type CanvasCol = number & { readonly [CanvasColBrand]: true };

declare const CanvasRowBrand: unique symbol;
export type CanvasRow = number & { readonly [CanvasRowBrand]: true };

/**
 * Board viewport configuration - immutable viewport dimensions and settings
 * used throughout the rendering pipeline.
 */
export type BoardViewport = Readonly<{
  cols: BoardCols;
  visibleRows: VisibleRows;
  vanishRows: VanishRows;
  cell: CellSizePx;
}>;

// Constructor functions (following existing brand pattern)
export const asCellSizePx = (n: number): CellSizePx => {
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("CellSizePx must be a positive finite number");
  }
  return n as CellSizePx;
};

export const asBoardCols = (n: number): BoardCols => {
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error("BoardCols must be a positive integer");
  }
  return n as BoardCols;
};

export const asVisibleRows = (n: number): VisibleRows => {
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error("VisibleRows must be a positive integer");
  }
  return n as VisibleRows;
};

export const asVanishRows = (n: number): VanishRows => {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error("VanishRows must be a non-negative integer");
  }
  return n as VanishRows;
};

export const asPixelX = (n: number): PixelX => n as PixelX;
export const asPixelY = (n: number): PixelY => n as PixelY;
export const asCanvasCol = (n: number): CanvasCol => n as CanvasCol;
export const asCanvasRow = (n: number): CanvasRow => n as CanvasRow;

/**
 * Grid-to-Canvas coordinate conversion with documented invariants.
 *
 * INVARIANT: canvasRow = gridRow + vanishRows
 *
 * Examples:
 * - Grid y=-2 → Canvas y=0 (top of vanish zone)
 * - Grid y=-1 → Canvas y=1 (bottom of vanish zone)
 * - Grid y=0 → Canvas y=2 (top of play area)
 * - Grid y=19 → Canvas y=21 (bottom of play area)
 *
 * This conversion is critical for correct overlay positioning and bounds checking.
 */
export const gridToCanvasRow = (yGrid: number, vanish: VanishRows): CanvasRow =>
  asCanvasRow(yGrid + (vanish as unknown as number));

// Conversion helpers for boundary interop
export const cellSizePxAsNumber = (c: CellSizePx): number => c as number;
export const boardColsAsNumber = (b: BoardCols): number => b as number;
export const visibleRowsAsNumber = (v: VisibleRows): number => v as number;
export const vanishRowsAsNumber = (v: VanishRows): number => v as number;
export const pixelXAsNumber = (p: PixelX): number => p as number;
export const pixelYAsNumber = (p: PixelY): number => p as number;
export const canvasColAsNumber = (c: CanvasCol): number => c as number;
export const canvasRowAsNumber = (c: CanvasRow): number => c as number;
