import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html } from "lit";
import { customElement, queryAll } from "lit/decorators.js";

import { PIECES } from "../../core/pieces";
import { gameStateSignal, stateSelectors } from "../../state/signals";
import { lightenColor, darkenColor } from "../utils/colors";

import type { GameState, PieceId } from "../../state/types";

@customElement("piece-preview")
export class PiecePreview extends SignalWatcher(LitElement) {
  @queryAll(".preview-canvas") private canvases!: NodeListOf<HTMLCanvasElement>;
  private contexts: Array<CanvasRenderingContext2D | null> = [];
  private cellSize = 15; // Fixed cell size (4x4 grid => 60x60)
  private readonly previewCount = 5; // Maximum slots created
  private lastRenderState?: {
    nextQueue: GameState["nextQueue"];
    nextPieceCount: GameState["gameplay"]["nextPieceCount"];
  };

  // Use light DOM for consistent styling
  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  protected updated(): void {
    // Initialize canvas sizes and contexts once, after the first render
    if (this.contexts.length === 0) {
      const canvases = Array.from(this.canvases);
      if (canvases.length === 0) {
        // Nothing to do yet (should not happen since updated runs post-render)
        return;
      }

      // Fixed canvas sizes: 60x60 each with 15px cells
      for (const canvas of canvases) {
        canvas.width = 60;
        canvas.height = 60;
        canvas.style.width = "60px";
        canvas.style.height = "60px";
      }

      // Initialize canvas contexts
      this.contexts = canvases.map((canvas) => {
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          console.error(
            "Failed to get 2D rendering context for preview canvas",
          );
        }
        return ctx;
      });
    }

    // Get current state from the signal first to register reactive subscription
    const gameState = gameStateSignal.get();
    const previewState = stateSelectors.getPreviewState(gameState);

    if (this.contexts.every((ctx) => ctx === null)) {
      // Contexts not ready yet; we've registered the subscription, so a later
      // signal change will trigger rendering.
      return;
    }

    // Only re-render if the relevant state has actually changed
    if (this.hasStateChanged(previewState)) {
      this.renderPreviews(
        previewState.nextQueue,
        previewState.nextPieceCount ?? 5,
      );
      this.lastRenderState = previewState;
    }
  }

  private hasStateChanged(newState: {
    nextQueue: GameState["nextQueue"];
    nextPieceCount: GameState["gameplay"]["nextPieceCount"];
  }): boolean {
    if (!this.lastRenderState) {
      return true;
    }

    // Compare nextPieceCount
    if (this.lastRenderState.nextPieceCount !== newState.nextPieceCount) {
      return true;
    }

    // Compare nextQueue (check first few pieces that matter)
    const oldQueue = this.lastRenderState.nextQueue;
    const newQueue = newState.nextQueue;
    const checkCount = Math.min(
      this.previewCount,
      newState.nextPieceCount ?? 5,
    );

    for (let i = 0; i < checkCount; i++) {
      if (oldQueue[i] !== newQueue[i]) {
        return true;
      }
    }

    return false;
  }

  protected render(): unknown {
    // Create preview slots dynamically
    const slots = [];
    for (let i = 0; i < this.previewCount; i++) {
      slots.push(html`
        <div class="preview-slot">
          <canvas class="preview-canvas"></canvas>
        </div>
      `);
    }

    return html`
      <div class="preview-container">
        <h3 class="preview-title">Next</h3>
        ${slots}
      </div>
    `;
  }

  private renderPreviews(
    nextQueue: ReadonlyArray<PieceId>,
    displayCount: number,
  ): void {
    const actualDisplayCount = Math.max(
      0,
      Math.min(this.previewCount, Math.floor(displayCount)),
    );
    const count = Math.min(
      actualDisplayCount,
      nextQueue.length,
      this.previewCount,
    );

    // Render visible previews
    for (let i = 0; i < count; i++) {
      const pieceId = nextQueue[i];
      const ctx = this.contexts[i];
      const canvas = this.canvases[i];

      if (ctx && canvas && pieceId !== undefined) {
        this.renderPreviewPiece(ctx, canvas, pieceId);
      }
    }

    // Clear unused canvases
    for (let i = count; i < this.previewCount; i++) {
      const ctx = this.contexts[i];
      const canvas = this.canvases[i];
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }

  private renderPreviewPiece(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    pieceId: PieceId,
  ): void {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

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
    const offsetX = (canvas.width - pieceWidth) / 2 - minX * this.cellSize;
    const offsetY = (canvas.height - pieceHeight) / 2 - minY * this.cellSize;

    // Render each cell
    for (const [dx, dy] of cells) {
      const x = dx * this.cellSize + offsetX;
      const y = dy * this.cellSize + offsetY;
      this.drawPreviewCell(ctx, x, y, piece.color);
    }
  }

  private drawPreviewCell(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
  ): void {
    // Create subtle gradient for depth
    const gradient = ctx.createLinearGradient(
      x,
      y,
      x + this.cellSize,
      y + this.cellSize,
    );
    gradient.addColorStop(0, lightenColor(color, 0.3));
    gradient.addColorStop(1, darkenColor(color, 0.2));

    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, this.cellSize, this.cellSize);

    // Add subtle highlight on top edge
    ctx.fillStyle = lightenColor(color, 0.4);
    ctx.fillRect(x, y, this.cellSize, 1);

    // Add subtle shadow on bottom edge
    ctx.fillStyle = darkenColor(color, 0.3);
    ctx.fillRect(x, y + this.cellSize - 1, this.cellSize, 1);

    // Draw refined border
    ctx.strokeStyle = darkenColor(color, 0.4);
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, this.cellSize, this.cellSize);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.contexts = [];
  }
}
