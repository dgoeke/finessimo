/**
 * Pure rendering functions for mini board visualization.
 *
 * This module provides functions to render a miniature board showing
 * the bottom 5 rows (15-19) of the game board with a target piece.
 * Used for finesse result card visualization.
 */

import { PIECES } from "../../core/pieces";
import { idx } from "../../state/types";
import { createGridCoord, gridCoordAsNumber } from "../../types/brands";

import { getCellColor } from "./cells";

import type { Board, ActivePiece } from "../../state/types";

// Mini board constants
const MINI_BOARD_WIDTH = 10 as const;
const MINI_BOARD_HEIGHT = 5 as const; // Shows rows 15-19
const MINI_CELL_SIZE = 30 as const; // Full size, will be scaled via CSS
const MINI_BOARD_START_ROW = 15 as const; // First row to display

/**
 * Creates a canvas element for the mini board with proper dimensions.
 *
 * @returns Canvas element ready for mini board rendering
 */
export function createMiniCanvasElement(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = MINI_BOARD_WIDTH * MINI_CELL_SIZE;
  canvas.height = MINI_BOARD_HEIGHT * MINI_CELL_SIZE;
  canvas.className = "mini-board-canvas";
  return canvas;
}

/**
 * Maps main board row to mini board row.
 * Rows 15-19 from main board become rows 0-4 in mini board.
 *
 * @param mainBoardRow - Row index in main board (0-19)
 * @returns Mini board row index (0-4) or null if row not shown
 */
function mapToMiniRow(mainBoardRow: number): number | null {
  if (
    mainBoardRow < MINI_BOARD_START_ROW ||
    mainBoardRow >= MINI_BOARD_START_ROW + MINI_BOARD_HEIGHT
  ) {
    return null;
  }
  return mainBoardRow - MINI_BOARD_START_ROW;
}

/**
 * Draws the background for the mini board.
 *
 * @param ctx - Canvas rendering context
 */
export function drawMiniBackground(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#000000";
  ctx.fillRect(
    0,
    0,
    MINI_BOARD_WIDTH * MINI_CELL_SIZE,
    MINI_BOARD_HEIGHT * MINI_CELL_SIZE,
  );
}

/**
 * Draws grid lines on the mini board.
 *
 * @param ctx - Canvas rendering context
 */
export function drawMiniGrid(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = "#333333";
  ctx.lineWidth = 1;

  // Vertical lines
  for (let x = 0; x <= MINI_BOARD_WIDTH; x++) {
    const pixelX = x * MINI_CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(pixelX, 0);
    ctx.lineTo(pixelX, MINI_BOARD_HEIGHT * MINI_CELL_SIZE);
    ctx.stroke();
  }

  // Horizontal lines
  for (let y = 0; y <= MINI_BOARD_HEIGHT; y++) {
    const pixelY = y * MINI_CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(0, pixelY);
    ctx.lineTo(MINI_BOARD_WIDTH * MINI_CELL_SIZE, pixelY);
    ctx.stroke();
  }
}

/**
 * Draws the border around the mini board.
 *
 * @param ctx - Canvas rendering context
 */
export function drawMiniBorder(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = "#333333";
  ctx.lineWidth = 2;
  ctx.strokeRect(
    0,
    0,
    MINI_BOARD_WIDTH * MINI_CELL_SIZE,
    MINI_BOARD_HEIGHT * MINI_CELL_SIZE,
  );
}

/**
 * Draws board cells in the mini board area.
 * Only cells in rows 15-19 are rendered.
 *
 * @param ctx - Canvas rendering context
 * @param board - Game board state
 */
export function drawMiniBoardCells(
  ctx: CanvasRenderingContext2D,
  board: Board,
): void {
  for (let x = 0; x < MINI_BOARD_WIDTH; x++) {
    for (
      let mainRow = MINI_BOARD_START_ROW;
      mainRow < MINI_BOARD_START_ROW + MINI_BOARD_HEIGHT;
      mainRow++
    ) {
      const miniRow = mapToMiniRow(mainRow);
      if (miniRow === null) continue;
      // At this point, TypeScript knows miniRow is not null, but we need to assert it's a number
      const miniRowValue: number = miniRow;

      const cellIndex = idx(
        board,
        createGridCoord(x),
        createGridCoord(mainRow),
      );
      const cellValue = board.cells[cellIndex];

      if (cellValue !== undefined && cellValue !== 0) {
        const color = getCellColor(cellValue);
        ctx.fillStyle = color;

        const pixelX = x * MINI_CELL_SIZE;
        const pixelY = miniRowValue * MINI_CELL_SIZE;

        ctx.fillRect(pixelX, pixelY, MINI_CELL_SIZE, MINI_CELL_SIZE);
      }
    }
  }
}

/**
 * Draws a piece on the mini board at its final position.
 * Only cells within the mini board area (rows 15-19) are rendered.
 *
 * @param ctx - Canvas rendering context
 * @param piece - Active piece to render
 */
export function drawMiniPiece(
  ctx: CanvasRenderingContext2D,
  piece: ActivePiece,
): void {
  const shape = PIECES[piece.id];
  const cells = shape.cells[piece.rot];
  const color = shape.color;

  ctx.fillStyle = color;

  for (const [dx, dy] of cells) {
    const absoluteX = gridCoordAsNumber(piece.x) + dx;
    const absoluteY = gridCoordAsNumber(piece.y) + dy;

    // Check if cell is within mini board bounds
    if (absoluteX < 0 || absoluteX >= MINI_BOARD_WIDTH) continue;
    if (
      absoluteY < MINI_BOARD_START_ROW ||
      absoluteY >= MINI_BOARD_START_ROW + MINI_BOARD_HEIGHT
    )
      continue;

    const miniRow = mapToMiniRow(absoluteY);
    if (miniRow === null) continue;
    const miniRowValue: number = miniRow;

    const pixelX = absoluteX * MINI_CELL_SIZE;
    const pixelY = miniRowValue * MINI_CELL_SIZE;

    ctx.fillRect(pixelX, pixelY, MINI_CELL_SIZE, MINI_CELL_SIZE);
  }
}

/**
 * Renders a complete mini board with background, grid, border, board cells, and target piece.
 *
 * @param ctx - Canvas rendering context
 * @param board - Game board state
 * @param targetPiece - Target piece to display
 */
export function renderMiniBoard(
  ctx: CanvasRenderingContext2D,
  board: Board,
  targetPiece: ActivePiece,
): void {
  // Clear canvas
  ctx.clearRect(
    0,
    0,
    MINI_BOARD_WIDTH * MINI_CELL_SIZE,
    MINI_BOARD_HEIGHT * MINI_CELL_SIZE,
  );

  // Draw layers in order
  drawMiniBackground(ctx);
  drawMiniBoardCells(ctx, board);
  drawMiniPiece(ctx, targetPiece);
  drawMiniGrid(ctx);
  drawMiniBorder(ctx);
}
