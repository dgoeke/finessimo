/**
 * Pure Overlay Rendering Module - Phase 5 Refactor
 *
 * Handles all overlay rendering logic extracted from game-board.tsx.
 * All functions are pure - they take canvas context, viewport, and data as parameters
 * without accessing component state or causing side effects.
 */

import { assertNever } from "../../state/types";
import { gridCoordAsNumber, createGridCoord } from "../../types/brands";
import {
  lightenColor,
  darkenColor,
  normalizeColorBrightness,
} from "../utils/colors";
import { pathToPath2D } from "../utils/outlines";

import type { OutlineCache } from "./outline-cache";
import type { RenderOverlay } from "../../engine/ui/overlays";
import type { GridCoord } from "../../types/brands";
import type { BoardViewport } from "../types/brands-render";
import type { GridCell, OutlinePath } from "../utils/outlines";

/**
 * Main overlay rendering function with exhaustive switch handling.
 * Renders all overlays in the provided order (caller handles z-order sorting).
 */
export const renderOverlays = (
  ctx: CanvasRenderingContext2D,
  overlays: ReadonlyArray<RenderOverlay>,
  viewport: BoardViewport,
  outlineCache: OutlineCache,
): void => {
  for (const overlay of overlays) {
    switch (overlay.kind) {
      case "ghost":
        renderGhostOverlay(ctx, overlay, viewport);
        break;
      case "target":
        renderTargetOverlay(ctx, overlay, viewport, outlineCache);
        break;
      case "line-flash":
        renderLineFlashOverlay(ctx, overlay, viewport);
        break;
      case "effect-dot":
        renderEffectDotOverlay(ctx, overlay, viewport);
        break;
      case "column-highlight":
        renderColumnHighlightOverlay(ctx, overlay, viewport);
        break;
      default:
        assertNever(overlay);
    }
  }
};

/**
 * Renders a ghost overlay using the piece color at reduced opacity.
 */
const renderGhostOverlay = (
  ctx: CanvasRenderingContext2D,
  overlay: Extract<RenderOverlay, { kind: "ghost" }>,
  viewport: BoardViewport,
): void => {
  const opacity = overlay.opacity ?? 0.35;

  ctx.save();
  ctx.globalAlpha = opacity;

  const cellSize = viewport.cell as unknown as number;
  const boardWidth = viewport.cols as unknown as number;
  const visibleHeight = viewport.visibleRows as unknown as number;
  const vanishRows = viewport.vanishRows as unknown as number;

  for (const [x, y] of overlay.cells) {
    const gridX = gridCoordAsNumber(x);
    const gridY = gridCoordAsNumber(y);

    // Render cells within board bounds (including vanish zone)
    if (
      gridX >= 0 &&
      gridX < boardWidth &&
      gridY >= -vanishRows &&
      gridY < visibleHeight
    ) {
      // Convert board y coordinate to canvas y coordinate
      const canvasY = gridY + vanishRows;
      drawGhostCell(ctx, gridX, canvasY, cellSize);
    }
  }

  ctx.restore();
};

/**
 * Renders a target overlay with configurable style and color.
 */
const renderTargetOverlay = (
  ctx: CanvasRenderingContext2D,
  overlay: Extract<RenderOverlay, { kind: "target" }>,
  viewport: BoardViewport,
  outlineCache: OutlineCache,
): void => {
  const color = overlay.color ?? "#00A2FF";
  const alpha = overlay.alpha ?? 0.25;

  // Collect valid cells to render
  const { validCells, validGridCells } = filterValidCells(
    overlay.cells,
    viewport,
  );

  if (validGridCells.length > 0) {
    if (overlay.style === "outline") {
      drawTargetWithOutline(ctx, {
        alpha,
        color,
        outlineCache,
        validCells,
        validGridCells,
        viewport,
      });
    } else {
      drawTargetWithBorders(ctx, { alpha, color, validCells, viewport });
    }
  }
};

/**
 * Renders a line flash overlay for row clearing animation.
 */
const renderLineFlashOverlay = (
  ctx: CanvasRenderingContext2D,
  overlay: Extract<RenderOverlay, { kind: "line-flash" }>,
  viewport: BoardViewport,
): void => {
  const color = overlay.color ?? "#FFFFFF";
  const intensity = overlay.intensity ?? 1.0;
  const cellSize = viewport.cell as unknown as number;
  const visibleHeight = viewport.visibleRows as unknown as number;
  const vanishRows = viewport.vanishRows as unknown as number;
  const boardWidth = viewport.cols as unknown as number;

  ctx.save();
  ctx.globalCompositeOperation = "lighter"; // Additive blending for flash effect
  ctx.globalAlpha = intensity;
  ctx.fillStyle = color;

  for (const row of overlay.rows) {
    // Only render rows within visible board area
    if (row >= 0 && row < visibleHeight) {
      // Convert to canvas coordinates
      const pixelY = (row + vanishRows) * cellSize;
      ctx.fillRect(0, pixelY, boardWidth * cellSize, cellSize);
    }
  }

  ctx.restore();
};

/**
 * Renders a column highlight overlay for guided mode active piece spotlight.
 */
const renderColumnHighlightOverlay = (
  ctx: CanvasRenderingContext2D,
  overlay: Extract<RenderOverlay, { kind: "column-highlight" }>,
  viewport: BoardViewport,
): void => {
  const color = overlay.color ?? "#CCCCCC"; // Default to light grey
  const intensity = overlay.intensity ?? 0.08;
  const cellSize = viewport.cell as unknown as number;
  const boardWidth = viewport.cols as unknown as number;
  const visibleHeight = viewport.visibleRows as unknown as number;
  const vanishRows = viewport.vanishRows as unknown as number;

  ctx.save();
  // Use normal composite mode since we're behind the grid
  ctx.globalAlpha = intensity;
  ctx.fillStyle = color;

  for (const column of overlay.columns) {
    // Only render columns within visible board area
    if (column >= 0 && column < boardWidth) {
      const pixelX = column * cellSize;
      const yOffset = vanishRows * cellSize; // Start at visible area
      const playAreaHeight = visibleHeight * cellSize;
      ctx.fillRect(pixelX, yOffset, cellSize, playAreaHeight);
    }
  }

  ctx.restore();
};

/**
 * Renders an effect dot overlay for finesse feedback and other effects.
 */
const renderEffectDotOverlay = (
  ctx: CanvasRenderingContext2D,
  overlay: Extract<RenderOverlay, { kind: "effect-dot" }>,
  viewport: BoardViewport,
): void => {
  const [x, y] = overlay.at;
  const gridX = gridCoordAsNumber(x);
  const gridY = gridCoordAsNumber(y);
  const cellSize = viewport.cell as unknown as number;
  const boardWidth = viewport.cols as unknown as number;
  const visibleHeight = viewport.visibleRows as unknown as number;
  const vanishRows = viewport.vanishRows as unknown as number;

  // Only render effects within visible board area
  if (gridX < 0 || gridX >= boardWidth || gridY < 0 || gridY >= visibleHeight) {
    return;
  }

  const color = overlay.color ?? "#FFFF00";
  const size = overlay.size ?? 1.0;

  // Convert to canvas coordinates
  const pixelX = gridX * cellSize + cellSize / 2;
  const pixelY = (gridY + vanishRows) * cellSize + cellSize / 2;
  const radius = cellSize * 0.3 * size;

  ctx.save();

  // Apply effect-specific rendering based on style
  switch (overlay.style) {
    case "pulse":
      // Pulsing circle with glow
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = color;
      ctx.filter = `blur(${String(radius * 0.2)}px)`;
      ctx.beginPath();
      ctx.arc(pixelX, pixelY, radius, 0, 2 * Math.PI);
      ctx.fill();
      break;

    case "sparkle":
      // Sparkle effect with small bright points
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = color;
      ctx.fillRect(
        pixelX - radius * 0.5,
        pixelY - radius * 0.5,
        radius,
        radius,
      );
      break;

    case "fade":
      // Simple fading circle
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pixelX, pixelY, radius, 0, 2 * Math.PI);
      ctx.fill();
      break;

    default:
      assertNever(overlay.style);
  }

  ctx.restore();
};

/**
 * Filter cells to only include those within board bounds (including vanish zone).
 */
const filterValidCells = (
  cells: ReadonlyArray<readonly [GridCoord, GridCoord]>,
  viewport: BoardViewport,
): {
  validCells: Array<[number, number]>;
  validGridCells: Array<GridCell>;
} => {
  const validCells: Array<[number, number]> = [];
  const validGridCells: Array<GridCell> = [];
  const boardWidth = viewport.cols as unknown as number;
  const visibleHeight = viewport.visibleRows as unknown as number;
  const vanishRows = viewport.vanishRows as unknown as number;

  for (const [x, y] of cells) {
    const gridX = gridCoordAsNumber(x);
    const gridY = gridCoordAsNumber(y);

    if (
      gridX >= 0 &&
      gridX < boardWidth &&
      gridY >= -vanishRows &&
      gridY < visibleHeight
    ) {
      // Convert board y coordinate to canvas y coordinate for both arrays
      const canvasY = gridY + vanishRows;
      validCells.push([gridX, canvasY]);
      // Also provide canvas coordinates for outline computation
      validGridCells.push([x, createGridCoord(canvasY)]);
    }
  }

  return { validCells, validGridCells };
};

/**
 * Draw target with outline style.
 */
const drawTargetWithOutline = (
  ctx: CanvasRenderingContext2D,
  options: {
    validGridCells: Array<GridCell>;
    validCells: Array<[number, number]>;
    alpha: number;
    color: string;
    viewport: BoardViewport;
    outlineCache: OutlineCache;
  },
): void => {
  const { alpha, color, outlineCache, validCells, validGridCells, viewport } =
    options;
  const cellSize = viewport.cell as unknown as number;

  // First: Draw solid fill for each cell
  for (const [gridX, gridY] of validCells) {
    drawTargetCellFill(ctx, { alpha, cellSize, color, x: gridX, y: gridY });
  }

  // Second: Draw single thick outline around entire piece (on top)
  const outline = outlineCache.get(validGridCells);
  drawTargetPieceOutline(
    ctx,
    outline,
    {
      lineCap: "square",
      lineJoin: "miter",
      lineWidthPx: Math.max(3, cellSize * 0.12),
      strokeColor: "#444444",
    },
    cellSize,
  );
};

/**
 * Draw target with individual cell borders.
 */
const drawTargetWithBorders = (
  ctx: CanvasRenderingContext2D,
  options: {
    validCells: Array<[number, number]>;
    color: string;
    alpha: number;
    viewport: BoardViewport;
  },
): void => {
  const { alpha, color, validCells, viewport } = options;
  const cellSize = viewport.cell as unknown as number;

  // First: Draw solid fills
  for (const [gridX, gridY] of validCells) {
    drawTargetCellFill(ctx, { alpha, cellSize, color, x: gridX, y: gridY });
  }

  // Second: Draw borders on top
  for (const [gridX, gridY] of validCells) {
    drawHighlightCellBorder(ctx, gridX, gridY, cellSize);
  }
};

/**
 * Draws a ghost cell with gradient and border effects.
 */
const drawGhostCell = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellSize: number,
): void => {
  const pixelX = x * cellSize;
  const pixelY = y * cellSize;

  const color = "#111111";
  const borderColor = "#777777"; // Brighter border (was #555555)

  // Create subtle gradient for depth with interior margin
  const margin = 4;
  const gradient = ctx.createLinearGradient(
    pixelX + margin,
    pixelY + margin,
    pixelX + cellSize - margin,
    pixelY + cellSize - margin,
  );
  gradient.addColorStop(0, lightenColor(color, 0.1));
  gradient.addColorStop(1, darkenColor(color, 0.9));

  ctx.fillStyle = gradient;
  ctx.fillRect(
    pixelX + margin,
    pixelY + margin,
    cellSize - margin * 2,
    cellSize - margin * 2,
  );

  // Add subtle highlight on top edge
  ctx.fillStyle = lightenColor(color, 0.1);
  ctx.fillRect(pixelX, pixelY, cellSize, 2);

  // Add subtle shadow on bottom edge
  ctx.fillStyle = darkenColor(color, 0.3);
  ctx.fillRect(pixelX, pixelY + cellSize - 2, cellSize, 2);

  // Draw refined border
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(pixelX + 1, pixelY + 1, cellSize - 2, cellSize - 2);
};

/**
 * Draws a solid color fill for a target cell.
 */
const drawTargetCellFill = (
  ctx: CanvasRenderingContext2D,
  options: {
    x: number;
    y: number;
    color: string;
    alpha: number;
    cellSize: number;
  },
): void => {
  const { alpha, cellSize, color, x, y } = options;
  const pixelX = x * cellSize;
  const pixelY = y * cellSize;

  // Draw solid fill with normalized brightness
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = normalizeColorBrightness(color, 0.15);
  ctx.fillRect(pixelX, pixelY, cellSize, cellSize);
  ctx.restore();
};

/**
 * Draws individual cell border for non-outline styles.
 */
const drawHighlightCellBorder = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellSize: number,
): void => {
  const pixelX = x * cellSize;
  const pixelY = y * cellSize;

  // Draw border on top of fill
  ctx.save();
  ctx.strokeStyle = "#444444";
  ctx.lineWidth = 2;
  ctx.strokeRect(pixelX + 1, pixelY + 1, cellSize - 2, cellSize - 2);
  ctx.restore();
};

/**
 * Draws a thick outline around the target piece using the precomputed path.
 */
const drawTargetPieceOutline = (
  ctx: CanvasRenderingContext2D,
  outline: OutlinePath,
  style: {
    lineCap?: CanvasLineCap;
    lineJoin?: CanvasLineJoin;
    lineWidthPx: number;
    strokeColor: string;
  },
  cellSize: number,
): void => {
  if (outline.length === 0) return;

  const path2d = pathToPath2D(outline, cellSize);

  ctx.save();
  ctx.strokeStyle = style.strokeColor;
  ctx.lineWidth = style.lineWidthPx;
  ctx.lineJoin = style.lineJoin ?? "miter";
  ctx.lineCap = style.lineCap ?? "square";
  ctx.stroke(path2d);
  ctx.restore();
};
