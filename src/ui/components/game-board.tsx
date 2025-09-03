import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html } from "lit";
import { customElement, query } from "lit/decorators.js";

import { selectBoardRenderModel } from "../../engine/selectors/board-render";
import { gameStateSignal, stateSelectors } from "../../state/signals";
import {
  BOARD_WIDTH,
  TOTAL_HEIGHT,
  VISIBLE_HEIGHT,
  VANISH_ROWS,
} from "../../state/types";
import { renderBoardCells, renderActivePieceCells } from "../renderers/cells";
import { createGridCache } from "../renderers/grid-cache";
import { createOutlineCache } from "../renderers/outline-cache";
import { renderOverlays } from "../renderers/overlays";
import {
  advanceTween,
  verticalOffsetPx,
  isTweenActive,
} from "../renderers/tween";
import {
  drawPlayAreaBackground,
  drawPlayAreaBorder,
} from "../renderers/viewport";
import {
  asCellSizePx,
  asBoardCols,
  asVisibleRows,
  asVanishRows,
} from "../types/brands-render";

import type { RenderOverlay } from "../../engine/ui/overlays";
import type { GameState } from "../../state/types";
import type { GridCache } from "../renderers/grid-cache";
import type { OutlineCache } from "../renderers/outline-cache";
import type { TweenState } from "../renderers/tween";
import type { BoardRenderFrame } from "../types/board-render-frame";
import type { BoardViewport } from "../types/brands-render";

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
  private readonly boardWidth = BOARD_WIDTH; // 10
  private readonly visibleHeight = VISIBLE_HEIGHT; // rows 0..19
  private readonly vanishRows = VANISH_ROWS - 1; // we intentionally don't render the top vanish row
  private readonly totalHeight = TOTAL_HEIGHT; // 23

  // Phase 1: Branded viewport configuration
  private readonly viewport: BoardViewport = {
    cell: asCellSizePx(this.cellSize),
    cols: asBoardCols(this.boardWidth),
    vanishRows: asVanishRows(this.vanishRows),
    visibleRows: asVisibleRows(this.visibleHeight),
  } as const;
  private readonly outlineCache: OutlineCache = createOutlineCache();
  private gridCache?: GridCache;
  // Pure tween state for vertical piece animations
  private tweenState: TweenState = {};
  private lastRenderState?: {
    active: GameState["active"];
    board: GameState["board"];
    overlays: ReadonlyArray<RenderOverlay>;
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
    this.canvas.height = this.totalHeight * this.cellSize;

    // Initialize grid cache with viewport configuration
    this.gridCache = createGridCache(this.viewport);

    // Lit will automatically call updated() after firstUpdated() completes
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();

    // Clean up resources
    this.ctx = undefined;
    this.gridCache?.dispose();
  }

  protected updated(): void {
    if (!this.ctx) {
      return;
    }

    // Get current state from the signal (reactive subscription)
    const gameState = gameStateSignal.get();

    // Only recompute selectors if state has actually changed to avoid unnecessary work
    let boardState: ReturnType<typeof stateSelectors.getBoardState>;
    let renderModel: ReturnType<typeof selectBoardRenderModel>;
    let currentRenderState: {
      active: GameState["active"];
      board: GameState["board"];
      overlays: ReadonlyArray<RenderOverlay>;
      tick: GameState["tick"];
    };

    if (!this.lastRenderState) {
      // First render - always compute state
      boardState = stateSelectors.getBoardState(gameState);
      renderModel = selectBoardRenderModel(gameState);
      currentRenderState = {
        active: boardState.active,
        board: boardState.board,
        overlays: renderModel.overlays,
        tick: boardState.tick,
      };
    } else {
      // For subsequent renders, first do a quick check if tick changed
      const quickState = {
        active: gameState.active,
        board: gameState.board,
        // Use empty array as placeholder for overlays comparison
        overlays: [] as ReadonlyArray<RenderOverlay>,
        tick: gameState.tick,
      };

      if (this.hasStateChanged(quickState)) {
        // State changed - recompute selectors
        boardState = stateSelectors.getBoardState(gameState);
        renderModel = selectBoardRenderModel(gameState);
        currentRenderState = {
          active: boardState.active,
          board: boardState.board,
          overlays: renderModel.overlays,
          tick: boardState.tick,
        };
      } else {
        // State hasn't changed - reuse previous computed values for rendering
        boardState = {
          active: this.lastRenderState.active,
          board: this.lastRenderState.board,
          tick: this.lastRenderState.tick,
        } as ReturnType<typeof stateSelectors.getBoardState>;
        renderModel = { overlays: this.lastRenderState.overlays } as ReturnType<
          typeof selectBoardRenderModel
        >;
        currentRenderState = this.lastRenderState;
      }
    }

    // Phase 1: Build typed render frame
    const renderFrame: BoardRenderFrame = {
      active: boardState.active,
      board: boardState.board,
      overlays: renderModel.overlays,
      tick: boardState.tick,
      viewport: this.viewport,
    } as const;

    // Update tween state using pure functions
    if (this.lastRenderState) {
      // Convert undefined to null at the UI boundary for cleaner tween API
      const prevActive = this.lastRenderState.active ?? null;
      const nextActive = currentRenderState.active ?? null;

      this.tweenState = advanceTween(
        prevActive,
        nextActive,
        currentRenderState.tick,
        this.tweenState,
      );
    }

    // Always render the canvas to support animations and ensure visual consistency
    this.renderGameBoard(renderFrame);

    // Update lastRenderState only if state actually changed
    if (this.hasStateChanged(currentRenderState)) {
      this.lastRenderState = currentRenderState;
    }
  }

  private hasStateChanged(newState: {
    active: GameState["active"];
    board: GameState["board"];
    overlays: ReadonlyArray<RenderOverlay>;
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
    // Read signal to establish reactive subscription; expose tick as data attribute
    const { tick } = gameStateSignal.get();
    return html`<canvas data-tick=${tick}></canvas>`;
  }

  private renderGameBoard(renderFrame: BoardRenderFrame): void {
    if (!this.ctx) {
      console.error("Canvas not initialized");
      return;
    }

    // Clear canvas to transparent
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw black background only for visible play area (below vanish zone)
    drawPlayAreaBackground(this.ctx, this.viewport);

    // Render overlays first (those with z < 1, like column highlight)
    const backgroundOverlays = renderFrame.overlays.filter((o) => o.z < 1);
    renderOverlays(
      this.ctx,
      backgroundOverlays,
      renderFrame.viewport,
      this.outlineCache,
    );

    // Render board
    renderBoardCells(this.ctx, renderFrame.board, renderFrame.viewport);

    // Draw cached grid (inline for simplicity)
    if (this.gridCache) {
      this.gridCache.drawGrid(this.ctx);
    }

    // Draw border around visible play area
    drawPlayAreaBorder(this.ctx, renderFrame.viewport);

    // Render overlays above grid (those with z >= 1)
    const foregroundOverlays = renderFrame.overlays.filter((o) => o.z >= 1);
    renderOverlays(
      this.ctx,
      foregroundOverlays,
      renderFrame.viewport,
      this.outlineCache,
    );

    // Render active piece (active piece is not an overlay, always renders on top)
    if (renderFrame.active) {
      const yOffsetPx = verticalOffsetPx(
        this.tweenState,
        renderFrame.tick,
        renderFrame.viewport,
      );
      const isTweeningVertically = isTweenActive(
        this.tweenState,
        renderFrame.tick,
      );
      renderActivePieceCells(
        this.ctx,
        renderFrame.active,
        renderFrame.viewport,
        yOffsetPx,
        isTweeningVertically,
      );
    }
  }
}
