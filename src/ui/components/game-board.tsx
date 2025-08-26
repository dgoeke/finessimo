import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html } from "lit";
import { customElement, query } from "lit/decorators.js";

import { calculateGhostPosition } from "../../core/board";
import { PIECES } from "../../core/pieces";
import { gameStateSignal, stateSelectors } from "../../state/signals";
import { lightenColor, darkenColor } from "../utils/colors";

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
    tick: GameState["tick"];
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

    // Only re-render if the relevant state has actually changed
    if (this.hasStateChanged(boardState)) {
      this.renderGameBoard(gameState);
      this.lastRenderState = boardState;
    }
  }

  private hasStateChanged(newState: {
    active: GameState["active"];
    board: GameState["board"];
    tick: GameState["tick"];
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

    // Compare tick for any other changes
    if (this.lastRenderState.tick !== newState.tick) {
      return true;
    }

    return false;
  }

  protected render(): unknown {
    return html`<canvas></canvas>`;
  }

  private renderGameBoard(gameState: GameState): void {
    if (!this.ctx) {
      console.error("Canvas not initialized");
      return;
    }

    // Clear canvas
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Render board
    this.renderBoard(gameState.board);

    // Render ghost piece first (so active piece draws on top)
    if (gameState.active && (gameState.gameplay.ghostPieceEnabled ?? true)) {
      const ghostPosition = calculateGhostPosition(
        gameState.board,
        gameState.active,
      );
      // Only render ghost piece if it's different from active piece position
      if (ghostPosition.y !== gameState.active.y) {
        this.renderGhostPiece(ghostPosition);
      }
    }

    // Render active piece
    if (gameState.active) {
      this.renderActivePiece(gameState.active);
    }

    // Draw grid
    this.drawGrid();
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

  private renderGhostPiece(piece: ActivePiece): void {
    if (!this.ctx) return;

    const shape = PIECES[piece.id];
    const cells = shape.cells[piece.rot];

    for (const [dx, dy] of cells) {
      const x = piece.x + dx;
      const y = piece.y + dy;

      // Only render ghost piece within visible board area
      if (x >= 0 && x < this.boardWidth && y >= 0 && y < this.boardHeight) {
        this.drawGhostCell(x, y, shape.color);
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
    this.ctx.strokeStyle = darkenColor(color, 0.4);
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(pixelX, pixelY, this.cellSize, this.cellSize);
  }

  private drawGhostCell(x: number, y: number, color: string): void {
    if (!this.ctx) return;

    const pixelX = x * this.cellSize;
    const pixelY = y * this.cellSize;

    // Draw ghost piece with transparent fill and dashed border
    this.ctx.fillStyle = `${color}40`; // Add 40 for ~25% opacity
    this.ctx.fillRect(pixelX, pixelY, this.cellSize, this.cellSize);

    // Draw dashed border for ghost piece
    this.ctx.strokeStyle = `${color}AA`; // Add AA for ~67% opacity
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([4, 4]); // Dashed line pattern
    this.ctx.strokeRect(pixelX, pixelY, this.cellSize, this.cellSize);
    this.ctx.setLineDash([]); // Reset line dash
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
