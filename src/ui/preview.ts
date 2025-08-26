import { PIECES } from "../core/pieces";
import { type PieceId } from "../state/types";

export type PreviewRenderer = {
  initialize(container: HTMLElement): void;
  // Render next pieces; displayCount limits the number of preview slots shown
  render(nextQueue: Array<PieceId>, displayCount?: number): void;
  destroy(): void;
};

export class BasicPreviewRenderer implements PreviewRenderer {
  private container: HTMLElement | undefined;
  private canvases: Array<HTMLCanvasElement> = [];
  private contexts: Array<CanvasRenderingContext2D> = [];
  private cellSize = 15; // Smaller than main board
  private previewCount = 5; // Maximum slots created
  private desiredCount = 5; // Current desired display count

  initialize(container: HTMLElement): void {
    this.container = container;
    this.createPreviewElements();
  }

  render(nextQueue: Array<PieceId>, displayCount?: number): void {
    if (!this.container || this.canvases.length === 0) {
      console.error("Preview renderer not initialized");
      return;
    }

    this.updateDesiredCount(displayCount);
    this.renderPreviewPieces(nextQueue);
    this.clearUnusedCanvases(nextQueue);
  }

  private updateDesiredCount(displayCount?: number): void {
    if (typeof displayCount === "number") {
      this.desiredCount = Math.max(
        1,
        Math.min(this.previewCount, Math.floor(displayCount)),
      );
    }
  }

  private renderPreviewPieces(nextQueue: Array<PieceId>): void {
    const count = Math.min(
      this.desiredCount,
      nextQueue.length,
      this.previewCount,
    );

    for (let i = 0; i < count; i++) {
      const pieceId = nextQueue[i];
      const canvas = this.canvases[i];
      const ctx = this.contexts[i];

      if (canvas !== undefined && ctx !== undefined && pieceId !== undefined) {
        this.renderPreviewPiece(ctx, canvas, pieceId);
      }
    }
  }

  private clearUnusedCanvases(nextQueue: Array<PieceId>): void {
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

    // Create elements directly in the container instead of wrapping in preview-section
    this.container.innerHTML = `
      <div class="preview-container">
        <h3 class="preview-title">Next</h3>
      </div>
    `;

    const previewContainer = this.container.querySelector(".preview-container");
    if (!previewContainer) {
      return;
    }

    // Create individual preview slots
    for (let i = 0; i < this.previewCount; i++) {
      const previewSlot = document.createElement("div");
      previewSlot.className = "preview-slot";

      const canvas = document.createElement("canvas");
      canvas.className = "preview-canvas";
      canvas.width = 4 * this.cellSize; // Max piece width is 4 cells
      canvas.height = 4 * this.cellSize; // Max piece height is 4 cells

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Failed to get 2D rendering context for preview");
      }

      previewSlot.appendChild(canvas);
      previewContainer.appendChild(previewSlot);

      this.canvases.push(canvas);
      this.contexts.push(ctx);
    }
  }

  private renderPreviewPiece(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    pieceId: PieceId,
  ): void {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const piece = PIECES[pieceId];
    const cells = piece.cells.spawn;
    const { offsetX, offsetY } = this.calculateCenterOffset(canvas, cells);

    this.renderPieceCells(ctx, cells, offsetX, offsetY, piece.color);
  }

  private calculateCenterOffset(
    canvas: HTMLCanvasElement,
    cells: ReadonlyArray<readonly [number, number]>,
  ): { offsetX: number; offsetY: number } {
    const minX = Math.min(...cells.map(([x]) => x));
    const maxX = Math.max(...cells.map(([x]) => x));
    const minY = Math.min(...cells.map(([, y]) => y));
    const maxY = Math.max(...cells.map(([, y]) => y));

    const pieceWidth = (maxX - minX + 1) * this.cellSize;
    const pieceHeight = (maxY - minY + 1) * this.cellSize;

    const offsetX = (canvas.width - pieceWidth) / 2 - minX * this.cellSize;
    const offsetY = (canvas.height - pieceHeight) / 2 - minY * this.cellSize;

    return { offsetX, offsetY };
  }

  private renderPieceCells(
    ctx: CanvasRenderingContext2D,
    cells: ReadonlyArray<readonly [number, number]>,
    offsetX: number,
    offsetY: number,
    color: string,
  ): void {
    const alpha = 0.8;

    for (const [dx, dy] of cells) {
      const x = dx * this.cellSize + offsetX;
      const y = dy * this.cellSize + offsetY;
      this.drawPreviewCell(ctx, x, y, color, alpha);
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
      return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(alpha)})`;
    }
    return color; // fallback for non-hex colors
  }

  destroy(): void {
    if (this.container) {
      // Clear the container contents directly
      this.container.innerHTML = "";
    }

    this.container = undefined;
    this.canvases = [];
    this.contexts = [];
  }
}
