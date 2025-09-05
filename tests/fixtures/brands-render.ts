/**
 * Test fixtures for branded render types.
 * Creates branded render coordinate types for use in tests.
 */

import type {
  CellSizePx,
  BoardViewport,
  PixelY,
  VisibleRows,
  VanishRows,
  BoardCols,
} from "@/ui/types/brands-render";

// Simple branded type constructors for testing
export const createCellSizePx = (value: number): CellSizePx =>
  value as CellSizePx;
export const createPixelY = (value: number): PixelY => value as PixelY;
export const createVisibleRows = (value: number): VisibleRows =>
  value as VisibleRows;
export const createVanishRows = (value: number): VanishRows =>
  value as VanishRows;
export const createBoardCols = (value: number): BoardCols => value as BoardCols;

export const createBoardViewport = (config: {
  cell: CellSizePx;
  cols: BoardCols;
  visibleRows: VisibleRows;
  vanishRows: VanishRows;
}): BoardViewport => ({
  cell: config.cell,
  cols: config.cols,
  vanishRows: config.vanishRows,
  visibleRows: config.visibleRows,
});
