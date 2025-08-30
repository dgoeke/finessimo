import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html } from "lit";
import { customElement, query } from "lit/decorators.js";

import { calculateGhostPosition } from "../../core/board";
import { PIECES } from "../../core/pieces";
import { selectBoardRenderModel } from "../../engine/selectors/board-render";
import { gameStateSignal, stateSelectors } from "../../state/signals";
import { gridCoordAsNumber } from "../../types/brands";
import {
  lightenColor,
  darkenColor,
  normalizeColorBrightness,
} from "../utils/colors";

import type { RenderOverlay } from "../../engine/ui/overlays";
import type { GameState, Board, ActivePiece } from "../../state/types";

@customElement("game-board")
export class GameBoard extends SignalWatcher(LitElement) {
  @query("canvas") private canvas!: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | undefined;
  private readonly cellSize = 30;
  private readonly boardWidth = 10;
  private readonly boardHeight = 20;
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
    _renderModel: ReturnType<typeof selectBoardRenderModel>,
  ): void {
    if (!this.ctx) {
      console.error("Canvas not initialized");
      return;
    }

    // Clear canvas
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Render board
    this.renderBoard(gameState.board);

    // For now, use legacy rendering to maintain compatibility
    // TODO: Replace with unified overlay system once coordinate handling is resolved
    this.renderLegacyOverlays(gameState);

    // Render active piece (active piece is not an overlay, always renders on top)
    if (gameState.active) {
      this.renderActivePiece(gameState.active);
    }

    // Draw grid
    this.drawGrid();
  }

  // TODO: Implement unified overlay rendering system
  // private renderOverlays(overlays: ReadonlyArray<RenderOverlay>): void { ... }

  /**
   * Legacy overlay rendering method - maintains backward compatibility
   * This includes the original ghost piece and board decoration rendering
   */
  private renderLegacyOverlays(gameState: GameState): void {
    // Render mode-provided board decorations (e.g., guided target cells)
    if (gameState.boardDecorations && gameState.boardDecorations.length > 0) {
      this.renderLegacyBoardDecorations(gameState);
    }

    // Render ghost piece first (so active piece draws on top)
    if (gameState.active && (gameState.gameplay.ghostPieceEnabled ?? true)) {
      const ghostPosition = calculateGhostPosition(
        gameState.board,
        gameState.active,
      );
      // Only render ghost piece if it's different from active piece position
      if (ghostPosition.y !== gameState.active.y) {
        this.renderLegacyGhostPiece(ghostPosition);
      }
    }
  }

  private renderLegacyBoardDecorations(gameState: GameState): void {
    if (!this.ctx || !gameState.boardDecorations) return;
    for (const deco of gameState.boardDecorations) {
      const color = deco.color ?? "#00A2FF";
      const alpha = typeof deco.alpha === "number" ? deco.alpha : 0.25;
      for (const c of deco.cells) {
        const x = gridCoordAsNumber(c.x);
        const y = gridCoordAsNumber(c.y);
        if (x < 0 || x >= this.boardWidth || y < 0 || y >= this.boardHeight) {
          continue;
        }
        this.drawHighlightCell(x, y, color, alpha);
      }
    }
  }

  private renderLegacyGhostPiece(piece: ActivePiece): void {
    if (!this.ctx) return;

    const shape = PIECES[piece.id];
    const cells = shape.cells[piece.rot];

    for (const [dx, dy] of cells) {
      const x = piece.x + dx;
      const y = piece.y + dy;

      // Only render ghost piece within visible board area
      if (x >= 0 && x < this.boardWidth && y >= 0 && y < this.boardHeight) {
        this.drawGhostCell(x, y);
      }
    }
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
    const borderColor = "#555555";

    // Create subtle gradient for depth
    const gradient = this.ctx.createLinearGradient(
      pixelX,
      pixelY,
      pixelX + this.cellSize,
      pixelY + this.cellSize,
    );
    gradient.addColorStop(0, lightenColor(color, 0.1));
    gradient.addColorStop(1, darkenColor(color, 0.9));

    this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    this.ctx.fillRect(pixelX, pixelY, this.cellSize, this.cellSize);

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

  private drawHighlightCell(
    x: number,
    y: number,
    color: string,
    alpha: number,
  ): void {
    if (!this.ctx) return;

    const pixelX = x * this.cellSize;
    const pixelY = y * this.cellSize;

    // Draw a bright, truly blurred glow that bleeds ~50% into neighbors
    this.ctx.save();
    const clampedAlpha = Math.max(0, Math.min(1, alpha));
    const extend = Math.floor(this.cellSize * 0.5); // bleed half-cell into neighbors
    const blurPx = Math.max(2, Math.floor(this.cellSize * 0.5));
    const glowAlpha = Math.min(1, Math.max(0.3, clampedAlpha)); // brighter glow

    this.ctx.globalCompositeOperation = "lighter"; // additive for luminous effect
    this.ctx.globalAlpha = glowAlpha;
    this.ctx.filter = `blur(${String(blurPx)}px)`;
    this.ctx.fillStyle = normalizeColorBrightness(color, 0.25); // Normalize brightness for consistent glow visibility

    // Larger rect than the cell to encourage outward bloom
    this.ctx.fillRect(
      pixelX - extend,
      pixelY - extend,
      this.cellSize + extend * 2,
      this.cellSize + extend * 2,
    );
    this.ctx.restore();

    // Crisp inner core to anchor the target
    this.ctx.save();
    this.ctx.globalAlpha = Math.min(1, Math.max(0.4, clampedAlpha * 1.6));
    // this.ctx.fillStyle = color;
    const coreMargin = Math.max(2, Math.floor(this.cellSize * 0.12));
    this.ctx.fillRect(
      pixelX + coreMargin,
      pixelY + coreMargin,
      this.cellSize - coreMargin * 2,
      this.cellSize - coreMargin * 2,
    );
    this.ctx.restore();
  }

  private drawGrid(): void {
    if (!this.ctx) return;

    this.ctx.strokeStyle = "#222222";
    this.ctx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x <= this.boardWidth; x++) {
      const pixelX = x * this.cellSize;
      this.ctx.beginPath();
      this.ctx.moveTo(pixelX, 0);
      this.ctx.lineTo(pixelX, this.canvas.height);
      this.ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y <= this.boardHeight; y++) {
      const pixelY = y * this.cellSize;
      this.ctx.beginPath();
      this.ctx.moveTo(0, pixelY);
      this.ctx.lineTo(this.canvas.width, pixelY);
      this.ctx.stroke();
    }
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
  }
}
