/**
 * Grid Cache Module
 *
 * Manages offscreen grid rendering cache for the game board.
 * Encapsulates grid line drawing with minimal side effects.
 *
 * Design:
 * - Creates offscreen canvas sized to visible area only
 * - Draws grid lines once during initialization
 * - Provides drawGrid() to render cached grid at correct vanish offset
 * - Resource cleanup via dispose()
 */

import {
  boardColsAsNumber,
  visibleRowsAsNumber,
  cellSizePxAsNumber,
  vanishRowsAsNumber,
} from "../types/brands-render";

import type { BoardViewport } from "../types/brands-render";

/**
 * Grid cache interface - encapsulates offscreen grid rendering
 */
export type GridCache = Readonly<{
  /**
   * Draw the cached grid to the provided context at the correct vanish offset.
   * Grid is positioned below the vanish zone in the visible play area.
   */
  drawGrid: (ctx: CanvasRenderingContext2D) => void;

  /**
   * Clean up resources (offscreen canvas)
   */
  dispose: () => void;
}>;

/**
 * Create a grid cache for the given viewport configuration.
 *
 * The grid is rendered once to an offscreen canvas and cached for reuse.
 * Grid dimensions match the visible play area only (excludes vanish zone).
 */
export const createGridCache = (viewport: BoardViewport): GridCache => {
  const cols = boardColsAsNumber(viewport.cols);
  const visibleRows = visibleRowsAsNumber(viewport.visibleRows);
  const cellSize = cellSizePxAsNumber(viewport.cell);
  const vanishRows = vanishRowsAsNumber(viewport.vanishRows);

  // Create offscreen canvas for grid (visible area only)
  const gridCanvas = new OffscreenCanvas(
    cols * cellSize,
    visibleRows * cellSize,
  );

  const gridCtx = gridCanvas.getContext("2d");
  if (!gridCtx) {
    throw new Error("Failed to get 2D context for grid canvas");
  }

  // Draw grid lines once to the offscreen canvas
  drawGridToCanvas(gridCtx, cols, visibleRows, cellSize);

  return {
    dispose: (): void => {
      // Clean up offscreen canvas resources
      gridCanvas.width = 0;
      gridCanvas.height = 0;
    },

    drawGrid: (ctx: CanvasRenderingContext2D): void => {
      // Draw the cached grid canvas at the correct y position (below vanish zone)
      const gridYOffset = vanishRows * cellSize;
      ctx.drawImage(gridCanvas, 0, gridYOffset);
    },
  };
};

/**
 * Draw grid lines to the specified canvas context.
 * Called once during cache initialization.
 */
function drawGridToCanvas(
  ctx: OffscreenCanvasRenderingContext2D,
  cols: number,
  visibleRows: number,
  cellSize: number,
): void {
  ctx.strokeStyle = "#222222";
  ctx.lineWidth = 1;

  // Vertical lines
  for (let x = 0; x <= cols; x++) {
    const pixelX = x * cellSize;
    ctx.beginPath();
    ctx.moveTo(pixelX, 0);
    ctx.lineTo(pixelX, visibleRows * cellSize);
    ctx.stroke();
  }

  // Horizontal lines
  for (let y = 0; y <= visibleRows; y++) {
    const pixelY = y * cellSize;
    ctx.beginPath();
    ctx.moveTo(0, pixelY);
    ctx.lineTo(cols * cellSize, pixelY);
    ctx.stroke();
  }
}
