import { dropToBottom } from "../core/board";
import { PIECES } from "../core/pieces";
import { type GameMode } from "../modes";
import {
  type GameState,
  type Action,
  type ActivePiece,
  type Rot,
} from "../state/types";
import { createGridCoord } from "../types/brands";

import {
  finesseCalculator,
  extractFinesseActionsFromProcessed,
  assertNever,
  type Fault,
  type FinesseResult,
} from "./calculator";

export type FinesseService = {
  analyzePieceLock(
    state: GameState,
    lockedPiece: ActivePiece,
    gameMode: GameMode,
    timestampMs?: number,
  ): Array<Action>;
};

export class DefaultFinesseService implements FinesseService {
  analyzePieceLock(
    state: GameState,
    lockedPiece: ActivePiece,
    gameMode: GameMode,
    _timestampMs?: number,
  ): Array<Action> {
    const finalPosition = dropToBottom(state.board, lockedPiece);
    const { targetRot, targetX } = this.determineAnalysisTarget(
      gameMode,
      state,
      lockedPiece,
      finalPosition,
    );
    const spawnPiece = this.createSpawnPiece(lockedPiece);
    const playerInputs = extractFinesseActionsFromProcessed(
      state.processedInputLog,
    );

    // Short-circuit: if no player inputs, emit optimal empty feedback and stats
    if (playerInputs.length === 0) {
      const emptyResult: FinesseResult = {
        kind: "optimal",
        optimalSequences: [],
        playerSequence: [],
      };

      const modeResult = gameMode.onPieceLocked(
        state,
        emptyResult,
        lockedPiece,
        finalPosition,
      );

      return this.buildActionList(emptyResult, modeResult, playerInputs);
    }

    const finesseResult = finesseCalculator.analyze(
      spawnPiece,
      targetX,
      targetRot,
      playerInputs,
      state.gameplay,
    );

    // Gather additional mode-specific faults
    const existingFaults =
      finesseResult.kind === "faulty" ? finesseResult.faults : [];
    const modeFaults = this.gatherModeFaults(
      gameMode,
      state,
      lockedPiece,
      finalPosition,
      existingFaults,
    );

    // Merge results - if we have any faults (calculator + mode), result is faulty
    const mergedResult: FinesseResult =
      modeFaults.length === 0 && finesseResult.kind === "optimal"
        ? finesseResult // Keep optimal as-is
        : {
            faults: modeFaults,
            kind: "faulty",
            optimalSequences: finesseResult.optimalSequences,
            playerSequence: finesseResult.playerSequence,
          };

    const modeResult = gameMode.onPieceLocked(
      state,
      mergedResult,
      lockedPiece,
      finalPosition,
    );

    return this.buildActionList(mergedResult, modeResult, playerInputs);
  }

  private determineAnalysisTarget(
    gameMode: GameMode,
    state: GameState,
    lockedPiece: ActivePiece,
    finalPosition: ActivePiece,
  ): { targetX: number; targetRot: Rot } {
    let targetX: number = finalPosition.x;
    let targetRot: Rot = finalPosition.rot;

    if (typeof gameMode.getGuidance === "function") {
      const g = gameMode.getGuidance(state);
      if (g?.target) {
        targetX = g.target.x;
        targetRot = g.target.rot;
      }
    } else if (typeof gameMode.getTargetFor === "function") {
      const t = gameMode.getTargetFor(lockedPiece, state);
      if (t) {
        targetX = t.targetX;
        targetRot = t.targetRot;
      }
    }

    return { targetRot, targetX };
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

  private gatherModeFaults(
    gameMode: GameMode,
    state: GameState,
    lockedPiece: ActivePiece,
    finalPosition: ActivePiece,
    existingFaults: Array<Fault>,
  ): Array<Fault> {
    const faults: Array<Fault> = [...existingFaults];

    this.checkForWrongPiece(gameMode, state, lockedPiece, faults);
    this.checkForWrongTarget(
      gameMode,
      state,
      lockedPiece,
      finalPosition,
      faults,
    );

    return faults;
  }

  private checkForWrongPiece(
    gameMode: GameMode,
    state: GameState,
    lockedPiece: ActivePiece,
    faults: Array<Fault>,
  ): void {
    if (typeof gameMode.getExpectedPiece === "function") {
      const expected = gameMode.getExpectedPiece(state);
      if (expected !== undefined && lockedPiece.id !== expected) {
        faults.push({
          description: `Expected piece ${expected}, got ${lockedPiece.id}`,
          type: "wrong_piece",
        });
      }
    }
  }

  private checkForWrongTarget(
    gameMode: GameMode,
    state: GameState,
    lockedPiece: ActivePiece,
    finalPosition: ActivePiece,
    faults: Array<Fault>,
  ): void {
    // Prefer mode-specific validation when available
    if (typeof gameMode.isTargetSatisfied === "function") {
      const ok = gameMode.isTargetSatisfied(lockedPiece, finalPosition, state);
      if (!ok) {
        // Fall back to descriptive guidance if available
        const t =
          typeof gameMode.getTargetFor === "function"
            ? gameMode.getTargetFor(lockedPiece, state)
            : null;
        const desc = t
          ? `Expected target x=${String(t.targetX)}, rot=${t.targetRot}`
          : "Incorrect placement for this mode";
        faults.push({ description: desc, type: "wrong_target" });
      }
      return;
    }
    if (typeof gameMode.getTargetFor === "function") {
      const t = gameMode.getTargetFor(lockedPiece, state);
      if (
        t &&
        !(finalPosition.x === t.targetX && finalPosition.rot === t.targetRot)
      ) {
        faults.push({
          description: `Expected target x=${String(t.targetX)}, rot=${t.targetRot}`,
          type: "wrong_target",
        });
      }
    }
  }

  private buildActionList(
    mergedResult: FinesseResult,
    modeResult: { nextPrompt?: string; modeData?: unknown },
    playerInputs: Array<string>,
  ): Array<Action> {
    const actions: Array<Action> = [];

    // Add finesse feedback action - pass the rich FinesseResult directly
    const feedback = mergedResult;
    actions.push({ feedback, type: "UpdateFinesseFeedback" });

    // Add statistics tracking action using exhaustive checking
    const optimalInputCount =
      mergedResult.optimalSequences.length > 0
        ? Math.min(...mergedResult.optimalSequences.map((s) => s.length))
        : 0;

    switch (mergedResult.kind) {
      case "optimal":
        actions.push({
          faults: [],
          inputCount: playerInputs.length,
          isOptimal: true,
          optimalInputCount,
          type: "RecordPieceLock",
        });
        break;
      case "faulty":
        actions.push({
          faults: mergedResult.faults.map((f) => f.type),
          inputCount: playerInputs.length,
          isOptimal: false,
          optimalInputCount,
          type: "RecordPieceLock",
        });
        break;
      default:
        assertNever(mergedResult);
    }

    // Add mode-specific actions
    if (modeResult.nextPrompt !== undefined) {
      actions.push({ prompt: modeResult.nextPrompt, type: "UpdateModePrompt" });
    }
    if (modeResult.modeData !== undefined) {
      actions.push({ data: modeResult.modeData, type: "UpdateModeData" });
    }

    // Clear the processed input log after analysis
    actions.push({ type: "ClearInputLog" });

    return actions;
  }
}

export const finesseService = new DefaultFinesseService();
