import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html } from "lit";
import { customElement, query } from "lit/decorators.js";

import { PIECES } from "../../core/pieces";
import { selectBoardRenderModel } from "../../engine/selectors/board-render";
import { gameStateSignal, stateSelectors } from "../../state/signals";
import { assertNever } from "../../state/types";
import { gridCoordAsNumber } from "../../types/brands";
import {
  lightenColor,
  darkenColor,
  normalizeColorBrightness,
} from "../utils/colors";
import {
  computeOutlinePaths,
  getCellsHash,
  pathToPath2D,
} from "../utils/outlines";

import type { RenderOverlay } from "../../engine/ui/overlays";
import type { GameState, Board, ActivePiece } from "../../state/types";
import type { GridCoord } from "../../types/brands";
import type { GridCell, OutlinePath } from "../utils/outlines";

/**
 * Game board canvas renderer with per-frame updates.
 *
 * Design Note: The board intentionally re-renders every tick (60fps) to support
 * smooth animations for line clears, effects, and piece movement. The hasStateChanged
 * check prevents unnecessary selector re-computation but does NOT prevent canvas draws,
 * as the canvas needs to update each frame for visual continuity.
 *
 * Performance considerations:
 * - Grid drawing runs each frame but could be cached to an offscreen canvas
 * - Outline paths are cached by cell coordinates to avoid recomputation
 * - Most render operations are optimized for 60fps performance
 */
@customElement("game-board")
export class GameBoard extends SignalWatcher(LitElement) {
  @query("canvas") private canvas!: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | undefined;
  private readonly cellSize = 30;
  private readonly boardWidth = 10;
  private readonly boardHeight = 20;
  private readonly outlineCache = new Map<string, OutlinePath>();
  private gridCanvas?: OffscreenCanvas;
  private gridCtx?: OffscreenCanvasRenderingContext2D;
  private lastRenderState?: {
    active: GameState["active"];
    board: GameState["board"];
    boardDecorations: GameState["boardDecorations"];
    tick: GameState["tick"];
    overlays: ReadonlyArray<RenderOverlay>;
  };

  // Use light DOM for consistent styling
  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  protected firstUpdated(): void {
    // Initialize canvas context and size
    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D rendering context");
    }
    this.ctx = ctx;

    // Set canvas size
    this.canvas.width = this.boardWidth * this.cellSize;
    this.canvas.height = this.boardHeight * this.cellSize;

    // Lit will automatically call updated() after firstUpdated() completes
  }

  protected updated(): void {
    if (!this.ctx) {
      return;
    }

    // Get current state from the signal (reactive subscription)
    const gameState = gameStateSignal.get();
    const boardState = stateSelectors.getBoardState(gameState);
    const renderModel = selectBoardRenderModel(gameState);

    // Combine board state with overlay data for change detection
    const currentRenderState = {
      ...boardState,
      overlays: renderModel.overlays,
    };

    // Only re-render if the relevant state has actually changed
    if (this.hasStateChanged(currentRenderState)) {
      this.renderGameBoard(gameState, renderModel);
      this.lastRenderState = currentRenderState;
    }
  }

  private hasStateChanged(newState: {
    active: GameState["active"];
    board: GameState["board"];
    boardDecorations: GameState["boardDecorations"];
    tick: GameState["tick"];
    overlays: ReadonlyArray<RenderOverlay>;
  }): boolean {
    if (!this.lastRenderState) {
      return true;
    }

    // Compare active piece
    if (this.lastRenderState.active !== newState.active) {
      return true;
    }

    // Compare board state (reference equality is sufficient since board is immutable)
    if (this.lastRenderState.board !== newState.board) {
      return true;
    }

    // Compare board decorations (legacy bridge - will be removed later)
    if (this.lastRenderState.boardDecorations !== newState.boardDecorations) {
      return true;
    }

    // Compare overlays (reference equality check for the array itself)
    if (this.lastRenderState.overlays !== newState.overlays) {
      return true;
    }

    // Compare tick for any other changes
    if (this.lastRenderState.tick !== newState.tick) {
      return true;
    }

    return false;
  }

  protected render(): unknown {
    return html`<canvas></canvas>`;
  }

  private renderGameBoard(
    gameState: GameState,
    renderModel: ReturnType<typeof selectBoardRenderModel>,
  ): void {
    if (!this.ctx) {
      console.error("Canvas not initialized");
      return;
    }

    // Clear canvas
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Render overlays first (those with z < 1, like column highlight)
    const backgroundOverlays = renderModel.overlays.filter((o) => o.z < 1);
    this.renderOverlays(backgroundOverlays);

    // Render board
    this.renderBoard(gameState.board);

    // Draw grid
    this.drawGrid();

    // Render overlays above grid (those with z >= 1)
    const foregroundOverlays = renderModel.overlays.filter((o) => o.z >= 1);
    this.renderOverlays(foregroundOverlays);

    // Render active piece (active piece is not an overlay, always renders on top)
    if (gameState.active) {
      this.renderActivePiece(gameState.active);
    }
  }

  /**
   * Renders all overlays in z-order using the unified overlay system.
   * Each overlay type has its own specialized rendering logic.
   */
  private renderOverlays(overlays: ReadonlyArray<RenderOverlay>): void {
    if (!this.ctx) return;

    for (const overlay of overlays) {
      switch (overlay.kind) {
        case "ghost":
          this.renderGhostOverlay(overlay);
          break;
        case "target":
          this.renderTargetOverlay(overlay);
          break;
        case "line-flash":
          this.renderLineFlashOverlay(overlay);
          break;
        case "effect-dot":
          this.renderEffectDotOverlay(overlay);
          break;
        case "column-highlight":
          this.renderColumnHighlightOverlay(overlay);
          break;
        default:
          assertNever(overlay);
      }
    }
  }

  /**
   * Renders a ghost overlay using the piece color at reduced opacity.
   */
  private renderGhostOverlay(
    overlay: Extract<RenderOverlay, { kind: "ghost" }>,
  ): void {
    if (!this.ctx) return;

    const opacity = overlay.opacity ?? 0.35;

    this.ctx.save();
    this.ctx.globalAlpha = opacity;

    for (const [x, y] of overlay.cells) {
      const gridX = gridCoordAsNumber(x);
      const gridY = gridCoordAsNumber(y);

      // Only render cells within visible board area
      if (
        gridX >= 0 &&
        gridX < this.boardWidth &&
        gridY >= 0 &&
        gridY < this.boardHeight
      ) {
        this.drawGhostCell(gridX, gridY);
      }
    }

    this.ctx.restore();
  }

  /**
   * Renders a target overlay with configurable style and color.
   */
  private renderTargetOverlay(
    overlay: Extract<RenderOverlay, { kind: "target" }>,
  ): void {
    if (!this.ctx) return;

    const color = overlay.color ?? "#00A2FF";
    const alpha = overlay.alpha ?? 0.25;

    // Collect valid cells to render
    const { validCells, validGridCells } = this.filterValidCells(overlay.cells);

    if (validGridCells.length > 0) {
      if (overlay.style === "outline") {
        this.drawTargetWithOutline(validGridCells, validCells, alpha, color);
      } else {
        this.drawTargetWithBorders(validCells, color, alpha);
      }
    }
  }

  /**
   * Filter cells to only include those within visible board bounds.
   */
  private filterValidCells(
    cells: ReadonlyArray<readonly [GridCoord, GridCoord]>,
  ): {
    validCells: Array<[number, number]>;
    validGridCells: Array<GridCell>;
  } {
    const validCells: Array<[number, number]> = [];
    const validGridCells: Array<GridCell> = [];

    for (const [x, y] of cells) {
      const gridX = gridCoordAsNumber(x);
      const gridY = gridCoordAsNumber(y);

      if (
        gridX >= 0 &&
        gridX < this.boardWidth &&
        gridY >= 0 &&
        gridY < this.boardHeight
      ) {
        validCells.push([gridX, gridY]);
        validGridCells.push([x, y]);
      }
    }

    return { validCells, validGridCells };
  }

  /**
   * Draw target with outline style.
   */
  private drawTargetWithOutline(
    validGridCells: Array<GridCell>,
    validCells: Array<[number, number]>,
    alpha: number,
    color: string,
  ): void {
    // First: Draw solid fill for each cell
    for (const [gridX, gridY] of validCells) {
      this.drawTargetCellFill(gridX, gridY, color, alpha);
    }

    // Second: Draw single thick outline around entire piece (on top)
    const outline = this.getCachedOutline(validGridCells);
    this.drawTargetPieceOutline(outline, {
      lineCap: "square",
      lineJoin: "miter",
      lineWidthPx: Math.max(3, this.cellSize * 0.12),
      strokeColor: "#444444",
    });
  }

  /**
   * Draw target with individual cell borders.
   */
  private drawTargetWithBorders(
    validCells: Array<[number, number]>,
    color: string,
    alpha: number,
  ): void {
    // First: Draw solid fills
    for (const [gridX, gridY] of validCells) {
      this.drawTargetCellFill(gridX, gridY, color, alpha);
    }

    // Second: Draw borders on top
    for (const [gridX, gridY] of validCells) {
      this.drawHighlightCellBorder(gridX, gridY, color, alpha);
    }
  }

  /**
   * Renders a line flash overlay for row clearing animation.
   */
  private renderLineFlashOverlay(
    overlay: Extract<RenderOverlay, { kind: "line-flash" }>,
  ): void {
    if (!this.ctx) return;

    const color = overlay.color ?? "#FFFFFF";
    const intensity = overlay.intensity ?? 1.0;

    this.ctx.save();
    this.ctx.globalCompositeOperation = "lighter"; // Additive blending for flash effect
    this.ctx.globalAlpha = intensity;
    this.ctx.fillStyle = color;

    for (const row of overlay.rows) {
      // Only render rows within visible board area
      if (row >= 0 && row < this.boardHeight) {
        const pixelY = row * this.cellSize;
        this.ctx.fillRect(0, pixelY, this.canvas.width, this.cellSize);
      }
    }

    this.ctx.restore();
  }

  /**
   * Renders a column highlight overlay for guided mode active piece spotlight.
   */
  private renderColumnHighlightOverlay(
    overlay: Extract<RenderOverlay, { kind: "column-highlight" }>,
  ): void {
    if (!this.ctx) return;

    const color = overlay.color ?? "#CCCCCC"; // Default to light grey
    const intensity = overlay.intensity ?? 0.08;

    this.ctx.save();
    // Use normal composite mode since we're behind the grid
    this.ctx.globalAlpha = intensity;
    this.ctx.fillStyle = color;

    for (const column of overlay.columns) {
      // Only render columns within visible board area
      if (column >= 0 && column < this.boardWidth) {
        const pixelX = column * this.cellSize;
        this.ctx.fillRect(pixelX, 0, this.cellSize, this.canvas.height);
      }
    }

    this.ctx.restore();
  }

  /**
   * Renders an effect dot overlay for finesse feedback and other effects.
   */
  private renderEffectDotOverlay(
    overlay: Extract<RenderOverlay, { kind: "effect-dot" }>,
  ): void {
    if (!this.ctx) return;

    const [x, y] = overlay.at;
    const gridX = gridCoordAsNumber(x);
    const gridY = gridCoordAsNumber(y);

    // Only render effects within visible board area
    if (
      gridX < 0 ||
      gridX >= this.boardWidth ||
      gridY < 0 ||
      gridY >= this.boardHeight
    ) {
      return;
    }

    const color = overlay.color ?? "#FFFF00";
    const size = overlay.size ?? 1.0;

    const pixelX = gridX * this.cellSize + this.cellSize / 2;
    const pixelY = gridY * this.cellSize + this.cellSize / 2;
    const radius = this.cellSize * 0.3 * size;

    this.ctx.save();

    // Apply effect-specific rendering based on style
    switch (overlay.style) {
      case "pulse":
        // Pulsing circle with glow
        this.ctx.globalCompositeOperation = "lighter";
        this.ctx.fillStyle = color;
        this.ctx.filter = `blur(${String(radius * 0.2)}px)`;
        this.ctx.beginPath();
        this.ctx.arc(pixelX, pixelY, radius, 0, 2 * Math.PI);
        this.ctx.fill();
        break;

      case "sparkle":
        // Sparkle effect with small bright points
        this.ctx.globalCompositeOperation = "lighter";
        this.ctx.fillStyle = color;
        this.ctx.fillRect(
          pixelX - radius * 0.5,
          pixelY - radius * 0.5,
          radius,
          radius,
        );
        break;

      case "fade":
        // Simple fading circle
        this.ctx.globalAlpha = 0.7;
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(pixelX, pixelY, radius, 0, 2 * Math.PI);
        this.ctx.fill();
        break;

      default:
        assertNever(overlay.style);
    }

    this.ctx.restore();
  }

  private renderBoard(board: Board): void {
    if (!this.ctx) return;

    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const cellValue = board.cells[y * board.width + x];
        if (cellValue !== undefined && cellValue !== 0) {
          const color = this.getCellColor(cellValue);
          this.drawCell(x, y, color);
        }
      }
    }
  }

  private renderActivePiece(piece: ActivePiece): void {
    if (!this.ctx) return;

    const shape = PIECES[piece.id];
    const cells = shape.cells[piece.rot];

    this.ctx.fillStyle = shape.color;

    for (const [dx, dy] of cells) {
      const x = piece.x + dx;
      const y = piece.y + dy;

      // Render cells that are within the board width and visible height
      // Allow rendering above the board (negative y) but clamp to visible area
      if (x >= 0 && x < this.boardWidth && y < this.boardHeight) {
        // If y is negative, render at y=0 (top of visible board)
        const renderY = Math.max(0, y);
        this.drawCell(x, renderY, shape.color);
      }
    }
  }

  private drawCell(x: number, y: number, color: string): void {
    if (!this.ctx) return;

    const pixelX = x * this.cellSize;
    const pixelY = y * this.cellSize;

    // Create subtle gradient for depth
    const gradient = this.ctx.createLinearGradient(
      pixelX,
      pixelY,
      pixelX + this.cellSize,
      pixelY + this.cellSize,
    );
    gradient.addColorStop(0, lightenColor(color, 0.3));
    gradient.addColorStop(1, darkenColor(color, 0.2));

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(pixelX, pixelY, this.cellSize, this.cellSize);

    // Add subtle highlight on top edge
    this.ctx.fillStyle = lightenColor(color, 0.4);
    this.ctx.fillRect(pixelX, pixelY, this.cellSize, 2);

    // Add subtle shadow on bottom edge
    this.ctx.fillStyle = darkenColor(color, 0.3);
    this.ctx.fillRect(pixelX, pixelY + this.cellSize - 2, this.cellSize, 2);

    // Draw refined border
    this.ctx.strokeStyle = darkenColor(color, 0.3);
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(pixelX, pixelY, this.cellSize, this.cellSize);
  }

  private drawGhostCell(x: number, y: number): void {
    if (!this.ctx) return;

    const pixelX = x * this.cellSize;
    const pixelY = y * this.cellSize;

    const color = "#111111";
    const borderColor = "#777777"; // Brighter border (was #555555)

    // Create subtle gradient for depth with interior margin
    const margin = 4;
    const gradient = this.ctx.createLinearGradient(
      pixelX + margin,
      pixelY + margin,
      pixelX + this.cellSize - margin,
      pixelY + this.cellSize - margin,
    );
    gradient.addColorStop(0, lightenColor(color, 0.1));
    gradient.addColorStop(1, darkenColor(color, 0.9));

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(
      pixelX + margin,
      pixelY + margin,
      this.cellSize - margin * 2,
      this.cellSize - margin * 2,
    );

    // Add subtle highlight on top edge
    this.ctx.fillStyle = lightenColor(color, 0.1);
    this.ctx.fillRect(pixelX, pixelY, this.cellSize, 2);

    // Add subtle shadow on bottom edge
    this.ctx.fillStyle = darkenColor(color, 0.3);
    this.ctx.fillRect(pixelX, pixelY + this.cellSize - 2, this.cellSize, 2);

    // Draw refined border
    // this.ctx.strokeStyle = darkenColor(borderColor, 0.3);
    this.ctx.strokeStyle = borderColor;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(
      pixelX + 1,
      pixelY + 1,
      this.cellSize - 2,
      this.cellSize - 2,
    );
  }

  /**
   * Draws a solid color fill for a target cell.
   */
  private drawTargetCellFill(
    x: number,
    y: number,
    color: string,
    alpha: number,
  ): void {
    if (!this.ctx) return;
    const pixelX = x * this.cellSize;
    const pixelY = y * this.cellSize;

    // Draw solid fill with normalized brightness
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = normalizeColorBrightness(color, 0.15);
    this.ctx.fillRect(pixelX, pixelY, this.cellSize, this.cellSize);
    this.ctx.restore();
  }

  /**
   * Draws individual cell border for non-outline styles.
   */
  private drawHighlightCellBorder(
    x: number,
    y: number,
    _color: string,
    _alpha: number,
  ): void {
    if (!this.ctx) return;
    const pixelX = x * this.cellSize;
    const pixelY = y * this.cellSize;

    // Draw border on top of fill
    this.ctx.save();
    this.ctx.strokeStyle = "#444444";
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(
      pixelX + 1,
      pixelY + 1,
      this.cellSize - 2,
      this.cellSize - 2,
    );
    this.ctx.restore();
  }

  /**
   * Gets or computes the cached outline path for a set of cells.
   * Uses a stable hash of cell coordinates for cache key to avoid collisions.
   */
  private getCachedOutline(cells: ReadonlyArray<GridCell>): OutlinePath {
    const cacheKey = getCellsHash(cells);
    const cached = this.outlineCache.get(cacheKey);
    if (cached) return cached;

    const paths = computeOutlinePaths(cells);
    const outline = paths[0] ?? [];
    this.outlineCache.set(cacheKey, outline);
    return outline;
  }

  /**
   * Draws a thick outline around the target piece using the precomputed path.
   */
  private drawTargetPieceOutline(
    outline: OutlinePath,
    style: {
      lineCap?: CanvasLineCap;
      lineJoin?: CanvasLineJoin;
      lineWidthPx: number;
      strokeColor: string;
    },
  ): void {
    if (!this.ctx || outline.length === 0) return;

    const path2d = pathToPath2D(outline, this.cellSize);

    this.ctx.save();
    this.ctx.strokeStyle = style.strokeColor;
    this.ctx.lineWidth = style.lineWidthPx;
    this.ctx.lineJoin = style.lineJoin ?? "miter";
    this.ctx.lineCap = style.lineCap ?? "square";
    this.ctx.stroke(path2d);
    this.ctx.restore();
  }

  /**
   * Initialize or get the cached grid canvas.
   * The grid is static and only needs to be drawn once.
   */
  private getGridCanvas(): OffscreenCanvas {
    if (!this.gridCanvas || !this.gridCtx) {
      // Create offscreen canvas for grid
      this.gridCanvas = new OffscreenCanvas(
        this.boardWidth * this.cellSize,
        this.boardHeight * this.cellSize,
      );

      const ctx = this.gridCanvas.getContext("2d");
      if (!ctx) {
        throw new Error("Failed to get 2D context for grid canvas");
      }
      this.gridCtx = ctx;

      // Draw grid once to the offscreen canvas
      this.drawGridToCanvas(this.gridCtx);
    }

    return this.gridCanvas;
  }

  /**
   * Draw the grid lines to the specified canvas context.
   * This is called once to cache the grid on an offscreen canvas.
   */
  private drawGridToCanvas(ctx: OffscreenCanvasRenderingContext2D): void {
    ctx.strokeStyle = "#222222";
    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x <= this.boardWidth; x++) {
      const pixelX = x * this.cellSize;
      ctx.beginPath();
      ctx.moveTo(pixelX, 0);
      ctx.lineTo(pixelX, this.boardHeight * this.cellSize);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y <= this.boardHeight; y++) {
      const pixelY = y * this.cellSize;
      ctx.beginPath();
      ctx.moveTo(0, pixelY);
      ctx.lineTo(this.boardWidth * this.cellSize, pixelY);
      ctx.stroke();
    }
  }

  /**
   * Draw the cached grid to the main canvas.
   * Much more efficient than redrawing all the lines each frame.
   */
  private drawGrid(): void {
    if (!this.ctx) return;

    // Draw the cached grid canvas
    const gridCanvas = this.getGridCanvas();
    this.ctx.drawImage(gridCanvas, 0, 0);
  }

  private getCellColor(cellValue: number): string {
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
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.ctx = undefined;
    delete this.gridCtx;
    delete this.gridCanvas;
    this.outlineCache.clear();
  }
}
