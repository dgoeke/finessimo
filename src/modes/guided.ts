import {
  GameState,
  PieceId,
  Rot,
  ActivePiece,
  ModeGuidance,
} from "../state/types";
import { FinesseResult } from "../finesse/calculator";
import { GameMode, GameModeResult } from "./index";

interface GuidedDrill {
  piece: PieceId;
  targetX: number;
  targetRot: Rot;
  description: string;
}

interface GuidedData {
  currentDrillIndex: number;
  attemptsOnCurrentDrill: number;
}

export class GuidedMode implements GameMode {
  readonly name = "guided";

  private drills: GuidedDrill[] = [
    {
      piece: "T",
      targetX: 0,
      targetRot: "spawn",
      description: "Place T-piece at left edge (spawn rotation)",
    },
    {
      piece: "T",
      targetX: 7,
      targetRot: "spawn",
      description: "Place T-piece at right edge (spawn rotation)",
    },
    {
      piece: "T",
      targetX: 4,
      targetRot: "right",
      description: "Place T-piece at center (right rotation)",
    },
    {
      piece: "I",
      targetX: 0,
      targetRot: "spawn",
      description: "Place I-piece at left edge (spawn rotation)",
    },
    {
      piece: "I",
      targetX: 6,
      targetRot: "spawn",
      description: "Place I-piece at right edge (spawn rotation)",
    },
    {
      piece: "L",
      targetX: 0,
      targetRot: "spawn",
      description: "Place L-piece at left edge (spawn rotation)",
    },
    {
      piece: "J",
      targetX: 7,
      targetRot: "spawn",
      description: "Place J-piece at right edge (spawn rotation)",
    },
  ];

  initModeData(): GuidedData {
    return { currentDrillIndex: 0, attemptsOnCurrentDrill: 0 };
  }

  private getData(state: GameState): GuidedData {
    const data = (state.modeData as GuidedData) || this.initModeData();
    return {
      currentDrillIndex: data.currentDrillIndex ?? 0,
      attemptsOnCurrentDrill: data.attemptsOnCurrentDrill ?? 0,
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
      target: { x: drill.targetX, rot: drill.targetRot },
      label: `Drill ${data.currentDrillIndex + 1}/${this.drills.length}: ${drill.description}`,
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
      return {
        feedback: "All drills completed! Well done!",
        isComplete: true,
      };
    }

    const { isOptimal, playerSequence, optimalSequences, faults } =
      finesseResult;

    // Enforce piece identity and target match for the current drill
    const expected = currentDrill;
    if (expected) {
      if (lockedPiece.id !== expected.piece) {
        return { feedback: `✗ Wrong piece. Expected ${expected.piece}.` };
      }
      if (
        !(
          finalPosition.x === expected.targetX &&
          finalPosition.rot === expected.targetRot
        )
      ) {
        return {
          feedback: `✗ Wrong target. Place at x=${expected.targetX}, rot=${expected.targetRot}.`,
        };
      }
    }

    if (isOptimal) {
      const nextIndex = data.currentDrillIndex + 1;
      const nextDrill = this.drills[nextIndex];

      let feedback = `✓ Perfect! Completed drill in ${playerSequence.length} inputs (optimal).`;

      if (nextDrill) {
        feedback += ` Moving to next drill.`;
        return {
          feedback,
          nextPrompt: nextDrill.description,
          modeData: { currentDrillIndex: nextIndex, attemptsOnCurrentDrill: 0 },
        };
      } else {
        return {
          feedback: `${feedback} All drills completed! Excellent work!`,
          isComplete: true,
          modeData: { currentDrillIndex: nextIndex, attemptsOnCurrentDrill: 0 },
        };
      }
    }

    const optimalLength = optimalSequences[0]?.length || 0;
    const extraInputs = playerSequence.length - optimalLength;

    let feedback = `✗ Try again! Used ${playerSequence.length} inputs, optimal is ${optimalLength}.`;

    if (extraInputs > 0) {
      feedback += ` You used ${extraInputs} extra input${extraInputs > 1 ? "s" : ""}.`;
    }

    if (faults.length > 0) {
      const primaryFault = faults[0];
      if (primaryFault) {
        feedback += ` Hint: ${primaryFault.description}`;
      }
    }

    const baseAttempts = data.attemptsOnCurrentDrill ?? 0;
    const nextAttempts = baseAttempts + 1;
    if (nextAttempts > 2 && optimalSequences.length > 0) {
      const optimalSequence = optimalSequences[0];
      if (optimalSequence) {
        const optimalStr = optimalSequence.join(" → ");
        feedback += ` Optimal sequence: ${optimalStr}`;
      }
    }
    return {
      feedback,
      modeData: {
        currentDrillIndex: data.currentDrillIndex,
        attemptsOnCurrentDrill: nextAttempts,
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
      return `Drill ${data.currentDrillIndex + 1}/${this.drills.length}: ${currentDrill.description}`;
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
    return { targetX: currentDrill.targetX, targetRot: currentDrill.targetRot };
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
