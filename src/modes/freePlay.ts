import { type FinesseResult } from "../finesse/calculator";
import {
  type GameState,
  type ActivePiece,
  type Rot,
  type PieceId,
  type ModeGuidance,
} from "../state/types";

import { type GameMode, type GameModeResult } from "./index";

export class FreePlayMode implements GameMode {
  readonly name = "freePlay";

  onBeforeSpawn(_state: GameState): { piece?: PieceId } | null {
    void _state;
    return null; // no override
  }

  getGuidance(_state: GameState): ModeGuidance | null {
    void _state;
    return null; // no special guidance
  }

  onPieceLocked(
    _gameState: GameState,
    finesseResult: FinesseResult,
    _lockedPiece: ActivePiece,
    _finalPosition: ActivePiece,
  ): GameModeResult {
    void _lockedPiece;
    void _finalPosition;
    const { faults, isOptimal, optimalSequences, playerSequence } =
      finesseResult;

    if (isOptimal) {
      return {
        feedback: `✓ Optimal finesse! Used ${String(playerSequence.length)} inputs.`,
      };
    }

    const optimalLength = optimalSequences[0]?.length ?? 0;
    const extraInputs = playerSequence.length - optimalLength;

    let feedback = `✗ Non-optimal finesse. Used ${String(playerSequence.length)} inputs, optimal was ${String(optimalLength)}.`;

    if (extraInputs > 0) {
      feedback += ` ${String(extraInputs)} extra input${extraInputs > 1 ? "s" : ""}.`;
    }

    if (faults.length > 0) {
      const faultDescriptions = faults.map((f) => f.description).join(", ");
      feedback += ` Issues: ${faultDescriptions}`;
    }

    return { feedback };
  }

  shouldPromptNext(_gameState: GameState): boolean {
    void _gameState;
    return false;
  }

  getNextPrompt(_gameState: GameState): string | null {
    void _gameState;
    return null;
  }

  // Free play analyzes the actual final target; no preset target
  getTargetFor(
    _lockedPiece: ActivePiece,
    _gameState: GameState,
  ): { targetX: number; targetRot: Rot } | null {
    void _lockedPiece;
    void _gameState;
    return null;
  }

  getExpectedPiece(_gameState: GameState): PieceId | undefined {
    void _gameState;
    return undefined;
  }

  reset(): void {
    void 0;
  }
}
