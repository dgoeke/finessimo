import { type FinesseResult, assertNever } from "../finesse/calculator";
import {
  type GameState,
  type PieceId,
  type Rot,
  type ActivePiece,
  type ModeGuidance,
} from "../state/types";
import { createGridCoord } from "../types/brands";

import { type GameMode, type GameModeResult } from "./index";

type GuidedDrill = {
  piece: PieceId;
  targetX: number;
  targetRot: Rot;
  description: string;
};

type GuidedData = {
  currentDrillIndex: number;
  attemptsOnCurrentDrill: number;
};

export class GuidedMode implements GameMode {
  readonly name = "guided";

  private drills: Array<GuidedDrill> = [
    {
      description: "Place T-piece at left edge (spawn rotation)",
      piece: "T",
      targetRot: "spawn",
      targetX: 0,
    },
    {
      description: "Place T-piece at right edge (spawn rotation)",
      piece: "T",
      targetRot: "spawn",
      targetX: 7,
    },
    {
      description: "Place T-piece at center (right rotation)",
      piece: "T",
      targetRot: "right",
      targetX: 4,
    },
    {
      description: "Place I-piece at left edge (spawn rotation)",
      piece: "I",
      targetRot: "spawn",
      targetX: 0,
    },
    {
      description: "Place I-piece at right edge (spawn rotation)",
      piece: "I",
      targetRot: "spawn",
      targetX: 6,
    },
    {
      description: "Place L-piece at left edge (spawn rotation)",
      piece: "L",
      targetRot: "spawn",
      targetX: 0,
    },
    {
      description: "Place J-piece at right edge (spawn rotation)",
      piece: "J",
      targetRot: "spawn",
      targetX: 7,
    },
  ];

  initModeData(): GuidedData {
    return { attemptsOnCurrentDrill: 0, currentDrillIndex: 0 };
  }

  private getData(state: GameState): GuidedData {
    const data = state.modeData as GuidedData | undefined;
    if (!data) {
      return this.initModeData();
    }
    return {
      attemptsOnCurrentDrill: data.attemptsOnCurrentDrill,
      currentDrillIndex: data.currentDrillIndex,
    };
  }

  onBeforeSpawn(state: GameState): { piece?: PieceId } | null {
    void state;
    const data = this.getData(state);
    const drill = this.drills[data.currentDrillIndex];
    if (!drill || state.status !== "playing") return null;
    return { piece: drill.piece };
  }

  getGuidance(state: GameState): ModeGuidance | null {
    const data = this.getData(state);
    const drill = this.drills[data.currentDrillIndex];
    if (!drill) return null;
    return {
      label: `Drill ${String(data.currentDrillIndex + 1)}/${String(this.drills.length)}: ${drill.description}`,
      target: { rot: drill.targetRot, x: createGridCoord(drill.targetX) },
      visual: { highlightTarget: true, showPath: true },
    };
  }

  onPieceLocked(
    _gameState: GameState,
    finesseResult: FinesseResult,
    lockedPiece: ActivePiece,
    finalPosition: ActivePiece,
  ): GameModeResult {
    const data = this.getData(_gameState);
    const currentDrill = this.drills[data.currentDrillIndex];

    if (!currentDrill) {
      return { isComplete: true };
    }

    const validationResult = this.validatePieceAndTarget(
      lockedPiece,
      finalPosition,
      currentDrill,
    );
    if (validationResult) {
      return validationResult;
    }

    switch (finesseResult.kind) {
      case "optimal":
        return this.handleOptimalSolution(data);
      case "faulty":
        return this.handleSuboptimalSolution(data);
      default:
        return assertNever(finesseResult);
    }
  }

  private validatePieceAndTarget(
    lockedPiece: ActivePiece,
    finalPosition: ActivePiece,
    expected: GuidedDrill,
  ): GameModeResult | null {
    if (lockedPiece.id !== expected.piece) {
      // Do not advance; textual feedback is not emitted here
      return {};
    }
    if (
      !(
        finalPosition.x === expected.targetX &&
        finalPosition.rot === expected.targetRot
      )
    ) {
      // Do not advance; textual feedback is not emitted here
      return {};
    }
    return null;
  }

  private handleOptimalSolution(data: GuidedData): GameModeResult {
    const nextIndex = data.currentDrillIndex + 1;
    const nextDrill = this.drills[nextIndex];
    if (nextDrill) {
      return {
        modeData: { attemptsOnCurrentDrill: 0, currentDrillIndex: nextIndex },
        nextPrompt: nextDrill.description,
      };
    } else {
      return {
        isComplete: true,
        modeData: { attemptsOnCurrentDrill: 0, currentDrillIndex: nextIndex },
      };
    }
  }

  private handleSuboptimalSolution(data: GuidedData): GameModeResult {
    const nextAttempts = data.attemptsOnCurrentDrill + 1;
    return {
      modeData: {
        attemptsOnCurrentDrill: nextAttempts,
        currentDrillIndex: data.currentDrillIndex,
      },
    };
  }

  shouldPromptNext(gameState: GameState): boolean {
    if (!gameState.active) {
      const data = this.getData(gameState);
      const currentDrill = this.drills[data.currentDrillIndex];
      return currentDrill !== undefined;
    }
    return false;
  }

  getNextPrompt(_gameState: GameState): string | null {
    void _gameState;
    const data = this.getData(_gameState);
    const currentDrill = this.drills[data.currentDrillIndex];
    if (currentDrill) {
      return `Drill ${String(data.currentDrillIndex + 1)}/${String(this.drills.length)}: ${currentDrill.description}`;
    }
    return null;
  }

  // Provide intended target for analysis
  getTargetFor(
    _lockedPiece: ActivePiece,
    _gameState: GameState,
  ): { targetX: number; targetRot: Rot } | null {
    void _lockedPiece;
    const data = this.getData(_gameState);
    const currentDrill = this.drills[data.currentDrillIndex];
    if (!currentDrill) return null;
    return { targetRot: currentDrill.targetRot, targetX: currentDrill.targetX };
  }

  getExpectedPiece(_gameState: GameState): PieceId | undefined {
    void _gameState;
    const data = this.getData(_gameState);
    const currentDrill = this.drills[data.currentDrillIndex];
    return currentDrill?.piece;
  }

  reset(): void {
    void 0;
  }

  getCurrentDrill(): GuidedDrill | undefined {
    return undefined;
  }

  getProgress(): { current: number; total: number } {
    return { current: 0, total: this.drills.length };
  }
}
