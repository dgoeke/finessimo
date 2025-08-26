import { dropToBottom } from "../core/board";
import { PIECES } from "../core/pieces";
import { type GameMode } from "../modes";
import {
  type GameState,
  type Action,
  type ActivePiece,
  type FinesseUIFeedback,
  type Rot,
  type FinesseAction,
} from "../state/types";
import { asNumber, fromNow, createTimestamp } from "../types/timestamp";

import {
  finesseCalculator,
  extractFinesseActions,
  type Fault,
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
    timestampMs?: number,
  ): Array<Action> {
    const finalPosition = dropToBottom(state.board, lockedPiece);
    const { targetRot, targetX } = this.determineAnalysisTarget(
      gameMode,
      state,
      lockedPiece,
      finalPosition,
    );
    const spawnPiece = this.createSpawnPiece(lockedPiece);
    const playerInputs = extractFinesseActions(state.processedInputLog);

    const finesseResult = finesseCalculator.analyze(
      spawnPiece,
      targetX,
      targetRot,
      playerInputs,
      state.gameplay,
    );

    const faults = this.gatherModeFaults(
      gameMode,
      state,
      lockedPiece,
      finalPosition,
      finesseResult.faults,
    );
    const mergedResult = {
      ...finesseResult,
      faults,
      isOptimal: finesseResult.isOptimal && faults.length === 0,
    };

    const modeResult = gameMode.onPieceLocked(
      state,
      mergedResult,
      lockedPiece,
      finalPosition,
    );

    return this.buildActionList(
      mergedResult,
      modeResult,
      playerInputs,
      timestampMs,
    );
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
      x: spawnTopLeft[0],
      y: spawnTopLeft[1],
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
    mergedResult: {
      isOptimal: boolean;
      faults: Array<Fault>;
      optimalSequences: Array<Array<string>>;
    },
    modeResult: { nextPrompt?: string; modeData?: unknown },
    playerInputs: Array<string>,
    timestampMs?: number,
  ): Array<Action> {
    const actions: Array<Action> = [];

    // Add finesse feedback action
    const feedback: FinesseUIFeedback = {
      isOptimal: mergedResult.isOptimal,
      ...(!mergedResult.isOptimal && mergedResult.optimalSequences.length > 0
        ? {
            optimalSequence: mergedResult
              .optimalSequences[0] as Array<FinesseAction>,
          }
        : {}),
      timestamp: asNumber(
        timestampMs !== undefined ? createTimestamp(timestampMs) : fromNow(),
      ),
    };
    actions.push({ feedback, type: "UpdateFinesseFeedback" });

    // Add statistics tracking action
    const optimalInputCount =
      mergedResult.optimalSequences.length > 0
        ? Math.min(...mergedResult.optimalSequences.map((s) => s.length))
        : 0;
    actions.push({
      faults: mergedResult.faults.map((f) => f.type),
      inputCount: playerInputs.length,
      isOptimal: mergedResult.isOptimal,
      optimalInputCount,
      type: "RecordPieceLock",
    });

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
