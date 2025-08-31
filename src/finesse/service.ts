// Refactored finesse/service.ts
// Keeps the same public surface (exported finesseService) but simplifies logic:
// - Delegates board-awareness to calculator via its overload (preserves callers)
// - Still honors GameMode.isTargetSatisfied for "guided" or custom modes
// - Stronger functional style and clear separation of concerns

// no direct board mutations used here; analyzer consumes processed input log
import { PIECES } from "../core/pieces";
import { type GameMode } from "../modes";
import { type GameState, type Action, type ActivePiece } from "../state/types";
import { createGridCoord, gridCoordAsNumber } from "../types/brands";

import {
  finesseCalculator,
  extractFinesseActionsFromProcessed,
  type FinesseResult,
} from "./calculator";

export type FinesseService = {
  analyzePieceLock(
    state: GameState,
    lockedPiece: ActivePiece,
    mode: GameMode,
    timestampMs?: number,
  ): Array<Action>;
};

export class DefaultFinesseService implements FinesseService {
  analyzePieceLock(
    state: GameState,
    lockedPiece: ActivePiece,
    mode: GameMode,
    _timestampMs?: number,
  ): Array<Action> {
    void _timestampMs; // accepted for API compatibility
    const actions: Array<Action> = [];

    // Extract player inputs from processed log
    const playerInputs = extractFinesseActionsFromProcessed(
      state.processedInputLog,
    );

    // Short-circuit: no inputs → optimal empty feedback
    if (playerInputs.length === 0) {
      actions.push({
        feedback: { kind: "optimal", optimalSequences: [], playerSequence: [] },
        type: "UpdateFinesseFeedback",
      });
      actions.push({
        faults: [],
        inputCount: 0,
        isOptimal: true,
        optimalInputCount: 0,
        type: "RecordPieceLock",
      });
      actions.push({ type: "ClearInputLog" });
      return actions;
    }

    // Always analyze from spawn state of the locked piece's ID
    const spawnPiece = this.createSpawnPiece(lockedPiece);

    // Determine analysis target
    const modeTarget =
      typeof mode.getTargetFor === "function"
        ? mode.getTargetFor(spawnPiece, state)
        : null;

    // Default to the actually locked position (free play)
    const targetX = modeTarget?.targetX ?? gridCoordAsNumber(lockedPiece.x);
    const targetRot = modeTarget?.targetRot ?? lockedPiece.rot;

    // Run analysis against optimal sequences
    const result: FinesseResult = finesseCalculator.analyze(
      spawnPiece,
      targetX,
      targetRot,
      playerInputs,
      state.gameplay,
    );

    // Emit feedback for UI
    actions.push({ feedback: result, type: "UpdateFinesseFeedback" });

    // Record stats
    const optimalInputCount =
      result.optimalSequences.length > 0
        ? Math.min(...result.optimalSequences.map((s) => s.length))
        : 0;
    const faults =
      result.kind === "faulty" ? result.faults.map((f) => f.type) : [];
    actions.push({
      faults,
      inputCount: playerInputs.length,
      isOptimal: result.kind === "optimal",
      optimalInputCount,
      type: "RecordPieceLock",
    });

    // Clear processed inputs for next piece
    actions.push({ type: "ClearInputLog" });

    return actions;
  }

  private createSpawnPiece(lockedPiece: ActivePiece): ActivePiece {
    const spawnTopLeft = PIECES[lockedPiece.id].spawnTopLeft;
    return {
      id: lockedPiece.id,
      rot: "spawn",
      x: createGridCoord(spawnTopLeft[0]),
      y: createGridCoord(spawnTopLeft[1]),
    };
  }
}

export const finesseService = new DefaultFinesseService();
