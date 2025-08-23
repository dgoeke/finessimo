import { GameState, Board, ActivePiece } from '../state/types';
import { PIECES } from '../core/pieces';
import { calculateGhostPosition } from '../core/board';
import { BasicFinesseRenderer, createFinesseVisualization } from './finesse';

export interface CanvasRenderer {
  initialize(canvas: HTMLCanvasElement): void;
  render(gameState: GameState): void;
  destroy(): void;
}

export class BasicCanvasRenderer implements CanvasRenderer {
  private canvas: HTMLCanvasElement | undefined;
  private ctx: CanvasRenderingContext2D | undefined;
  private finesseRenderer: BasicFinesseRenderer;
  private cellSize = 30;
  private boardWidth = 10;
  private boardHeight = 20;

  constructor() {
    this.finesseRenderer = new BasicFinesseRenderer();
  }

  initialize(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get 2D rendering context');
    }
    
    this.ctx = ctx;
    
    // Set canvas size
    canvas.width = this.boardWidth * this.cellSize;
    canvas.height = this.boardHeight * this.cellSize;
    
    // Initialize finesse renderer with same canvas
    this.finesseRenderer.initialize(canvas);
    
    // Canvas renderer initialized
  }

  render(gameState: GameState): void {
    if (!this.ctx || !this.canvas) {
      console.error('Canvas not initialized');
      return;
    }

    // Clear canvas
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Render board
    this.renderBoard(gameState.board);
    
    // Render ghost piece first (so active piece draws on top)
    if (gameState.active && (gameState.gameplay.ghostPieceEnabled ?? true)) {
      const ghostPosition = calculateGhostPosition(gameState.board, gameState.active);
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
    
    // Render finesse visualization overlay
    const finesseViz = createFinesseVisualization(gameState);
    this.finesseRenderer.render(gameState, finesseViz);
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
    
    this.ctx.fillStyle = color;
    this.ctx.fillRect(pixelX, pixelY, this.cellSize, this.cellSize);
    
    // Draw border
    this.ctx.strokeStyle = '#333333';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(pixelX, pixelY, this.cellSize, this.cellSize);
  }

  private drawGhostCell(x: number, y: number, color: string): void {
    if (!this.ctx) return;
    
    const pixelX = x * this.cellSize;
    const pixelY = y * this.cellSize;
    
    // Draw ghost piece with transparent fill and dashed border
    this.ctx.fillStyle = color + '40'; // Add 40 for ~25% opacity
    this.ctx.fillRect(pixelX, pixelY, this.cellSize, this.cellSize);
    
    // Draw dashed border for ghost piece
    this.ctx.strokeStyle = color + 'AA'; // Add AA for ~67% opacity
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([4, 4]); // Dashed line pattern
    this.ctx.strokeRect(pixelX, pixelY, this.cellSize, this.cellSize);
    this.ctx.setLineDash([]); // Reset line dash
  }

  private drawGrid(): void {
    if (!this.ctx) return;
    
    this.ctx.strokeStyle = '#222222';
    this.ctx.lineWidth = 1;
    
    // Vertical lines
    for (let x = 0; x <= this.boardWidth; x++) {
      const pixelX = x * this.cellSize;
      this.ctx.beginPath();
      this.ctx.moveTo(pixelX, 0);
      this.ctx.lineTo(pixelX, this.canvas!.height);
      this.ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = 0; y <= this.boardHeight; y++) {
      const pixelY = y * this.cellSize;
      this.ctx.beginPath();
      this.ctx.moveTo(0, pixelY);
      this.ctx.lineTo(this.canvas!.width, pixelY);
      this.ctx.stroke();
    }
  }

  private getCellColor(cellValue: number): string {
    const colors = [
      '#000000', // 0 - empty (shouldn't be used)
      '#00f0f0', // 1 - I
      '#f0f000', // 2 - O
      '#a000f0', // 3 - T
      '#00f000', // 4 - S
      '#f00000', // 5 - Z
      '#0000f0', // 6 - J
      '#f0a000', // 7 - L
    ];
    return colors[cellValue] || '#ffffff';
  }

  destroy(): void {
    this.finesseRenderer.destroy();
    this.canvas = undefined;
    this.ctx = undefined;
    // Canvas renderer destroyed
  }
}
