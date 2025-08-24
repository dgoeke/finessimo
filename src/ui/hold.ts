import { PieceId } from "../state/types";
import { PIECES } from "../core/pieces";

export interface HoldRenderer {
  initialize(container: HTMLElement): void;
  render(holdPiece: PieceId | undefined, canHold: boolean): void;
  destroy(): void;
}

export class BasicHoldRenderer implements HoldRenderer {
  private container: HTMLElement | undefined;
  private canvas: HTMLCanvasElement | undefined;
  private ctx: CanvasRenderingContext2D | undefined;
  private cellSize = 15; // Same as preview

  initialize(container: HTMLElement): void {
    this.container = container;
    this.createHoldElement();
  }

  render(holdPiece: PieceId | undefined, canHold: boolean): void {
    if (!this.canvas || !this.ctx) {
      console.error("Hold renderer not initialized");
      return;
    }

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Remove container visual state changes - no more grayed out appearance
    const holdSection = this.container?.querySelector(".hold-section");
    if (holdSection) {
      holdSection.classList.remove("disabled");
    }

    // Render hold piece if it exists
    if (holdPiece) {
      this.renderHoldPiece(holdPiece, canHold);
    }
  }

  private createHoldElement(): void {
    if (!this.container) return;

    const holdSection = document.createElement("div");
    holdSection.className = "hold-section";
    holdSection.innerHTML = `
      <h3 class="hold-title">Hold</h3>
      <div class="hold-container">
        <canvas class="hold-canvas" width="60" height="60"></canvas>
      </div>
    `;

    const canvas = holdSection.querySelector<HTMLCanvasElement>(".hold-canvas");
    if (!canvas) {
      throw new Error("Failed to create hold canvas");
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D rendering context for hold");
    }

    this.canvas = canvas;
    this.ctx = ctx;

    this.container.appendChild(holdSection);
  }

  private renderHoldPiece(pieceId: PieceId, canHold: boolean): void {
    if (!this.ctx || !this.canvas) return;

    const piece = PIECES[pieceId];
    if (!piece) return;

    // Always use spawn rotation for hold display
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

    // Draw diagonal slash when hold is disabled
    if (!canHold) {
      this.drawDisabledSlash();
    }
  }

  private drawHoldCell(
    x: number,
    y: number,
    color: string,
    alpha: number,
  ): void {
    if (!this.ctx) return;

    // Set alpha for the fill
    const fillColor = this.addAlphaToColor(color, alpha);
    const strokeColor = this.addAlphaToColor("#333333", alpha);

    // Fill cell
    this.ctx.fillStyle = fillColor;
    this.ctx.fillRect(x, y, this.cellSize, this.cellSize);

    // Draw border
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x + 0.5, y + 0.5, this.cellSize - 1, this.cellSize - 1);
  }

  private addAlphaToColor(color: string, alpha: number): string {
    // Convert hex color to rgba with alpha
    if (color.startsWith("#")) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color; // fallback for non-hex colors
  }

  private drawDisabledSlash(): void {
    if (!this.ctx || !this.canvas) return;

    // Draw diagonal line from top-right to bottom-left
    this.ctx.strokeStyle = "#888888"; // Gray color
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = "round";

    // Start from top-right corner, end at bottom-left corner
    this.ctx.beginPath();
    this.ctx.moveTo(this.canvas.width - 4, 4); // Top-right with small margin
    this.ctx.lineTo(4, this.canvas.height - 4); // Bottom-left with small margin
    this.ctx.stroke();
  }

  destroy(): void {
    if (this.container) {
      // Find and remove hold section
      const holdSection = this.container.querySelector(".hold-section");
      if (holdSection) {
        holdSection.remove();
      }
    }

    this.container = undefined;
    this.canvas = undefined;
    this.ctx = undefined;
  }
}
