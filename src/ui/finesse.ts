// mode registry no longer needed here; use state.guidance
import {
  calculateGhostPosition,
  createEmptyBoard,
  tryMove,
  moveToWall,
} from "../core/board";
import { PIECES } from "../core/pieces";
import { tryRotate, getNextRotation } from "../core/srs";
import { finesseCalculator } from "../finesse/calculator";
import {
  type GameState,
  type ActivePiece,
  type PieceId,
  type Rot,
  type Board,
  type ModeGuidance,
  type FinesseAction,
} from "../state/types";

export type FinesseVisualization = {
  targetPosition?: ActivePiece;
  optimalSequence?: Array<string>;
  currentStep?: number;
  pathTrace?: Array<{ piece: ActivePiece; stepNumber: number; action: string }>;
  isOptimal?: boolean;
  faultCount?: number;
};

export type FinesseRenderer = {
  initialize(canvas: HTMLCanvasElement): void;
  render(gameState: GameState, visualization: FinesseVisualization): void;
  destroy(): void;
};

export class BasicFinesseRenderer implements FinesseRenderer {
  private canvas: HTMLCanvasElement | undefined;
  private ctx: CanvasRenderingContext2D | undefined;
  private cellSize = 30; // Should match main canvas renderer

  initialize(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Failed to get 2D rendering context for finesse");
    }

    this.ctx = ctx;
  }

  render(gameState: GameState, visualization: FinesseVisualization): void {
    if (!this.ctx || !this.canvas) {
      console.error("Finesse renderer not initialized");
      return;
    }

    // Only render when guidance is available
    const guidance = gameState.guidance ?? null;
    if (!guidance) {
      return;
    }

    this.renderVisualizationElements(guidance, visualization);
  }

  private renderVisualizationElements(
    guidance: ModeGuidance,
    visualization: FinesseVisualization,
  ): void {
    // Render target position if available
    if (
      this.shouldRenderTarget(visualization, guidance) &&
      visualization.targetPosition
    ) {
      this.renderTargetPosition(visualization.targetPosition);
    }

    // Render optimal path trace if available
    if (visualization.pathTrace) {
      this.renderPathTrace(visualization.pathTrace);
    }

    // Show optimal sequence text overlay
    if (
      this.shouldRenderSequence(visualization, guidance) &&
      visualization.optimalSequence
    ) {
      this.renderSequenceOverlay(
        visualization.optimalSequence,
        visualization.currentStep ?? 0,
      );
    }
  }

  private shouldRenderTarget(
    visualization: FinesseVisualization,
    guidance: ModeGuidance,
  ): boolean {
    return (
      visualization.targetPosition !== undefined &&
      guidance.visual?.highlightTarget !== false
    );
  }

  private shouldRenderSequence(
    visualization: FinesseVisualization,
    guidance: ModeGuidance,
  ): boolean {
    return (
      visualization.optimalSequence !== undefined &&
      (guidance.visual?.showPath ?? false)
    );
  }

  private renderTargetPosition(target: ActivePiece): void {
    if (!this.ctx) return;

    const piece = PIECES[target.id];

    const cells = piece.cells[target.rot];

    // Use a distinctive color for target position
    const targetColor = "rgba(255, 215, 0, 0.6)"; // Gold with transparency
    const borderColor = "rgba(255, 215, 0, 0.9)";

    for (const [dx, dy] of cells) {
      const x = target.x + dx;
      const y = target.y + dy;

      // Only render within visible board area
      if (x >= 0 && x < 10 && y >= 0 && y < 20) {
        this.drawTargetCell(x, y, targetColor, borderColor);
      }
    }
  }

  private renderPathTrace(
    pathTrace: Array<{
      piece: ActivePiece;
      stepNumber: number;
      action: string;
    }>,
  ): void {
    if (!this.ctx) return;

    // Draw each step in the optimal path
    for (const step of pathTrace) {
      this.renderPathStep(step.piece, step.stepNumber, step.action);
    }
  }

  private renderSequenceOverlay(
    sequence: Array<string>,
    currentStep: number,
  ): void {
    if (!this.ctx || !this.canvas) return;

    // Draw sequence text at bottom of canvas
    const padding = 10;
    const y = this.canvas.height - padding;

    this.ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    this.ctx.fillRect(0, this.canvas.height - 40, this.canvas.width, 40);

    this.ctx.fillStyle = "#ffffff";
    this.ctx.font = "14px monospace";
    this.ctx.textAlign = "left";

    const x = padding;
    const text = `Optimal: ${sequence.join(" → ")}`;
    this.ctx.fillText(text, x, y - 15);

    // Show progress
    const progress = `Step ${String(currentStep + 1)}/${String(sequence.length)}`;
    this.ctx.font = "12px monospace";
    this.ctx.fillStyle = "#aaa";
    this.ctx.fillText(progress, x, y - 2);

    // Reset alignment
    this.ctx.textAlign = "left";
  }

  private renderPathStep(
    piece: ActivePiece,
    stepNumber: number,
    action: string,
  ): void {
    if (!this.ctx) return;

    // Get piece shape
    const pieceData = PIECES[piece.id];

    const cells = pieceData.cells[piece.rot];

    // Draw ghost-like piece with step number
    for (const [dx, dy] of cells) {
      const x = piece.x + dx;
      const y = piece.y + dy;

      if (x >= 0 && x < 10 && y >= 0 && y < 20) {
        this.drawPathStepCell(x, y, pieceData.color, stepNumber, action);
      }
    }
  }

  private drawTargetCell(
    x: number,
    y: number,
    fillColor: string,
    borderColor: string,
  ): void {
    if (!this.ctx) return;

    const pixelX = x * this.cellSize;
    const pixelY = y * this.cellSize;

    // Draw target cell with special styling
    this.ctx.fillStyle = fillColor;
    this.ctx.fillRect(pixelX, pixelY, this.cellSize, this.cellSize);

    // Draw pulsing border effect
    this.ctx.strokeStyle = borderColor;
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([5, 5]); // Dashed line
    this.ctx.strokeRect(
      pixelX + 1.5,
      pixelY + 1.5,
      this.cellSize - 3,
      this.cellSize - 3,
    );
    this.ctx.setLineDash([]); // Reset line dash

    // Add small crosshair in center
    const centerX = pixelX + this.cellSize / 2;
    const centerY = pixelY + this.cellSize / 2;
    const crossSize = 6;

    this.ctx.strokeStyle = borderColor;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(centerX - crossSize, centerY);
    this.ctx.lineTo(centerX + crossSize, centerY);
    this.ctx.moveTo(centerX, centerY - crossSize);
    this.ctx.lineTo(centerX, centerY + crossSize);
    this.ctx.stroke();
  }

  private drawPathStepCell(
    x: number,
    y: number,
    color: string,
    stepNumber: number,
    action: string,
  ): void {
    if (!this.ctx) return;

    const pixelX = x * this.cellSize;
    const pixelY = y * this.cellSize;
    const centerX = pixelX + this.cellSize / 2;
    const centerY = pixelY + this.cellSize / 2;

    // Draw semi-transparent piece position
    this.ctx.fillStyle = `${color}40`; // Add alpha for transparency
    this.ctx.fillRect(pixelX, pixelY, this.cellSize, this.cellSize);

    // Draw border
    this.ctx.strokeStyle = `${color}AA`;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([3, 3]);
    this.ctx.strokeRect(
      pixelX + 1,
      pixelY + 1,
      this.cellSize - 2,
      this.cellSize - 2,
    );
    this.ctx.setLineDash([]);

    // Draw step number in center
    this.ctx.fillStyle = "#ffffff";
    this.ctx.font = "bold 10px monospace";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(stepNumber.toString(), centerX, centerY);

    // Draw action indicator
    this.drawActionIndicator(centerX, centerY - 12, action);

    // Reset text settings
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "alphabetic";
  }

  private drawActionIndicator(
    centerX: number,
    centerY: number,
    action: string,
  ): void {
    if (!this.ctx) return;

    this.ctx.strokeStyle = "#ffffff";
    this.ctx.fillStyle = "#ffffff";
    this.ctx.lineWidth = 1;

    const size = 6;

    switch (action.toLowerCase()) {
      case "leftdown":
      case "left":
        // Left arrow
        this.drawArrow(centerX - 2, centerY, size, "left");
        break;
      case "rightdown":
      case "right":
        // Right arrow
        this.drawArrow(centerX + 2, centerY, size, "right");
        break;
      case "rotatecw":
        // Clockwise rotation
        this.drawRotationIndicator(centerX, centerY, size, "cw");
        break;
      case "rotateccw":
        // Counter-clockwise rotation
        this.drawRotationIndicator(centerX, centerY, size, "ccw");
        break;
      case "harddrop":
        // Down arrow
        this.drawArrow(centerX, centerY + 2, size, "down");
        break;
    }
  }

  private drawArrow(
    centerX: number,
    centerY: number,
    size: number,
    direction: "left" | "right" | "down" = "right",
  ): void {
    if (!this.ctx) return;

    this.ctx.beginPath();

    switch (direction) {
      case "left":
        this.ctx.moveTo(centerX + size, centerY);
        this.ctx.lineTo(centerX - size, centerY);
        this.ctx.moveTo(centerX - size + 3, centerY - 3);
        this.ctx.lineTo(centerX - size, centerY);
        this.ctx.lineTo(centerX - size + 3, centerY + 3);
        break;
      case "right":
        this.ctx.moveTo(centerX - size, centerY);
        this.ctx.lineTo(centerX + size, centerY);
        this.ctx.moveTo(centerX + size - 3, centerY - 3);
        this.ctx.lineTo(centerX + size, centerY);
        this.ctx.lineTo(centerX + size - 3, centerY + 3);
        break;
      case "down":
        this.ctx.moveTo(centerX, centerY - size);
        this.ctx.lineTo(centerX, centerY + size);
        this.ctx.moveTo(centerX - 3, centerY + size - 3);
        this.ctx.lineTo(centerX, centerY + size);
        this.ctx.lineTo(centerX + 3, centerY + size - 3);
        break;
    }

    this.ctx.stroke();
  }

  private drawRotationIndicator(
    centerX: number,
    centerY: number,
    radius: number,
    direction: "cw" | "ccw" = "cw",
  ): void {
    if (!this.ctx) return;

    this.ctx.beginPath();
    if (direction === "cw") {
      this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 1.5);
      // Add arrowhead
      this.ctx.moveTo(centerX - 3, centerY - radius - 2);
      this.ctx.lineTo(centerX, centerY - radius);
      this.ctx.lineTo(centerX + 3, centerY - radius - 2);
    } else {
      this.ctx.arc(centerX, centerY, radius, 0, -Math.PI * 1.5, true);
      // Add arrowhead
      this.ctx.moveTo(centerX + 3, centerY - radius - 2);
      this.ctx.lineTo(centerX, centerY - radius);
      this.ctx.lineTo(centerX - 3, centerY - radius - 2);
    }
    this.ctx.stroke();
  }

  destroy(): void {
    this.canvas = undefined;
    this.ctx = undefined;
  }
}

// Helper function to create finesse visualization from game state
export function createFinesseVisualization(
  gameState: GameState,
): FinesseVisualization {
  const visualization: FinesseVisualization = {};

  // Extract information from finesse feedback
  if (gameState.finesseFeedback) {
    visualization.isOptimal = gameState.finesseFeedback.isOptimal;
    // For now, we don't have fault count in the new structure
    // This could be enhanced later to show sequence information
  }

  // In guided mode, show target position and optimal path
  {
    const guidance = gameState.guidance ?? null;
    if (gameState.active && guidance?.target) {
      const targetInfo = {
        targetRot: guidance.target.rot,
        targetX: guidance.target.x,
      } as const;
      // Calculate target Y position against current board
      const targetY = calculateDropPosition(
        gameState,
        gameState.active.id,
        targetInfo.targetX,
        targetInfo.targetRot,
      );

      visualization.targetPosition = {
        id: gameState.active.id,
        rot: targetInfo.targetRot,
        x: targetInfo.targetX,
        y: targetY,
      };

      // Calculate optimal sequence using finesse calculator
      try {
        const optimalSequences = finesseCalculator.calculateOptimal(
          // Start at spawn origin for BFS and visualization
          spawnFromActive(gameState.active),
          targetInfo.targetX,
          targetInfo.targetRot,
          gameState.gameplay,
        );

        if (optimalSequences.length > 0) {
          const optimalSequence = optimalSequences[0]; // Use first optimal sequence
          applyOptimalSequenceToVisualization(
            visualization,
            gameState,
            optimalSequence,
          );
        }
      } catch (error) {
        console.warn("Failed to calculate finesse path:", error);
      }
    }
  }

  return visualization;
}

// Calculate where a piece would land when dropped at a specific X position and rotation
function calculateDropPosition(
  gameState: GameState,
  pieceId: PieceId,
  targetX: number,
  targetRot: Rot,
): number {
  // Build a piece at target x/rot high above and compute ghost position on actual board
  const piece: ActivePiece = { id: pieceId, rot: targetRot, x: targetX, y: -4 };
  const ghost = calculateGhostPosition(gameState.board, piece);
  return ghost.y;
}

function applyOptimalSequenceToVisualization(
  visualization: FinesseVisualization,
  gameState: GameState,
  optimalSequence: Array<FinesseAction> | undefined,
): void {
  if (!optimalSequence || !gameState.active) return;

  visualization.optimalSequence = optimalSequence;

  // Generate path trace starting from spawn using core movement/rotation on empty board
  visualization.pathTrace = generatePathTrace(
    spawnFromActive(gameState.active),
    optimalSequence,
  );
  visualization.currentStep = calculateCurrentStep(gameState, optimalSequence);
}

function spawnFromActive(active: ActivePiece): ActivePiece {
  const topLeft = PIECES[active.id].spawnTopLeft;
  return { id: active.id, rot: "spawn", x: topLeft[0], y: topLeft[1] };
}

// Generate a trace of piece positions for each step in the optimal sequence
function generatePathTrace(
  startPiece: ActivePiece,
  sequence: Array<string>,
): Array<{ piece: ActivePiece; stepNumber: number; action: string }> {
  const trace: Array<{
    piece: ActivePiece;
    stepNumber: number;
    action: string;
  }> = [];
  const emptyBoard = createEmptyBoard();
  let currentPiece = { ...startPiece };

  // Add starting position
  trace.push({ action: "Start", piece: { ...currentPiece }, stepNumber: 0 });

  for (let i = 0; i < sequence.length; i++) {
    const action = sequence[i];
    if (action === "" || action === undefined) continue;

    currentPiece = executeTraceAction(emptyBoard, currentPiece, action);
    trace.push({ action, piece: { ...currentPiece }, stepNumber: i + 1 });
  }

  return trace;
}

function executeTraceAction(
  board: Board,
  piece: ActivePiece,
  action: string,
): ActivePiece {
  switch (action) {
    case "MoveLeft": {
      const moved = tryMove(board, piece, -1, 0);
      return moved ?? piece;
    }
    case "MoveRight": {
      const moved = tryMove(board, piece, 1, 0);
      return moved ?? piece;
    }
    case "DASLeft":
      return moveToWall(board, piece, -1);
    case "DASRight":
      return moveToWall(board, piece, 1);
    case "RotateCW": {
      const rot = getNextRotation(piece.rot, "CW");
      const rotated = tryRotate(piece, rot, board);
      return rotated ?? piece;
    }
    case "RotateCCW": {
      const rot = getNextRotation(piece.rot, "CCW");
      const rotated = tryRotate(piece, rot, board);
      return rotated ?? piece;
    }
    case "HardDrop":
      // Do not change position here; final drop is visualized by target overlay
      return piece;
    default:
      return piece;
  }
}

// Simple move simulation (this could be enhanced with actual game logic)
// simulateMove removed (now using core functions)

// Calculate which step the player is currently on
function calculateCurrentStep(
  gameState: GameState,
  optimalSequence: Array<string>,
): number {
  const player = extractPlayerFinesseActionsForProgress(gameState);
  return Math.min(player.length, optimalSequence.length);
}

// Build player finesse actions mirroring the service’s extraction logic
function extractPlayerFinesseActionsForProgress(
  state: GameState,
): Array<string> {
  const finesseActions: Array<string> = [];
  let currentDASDirection: -1 | 1 | undefined;

  for (const action of state.processedInputLog) {
    const actionResult = processInputAction(action, currentDASDirection);
    if (
      actionResult.finesseAction !== undefined &&
      actionResult.finesseAction !== ""
    ) {
      finesseActions.push(actionResult.finesseAction);
    }
    currentDASDirection = actionResult.newDASDirection;
  }

  return finesseActions;
}

type ActionResult = {
  finesseAction?: string;
  newDASDirection: -1 | 1 | undefined;
};

function processInputAction(
  action: { type: string; dir?: number | "CW" | "CCW" },
  currentDASDirection: -1 | 1 | undefined,
): ActionResult {
  switch (action.type) {
    case "TapMove":
      return {
        finesseAction: action.dir === -1 ? "MoveLeft" : "MoveRight",
        newDASDirection: undefined,
      };

    case "HoldMove":
    case "RepeatMove":
      if (currentDASDirection !== action.dir) {
        return {
          finesseAction: action.dir === -1 ? "DASLeft" : "DASRight",
          newDASDirection: action.dir as -1 | 1,
        };
      }
      return { newDASDirection: currentDASDirection };

    case "Rotate":
      return {
        finesseAction: action.dir === "CW" ? "RotateCW" : "RotateCCW",
        newDASDirection: undefined,
      };

    case "HardDrop":
      return {
        finesseAction: "HardDrop",
        newDASDirection: undefined,
      };

    default:
      return { newDASDirection: currentDASDirection };
  }
}
