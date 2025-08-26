import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html } from "lit";
import { customElement, query } from "lit/decorators.js";

import { PIECES } from "../../core/pieces";
import { gameStateSignal, stateSelectors } from "../../state/signals";
import { lightenColor, darkenColor } from "../utils/colors";

import type { GameState, PieceId } from "../../state/types";

@customElement("piece-hold")
export class PieceHold extends SignalWatcher(LitElement) {
  @query(".hold-canvas") private canvas!: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | undefined;
  private cellSize = 15; // Fixed cell size (4x4 grid => 60x60)
  private lastRenderState?: {
    hold: GameState["hold"];
    canHold: GameState["canHold"];
  };

  // Use light DOM for consistent styling
  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  protected firstUpdated(): void {
    // Initialize canvas context
    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      console.error("Failed to get 2D rendering context for hold canvas");
      return;
    }
    this.ctx = ctx;

    // Fixed canvas size: 60x60 with 15px cells
    this.canvas.width = 60;
    this.canvas.height = 60;
    this.canvas.style.width = "60px";
    this.canvas.style.height = "60px";

    // Lit will automatically call updated() after firstUpdated() completes
  }

  protected updated(): void {
    if (!this.ctx) {
      return;
    }

    // Get current state from the signal (reactive subscription)
    const gameState = gameStateSignal.get();
    const holdState = stateSelectors.getHoldState(gameState);

    // Only re-render if the relevant state has actually changed
    if (this.hasStateChanged(holdState)) {
      this.renderHold(holdState.hold, holdState.canHold);
      this.lastRenderState = holdState;
    }
  }

  private hasStateChanged(newState: {
    hold: GameState["hold"];
    canHold: GameState["canHold"];
  }): boolean {
    if (!this.lastRenderState) {
      return true;
    }

    // Compare hold piece
    if (this.lastRenderState.hold !== newState.hold) {
      return true;
    }

    // Compare canHold flag
    if (this.lastRenderState.canHold !== newState.canHold) {
      return true;
    }

    return false;
  }

  protected render(): unknown {
    return html`
      <div class="hold-section">
        <h3 class="hold-title">Hold</h3>
        <div class="hold-container">
          <canvas class="hold-canvas"></canvas>
        </div>
      </div>
    `;
  }

  private renderHold(holdPiece: PieceId | undefined, canHold: boolean): void {
    if (!this.ctx) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Render hold piece if it exists
    if (holdPiece !== undefined) {
      this.renderHoldPiece(holdPiece);
    }

    // Draw disabled slash when hold is not available
    if (!canHold) {
      this.drawDisabledSlash();
    }
  }

  private renderHoldPiece(pieceId: PieceId): void {
    if (!this.ctx) return;

    const piece = PIECES[pieceId];
    const cells = piece.cells.spawn;

    // Calculate piece bounds to center it
    const minX = Math.min(...cells.map(([x]) => x));
    const maxX = Math.max(...cells.map(([x]) => x));
    const minY = Math.min(...cells.map(([, y]) => y));
    const maxY = Math.max(...cells.map(([, y]) => y));

    const pieceWidth = (maxX - minX + 1) * this.cellSize;
    const pieceHeight = (maxY - minY + 1) * this.cellSize;

    // Center the piece in the canvas
    const offsetX = (this.canvas.width - pieceWidth) / 2 - minX * this.cellSize;
    const offsetY =
      (this.canvas.height - pieceHeight) / 2 - minY * this.cellSize;

    // Always render piece at full opacity
    const alpha = 1.0;

    // Render each cell
    for (const [dx, dy] of cells) {
      const x = dx * this.cellSize + offsetX;
      const y = dy * this.cellSize + offsetY;
      this.drawHoldCell(x, y, piece.color, alpha);
    }
  }

  private drawHoldCell(
    x: number,
    y: number,
    color: string,
    alpha: number,
  ): void {
    if (!this.ctx) return;

    this.ctx.globalAlpha = alpha;

    // Create subtle gradient for depth
    const gradient = this.ctx.createLinearGradient(
      x,
      y,
      x + this.cellSize,
      y + this.cellSize,
    );
    gradient.addColorStop(0, lightenColor(color, 0.3));
    gradient.addColorStop(1, darkenColor(color, 0.2));

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(x, y, this.cellSize, this.cellSize);

    // Add subtle highlight on top edge
    this.ctx.fillStyle = lightenColor(color, 0.4);
    this.ctx.fillRect(x, y, this.cellSize, 1);

    // Add subtle shadow on bottom edge
    this.ctx.fillStyle = darkenColor(color, 0.3);
    this.ctx.fillRect(x, y + this.cellSize - 1, this.cellSize, 1);

    // Draw refined border
    this.ctx.strokeStyle = darkenColor(color, 0.4);
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, y, this.cellSize, this.cellSize);

    this.ctx.globalAlpha = 1.0;
  }

  private drawDisabledSlash(): void {
    if (!this.ctx) return;

    this.ctx.strokeStyle = "#ff4444";
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = "round";

    // Draw diagonal slash from top-left to bottom-right
    this.ctx.beginPath();
    this.ctx.moveTo(5, 5);
    this.ctx.lineTo(this.canvas.width - 5, this.canvas.height - 5);
    this.ctx.stroke();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.ctx = undefined;
  }
}
