/**
 * Pure cell rendering functions for board and active piece display.
 *
 * This module contains all cell-level drawing logic extracted from game-board.tsx.
 * All functions are pure and side-effect free, taking explicit dependencies as parameters.
 */

import { PIECES } from "../../core/pieces";
import { idx } from "../../state/types";
import { createGridCoord } from "../../types/brands";
import {
  cellSizePxAsNumber,
  boardColsAsNumber,
  visibleRowsAsNumber,
  vanishRowsAsNumber,
  pixelYAsNumber,
} from "../types/brands-render";
import { lightenColor, darkenColor } from "../utils/colors";

import type { Board, ActivePiece } from "../../state/types";
import type { BoardViewport, PixelY } from "../types/brands-render";

/**
 * Maps cell values to their corresponding Tetris colors.
 * Returns official Tetris Guideline colors for each piece type.
 *
 * @param cellValue - Cell value (1-7 for piece types, 0 for empty)
 * @returns Hex color string
 */
export const getCellColor = (cellValue: number): string => {
  // Official Tetris Guideline colors
  const colors = [
    "#000000", // 0 - empty (shouldn't be used)
    "#00FFFF", // 1 - I (light blue/cyan)
    "#FFFF00", // 2 - O (yellow)
    "#FF00FF", // 3 - T (magenta)
    "#00FF00", // 4 - S (green)
    "#FF0000", // 5 - Z (red)
    "#0000FF", // 6 - J (dark blue)
    "#FF7F00", // 7 - L (orange)
  ];
  return colors[cellValue] ?? "#ffffff";
};

/**
 * Checks if grid coordinates are within the renderable board bounds.
 * Includes both visible play area and vanish zone.
 *
 * @param x - Grid x coordinate
 * @param y - Grid y coordinate
 * @param viewport - Board viewport configuration
 * @returns true if coordinates are within bounds
 */
export const isWithinBounds = (
  x: number,
  y: number,
  viewport: BoardViewport,
): boolean => {
  const boardWidth = boardColsAsNumber(viewport.cols);
  const visibleHeight = visibleRowsAsNumber(viewport.visibleRows);
  const vanishRows = vanishRowsAsNumber(viewport.vanishRows);

  return x >= 0 && x < boardWidth && y >= -vanishRows && y < visibleHeight;
};

/**
 * Renders all non-empty cells on the game board including vanish zone.
 * Uses branded coordinates for type safety and proper grid-to-canvas conversion.
 *
 * @param ctx - Canvas 2D rendering context
 * @param board - Game board state containing cell values
 * @param viewport - Viewport configuration for dimensions and conversion
 */
export const renderBoardCells = (
  ctx: CanvasRenderingContext2D,
  board: Board,
  viewport: BoardViewport,
): void => {
  const vanishRows = vanishRowsAsNumber(viewport.vanishRows);

  // Render entire board including vanish zone (y=-vanishRows to y=board.height-1)
  for (let y = -vanishRows; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const cellValue =
        board.cells[idx(board, createGridCoord(x), createGridCoord(y))];

      if (cellValue !== undefined && cellValue !== 0) {
        const color = getCellColor(cellValue);
        // Convert board y coordinate to canvas y coordinate
        const canvasY = y + vanishRows;
        drawCell(ctx, x, canvasY, color, viewport);
      }
    }
  }
};

/**
 * Renders the active piece with optional vertical tweening offset.
 * Handles both tweened (simplified) and non-tweened (full detail) rendering.
 *
 * @param ctx - Canvas 2D rendering context
 * @param piece - Active piece state
 * @param viewport - Viewport configuration
 * @param verticalOffsetPx - Vertical pixel offset from tweening
 * @param isTweening - Whether the piece is currently tweening (affects rendering style)
 */
export const renderActivePieceCells = (
  ctx: CanvasRenderingContext2D,
  piece: ActivePiece,
  viewport: BoardViewport,
  verticalOffsetPx: PixelY,
  isTweening: boolean,
): void => {
  const shape = PIECES[piece.id];
  const cells = shape.cells[piece.rot];
  const cellSize = cellSizePxAsNumber(viewport.cell);

  ctx.fillStyle = shape.color;

  const offsetYCells = pixelYAsNumber(verticalOffsetPx) / cellSize;
  const offsetXCells = 0;

  for (const [dx, dy] of cells) {
    const x = piece.x + dx;
    const y = piece.y + dy;

    // Render cells only if within board bounds (including vanish zone)
    if (isWithinBounds(x, y, viewport)) {
      const vanishRows = vanishRowsAsNumber(viewport.vanishRows);
      // Convert board y coordinate to canvas y coordinate (+ fractional tween offset)
      const canvasY = y + vanishRows + offsetYCells;
      const canvasX = x + offsetXCells;

      if (isTweening) {
        // Use simplified rendering during tween to avoid shimmer
        drawCellSimple(ctx, canvasX, canvasY, shape.color, viewport);
      } else {
        // Use full detailed rendering when not tweening
        drawCell(ctx, canvasX, canvasY, shape.color, viewport);
      }
    }
  }
};

/**
 * Draws a cell with full visual detail including gradients and borders.
 * Used for static board cells and non-tweening active pieces.
 *
 * @param ctx - Canvas 2D rendering context
 * @param x - Canvas x coordinate (not grid coordinate)
 * @param y - Canvas y coordinate (not grid coordinate)
 * @param color - Cell color
 * @param viewport - Viewport configuration
 */
function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  viewport: BoardViewport,
): void {
  const cellSize = cellSizePxAsNumber(viewport.cell);
  const pixelX = x * cellSize;
  const pixelY = y * cellSize;

  // Create subtle gradient for depth
  const gradient = ctx.createLinearGradient(
    pixelX,
    pixelY,
    pixelX + cellSize,
    pixelY + cellSize,
  );
  gradient.addColorStop(0, lightenColor(color, 0.3));
  gradient.addColorStop(1, darkenColor(color, 0.2));

  ctx.fillStyle = gradient;
  ctx.fillRect(pixelX, pixelY, cellSize, cellSize);

  // Add subtle highlight on top edge
  ctx.fillStyle = lightenColor(color, 0.4);
  ctx.fillRect(pixelX, pixelY, cellSize, 2);

  // Add subtle shadow on bottom edge
  ctx.fillStyle = darkenColor(color, 0.3);
  ctx.fillRect(pixelX, pixelY + cellSize - 2, cellSize, 2);

  // Draw refined border
  ctx.strokeStyle = darkenColor(color, 0.3);
  ctx.lineWidth = 2;
  ctx.strokeRect(pixelX, pixelY, cellSize, cellSize);
}

/**
 * Draws a simplified cell without stroke or edge highlights.
 * Used during tweening to prevent visual shimmer.
 *
 * @param ctx - Canvas 2D rendering context
 * @param x - Canvas x coordinate (may be fractional)
 * @param y - Canvas y coordinate (may be fractional)
 * @param color - Cell color
 * @param viewport - Viewport configuration
 */
function drawCellSimple(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  viewport: BoardViewport,
): void {
  const cellSize = cellSizePxAsNumber(viewport.cell);
  const pixelX = x * cellSize;
  const pixelY = y * cellSize;

  const gradient = ctx.createLinearGradient(
    pixelX,
    pixelY,
    pixelX + cellSize,
    pixelY + cellSize,
  );
  gradient.addColorStop(0, lightenColor(color, 0.3));
  gradient.addColorStop(1, darkenColor(color, 0.2));

  ctx.fillStyle = gradient;
  ctx.fillRect(pixelX, pixelY, cellSize, cellSize);
}
