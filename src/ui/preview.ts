import { PieceId } from "../state/types";
import { PIECES } from "../core/pieces";

export interface PreviewRenderer {
  initialize(container: HTMLElement): void;
  // Render next pieces; displayCount limits the number of preview slots shown
  render(nextQueue: PieceId[], displayCount?: number): void;
  destroy(): void;
}

export class BasicPreviewRenderer implements PreviewRenderer {
  private container: HTMLElement | undefined;
  private canvases: HTMLCanvasElement[] = [];
  private contexts: CanvasRenderingContext2D[] = [];
  private cellSize = 15; // Smaller than main board
  private previewCount = 5; // Maximum slots created
  private desiredCount = 5; // Current desired display count

  initialize(container: HTMLElement): void {
    this.container = container;
    this.createPreviewElements();
  }

  render(nextQueue: PieceId[], displayCount?: number): void {
    if (!this.container || this.canvases.length === 0) {
      console.error("Preview renderer not initialized");
      return;
    }

    // Update desired count if provided
    if (typeof displayCount === "number") {
      this.desiredCount = Math.max(
        1,
        Math.min(this.previewCount, Math.floor(displayCount)),
      );
    }

    // Render each preview piece
    const count = Math.min(
      this.desiredCount,
      nextQueue.length,
      this.previewCount,
    );
    for (let i = 0; i < count; i++) {
      const pieceId = nextQueue[i];
      const canvas = this.canvases[i];
      const ctx = this.contexts[i];

      if (canvas && ctx && pieceId) {
        this.renderPreviewPiece(ctx, canvas, pieceId, i === 0);
      }
    }

    // Clear unused canvases
    for (let i = 0; i < this.previewCount; i++) {
      const canvas = this.canvases[i];
      const ctx = this.contexts[i];
      if (canvas && ctx) {
        if (i >= this.desiredCount || i >= nextQueue.length) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    }
  }

  private createPreviewElements(): void {
    if (!this.container) return;

    const previewSection = document.createElement("div");
    previewSection.className = "preview-section";
    previewSection.innerHTML = `
      <h3 class="preview-title">Next</h3>
      <div class="preview-container"></div>
    `;

    const previewContainer = previewSection.querySelector(".preview-container");
    if (!previewContainer) {
      this.container.appendChild(previewSection);
      return;
    }

    // Create individual preview slots
    for (let i = 0; i < this.previewCount; i++) {
      const previewSlot = document.createElement("div");
      previewSlot.className = `preview-slot ${i === 0 ? "main" : "secondary"}`;

      const label = document.createElement("div");
      label.className = "preview-label";
      label.textContent = i === 0 ? "Next" : `${i + 1}`;

      const canvas = document.createElement("canvas");
      canvas.className = "preview-canvas";
      canvas.width = 4 * this.cellSize; // Max piece width is 4 cells
      canvas.height = 4 * this.cellSize; // Max piece height is 4 cells

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Failed to get 2D rendering context for preview");
      }

      previewSlot.appendChild(label);
      previewSlot.appendChild(canvas);
      previewContainer.appendChild(previewSlot);

      this.canvases.push(canvas);
      this.contexts.push(ctx);
    }

    this.container.appendChild(previewSection);
  }

  private renderPreviewPiece(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    pieceId: PieceId,
    isNext: boolean,
  ): void {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const piece = PIECES[pieceId];
    if (!piece) return;

    // Always use spawn rotation for preview
    const cells = piece.cells.spawn;

    // Calculate piece bounds to center it
    const minX = Math.min(...cells.map(([x]) => x));
    const maxX = Math.max(...cells.map(([x]) => x));
    const minY = Math.min(...cells.map(([, y]) => y));
    const maxY = Math.max(...cells.map(([, y]) => y));

    const pieceWidth = (maxX - minX + 1) * this.cellSize;
    const pieceHeight = (maxY - minY + 1) * this.cellSize;

    // Center the piece in the canvas
    const offsetX = (canvas.width - pieceWidth) / 2 - minX * this.cellSize;
    const offsetY = (canvas.height - pieceHeight) / 2 - minY * this.cellSize;

    // Set opacity based on position (next piece is fully opaque)
    const alpha = isNext ? 1.0 : 0.7;

    // Render each cell
    for (const [dx, dy] of cells) {
      const x = dx * this.cellSize + offsetX;
      const y = dy * this.cellSize + offsetY;

      this.drawPreviewCell(ctx, x, y, piece.color, alpha);
    }
  }

  private drawPreviewCell(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    alpha: number,
  ): void {
    // Set alpha for the fill
    const fillColor = this.addAlphaToColor(color, alpha);
    const strokeColor = this.addAlphaToColor("#333333", alpha);

    // Fill cell
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, this.cellSize, this.cellSize);

    // Draw border
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, this.cellSize - 1, this.cellSize - 1);
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

  destroy(): void {
    if (this.container) {
      // Find and remove preview section
      const previewSection = this.container.querySelector(".preview-section");
      if (previewSection) {
        previewSection.remove();
      }
    }

    this.container = undefined;
    this.canvases = [];
    this.contexts = [];
  }
}
