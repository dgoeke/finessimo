/**
 * Pure viewport rendering functions for background and border display.
 *
 * This module contains all viewport-level drawing logic extracted from game-board.tsx.
 * All functions are pure and side-effect free, taking explicit dependencies as parameters.
 */

import {
  boardColsAsNumber,
  visibleRowsAsNumber,
  vanishRowsAsNumber,
  cellSizePxAsNumber,
} from "../types/brands-render";

import type { BoardViewport } from "../types/brands-render";

/**
 * Draw black background only for the visible play area (rows 0-19).
 * Vanish zone remains transparent.
 *
 * @param ctx - Canvas rendering context to draw on
 * @param viewport - Board viewport configuration with dimensions
 */
export const drawPlayAreaBackground = (
  ctx: CanvasRenderingContext2D,
  viewport: BoardViewport,
): void => {
  const cellSize = cellSizePxAsNumber(viewport.cell);
  const boardWidth = boardColsAsNumber(viewport.cols);
  const visibleHeight = visibleRowsAsNumber(viewport.visibleRows);
  const vanishRows = vanishRowsAsNumber(viewport.vanishRows);

  const yOffset = vanishRows * cellSize;
  const playAreaWidth = boardWidth * cellSize;
  const playAreaHeight = visibleHeight * cellSize;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, yOffset, playAreaWidth, playAreaHeight);
};

/**
 * Draw a border around the visible play area (rows 0-19).
 * This replaces the CSS border that was removed from the canvas.
 *
 * @param ctx - Canvas rendering context to draw on
 * @param viewport - Board viewport configuration with dimensions
 */
export const drawPlayAreaBorder = (
  ctx: CanvasRenderingContext2D,
  viewport: BoardViewport,
): void => {
  const cellSize = cellSizePxAsNumber(viewport.cell);
  const boardWidth = boardColsAsNumber(viewport.cols);
  const visibleHeight = visibleRowsAsNumber(viewport.visibleRows);
  const vanishRows = vanishRowsAsNumber(viewport.vanishRows);

  const borderWidth = 2;
  const yOffset = vanishRows * cellSize;
  const playAreaWidth = boardWidth * cellSize;
  const playAreaHeight = visibleHeight * cellSize;

  ctx.strokeStyle = "#333333"; // Similar to CSS --border color
  ctx.lineWidth = borderWidth;

  // Draw rectangle around the visible play area
  ctx.strokeRect(
    borderWidth / 2,
    yOffset + borderWidth / 2,
    playAreaWidth - borderWidth,
    playAreaHeight - borderWidth,
  );
};
