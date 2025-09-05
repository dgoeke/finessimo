import { dropToBottom } from "../core/board";
import { PIECES } from "../core/pieces";
import { createSevenBagRng } from "../core/rng";
import { type PieceRandomGenerator } from "../core/rng-interface";
import { type FinesseResult } from "../finesse/calculator";
import {
  recommendMove,
  type PolicyContext,
  type PolicyOutput,
} from "../policy/index";
import {
  type GameState,
  type ActivePiece,
  type Rot,
  type PieceId,
  type ModeGuidance,
  type BoardDecorations,
} from "../state/types";
import { createGridCoord, gridCoordAsNumber } from "../types/brands";

import {
  type GameMode,
  type GameModeResult,
  type ResolveLockContext,
  type ResolveLockDecision,
} from "./index";

type FreePlayModeData = {
  policyContext: PolicyContext;
  policyOutput?: PolicyOutput;
  lastLoggedPlacement?: { x: number; rot: string; planId?: string };
  lastLogTime?: number;
};

export class FreePlayMode implements GameMode {
  readonly name = "freePlay";

  // Enable hold functionality in free play mode
  initialConfig(): { gameplay: { holdEnabled: boolean } } {
    return {
      gameplay: {
        holdEnabled: true,
      },
    };
  }
  // Initialize policy context for opening coaching
  initModeData(): FreePlayModeData {
    return {
      policyContext: {
        lastBestScore: null,
        lastPlanId: null,
        lastSecondScore: null,
        lastUpdate: null,
        planAge: 0,
      },
    };
  }

  // Seed modeData on activation so UI adapters have policyContext available
  onActivated(_state: GameState): { modeData?: unknown } {
    return { modeData: this.initModeData() };
  }

  onBeforeSpawn(_state: GameState): { piece?: PieceId } | null {
    return null; // no override
  }

  getGuidance(state: GameState): ModeGuidance | null {
    // Only provide guidance if opening coaching is enabled
    if (!state.gameplay.openingCoachingEnabled) {
      return null;
    }

    // Extract mode data with policy context
    const modeData = state.modeData as FreePlayModeData | null;
    if (modeData === null) {
      return null;
    }

    try {
      // Get policy recommendation for guidance only
      const policyOutput = recommendMove(state, modeData.policyContext);
      const placement = policyOutput.suggestion.placement;

      // Return guidance based on the suggested placement
      if (state.active) {
        return {
          target: {
            rot: placement.rot,
            x: placement.x,
          },
        };
      }
    } catch (error) {
      // Silently handle policy errors - don't break gameplay
      console.warn("Policy recommendation failed:", error);
    }

    return null;
  }

  onPieceLocked(
    gameState: GameState,
    _finesseResult: FinesseResult,
    _lockedPiece: ActivePiece,
    _finalPosition: ActivePiece,
  ): GameModeResult {
    // FreePlay does not emit textual feedback; overlay renders from FinesseResult

    // Update policy context if opening coaching is enabled
    if (gameState.gameplay.openingCoachingEnabled) {
      const modeData = gameState.modeData as FreePlayModeData | null;
      if (modeData !== null) {
        try {
          // Get policy recommendation for the current state
          const policyOutput = recommendMove(gameState, modeData.policyContext);

          // Update mode data with new policy context and output
          const updatedModeData: FreePlayModeData = {
            policyContext: policyOutput.nextCtx,
            policyOutput,
          };

          return {
            modeData: updatedModeData,
          };
        } catch (error) {
          console.warn("Policy update failed:", error);
        }
      }
    }

    return {};
  }

  shouldPromptNext(_gameState: GameState): boolean {
    return false;
  }

  getNextPrompt(_gameState: GameState): string | null {
    return null;
  }

  // Free play analyzes the actual final target; no preset target
  getTargetFor(
    _lockedPiece: ActivePiece,
    _gameState: GameState,
  ): { targetX: number; targetRot: Rot } | null {
    return null;
  }

  // Provide a legacy board decoration to visualize the suggested target
  getBoardDecorations(state: GameState): BoardDecorations | null {
    if (state.status !== "playing") return null;
    if (!state.gameplay.openingCoachingEnabled) return null;

    const modeData = state.modeData as FreePlayModeData | null;
    if (modeData === null) return null;

    const policyOutput = recommendMove(state, modeData.policyContext);
    const placement = policyOutput.suggestion.placement;

    // Only decorate when the current active piece is to be placed.
    // If the suggestion is to use hold, skip decorations to avoid
    // showing the next piece's landing as the current piece's target.
    if (placement.useHold === true) {
      return null;
    }

    const placingPieceId: PieceId | undefined = state.active?.id;
    if (placingPieceId === undefined) {
      return null;
    }

    const startY = createGridCoord(-2);
    const piece = {
      id: placingPieceId,
      rot: placement.rot,
      x: placement.x,
      y: startY,
    } as const;

    const finalPos = dropToBottom(state.board, piece);

    const shape = PIECES[piece.id];
    const decorated = shape.cells[piece.rot]
      .map(([dx, dy]) => {
        const ax = createGridCoord(gridCoordAsNumber(finalPos.x) + dx);
        const ay = createGridCoord(gridCoordAsNumber(finalPos.y) + dy);
        return { ax, ay } as const;
      })
      .filter(({ ax, ay }) => {
        const axNum = gridCoordAsNumber(ax);
        const ayNum = gridCoordAsNumber(ay);
        return (
          axNum >= 0 &&
          axNum < state.board.width &&
          ayNum >= 0 &&
          ayNum < state.board.height
        );
      })
      .map(({ ax, ay }) => ({ x: ax, y: ay }));

    return [
      {
        alpha: 0.25,
        cells: decorated,
        color: shape.color,
        type: "cellHighlight",
      },
    ];
  }

  getExpectedPiece(_gameState: GameState): PieceId | undefined {
    return undefined;
  }

  // Lock resolution - implements retry on finesse error for hard drops
  onResolveLock(ctx: ResolveLockContext): ResolveLockDecision {
    const { finesse, pending, state } = ctx;

    // Only retry on hard drops with finesse errors when setting is enabled
    if (
      state.gameplay.retryOnFinesseError === true &&
      pending.source === "hardDrop" &&
      finesse.kind === "faulty" &&
      finesse.optimalSequences.length > 0
    ) {
      return { action: "retry" };
    }

    return { action: "commit" };
  }

  // 7-bag defaults for RNG and preview
  createRng(seed: string, _prev?: PieceRandomGenerator): PieceRandomGenerator {
    return createSevenBagRng(seed);
  }

  getNextPiece(
    _state: GameState,
    rng: PieceRandomGenerator,
  ): { piece: PieceId; newRng: PieceRandomGenerator } {
    return rng.getNextPiece();
  }

  getPreview(
    _state: GameState,
    rng: PieceRandomGenerator,
    count: number,
  ): { pieces: Array<PieceId>; newRng: PieceRandomGenerator } {
    return rng.getNextPieces(count);
  }

  reset(): void {
    // Intentionally no-op for free play
  }
}
