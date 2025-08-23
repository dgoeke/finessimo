import { GameState, Board, ActivePiece } from '../state/types';
import { PIECES } from '../core/pieces';

export interface CanvasRenderer {
  initialize(canvas: HTMLCanvasElement): void;
  render(gameState: GameState): void;
  destroy(): void;
}

export class BasicCanvasRenderer implements CanvasRenderer {
  private canvas: HTMLCanvasElement | undefined;
  private ctx: CanvasRenderingContext2D | undefined;
  private cellSize = 30;
  private boardWidth = 10;
  private boardHeight = 20;

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
      
      // Only render cells that are within the visible board area
      if (y >= 0 && y < this.boardHeight) {
        this.drawCell(x, y, shape.color);
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
    this.canvas = undefined;
    this.ctx = undefined;
    // Canvas renderer destroyed
  }
}
