import { dropToBottom } from "../core/board";
import { PIECES } from "../core/pieces";
import { type GameMode } from "../modes";
import {
  type GameState,
  type Action,
  type ActivePiece,
  type Rot,
  type FinesseAction,
} from "../state/types";
import { createGridCoord } from "../types/brands";
// debug logging removed

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

    // no debug logging

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

    // Compute optimal sequences; if the mode provides occupancy-based validation,
    // accept any (x,rot) whose final placement satisfies the same target.
    const optimalSequences = this.calculateOptimalWithEquivalents(
      state,
      gameMode,
      spawnPiece,
      targetX,
      targetRot,
    );

    // Short-circuit: if player used soft drop at any point, treat as optimal pass-through
    const usedSoftDrop = playerInputs.includes("SoftDrop");
    const finesseResult = usedSoftDrop
      ? {
          kind: "optimal" as const,
          optimalSequences,
          playerSequence: playerInputs,
        }
      : this.compareToOptimal(optimalSequences, playerInputs);

    // no debug logging

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

    // no debug logging

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
        // no debug logging
      }
    } else if (typeof gameMode.getTargetFor === "function") {
      const t = gameMode.getTargetFor(lockedPiece, state);
      if (t) {
        targetX = t.targetX;
        targetRot = t.targetRot;
        // no debug logging
      }
    }

    return { targetRot, targetX };
  }

  // Expand targets by occupancy equivalence if the mode supports it; otherwise
  // calculate for the single canonical target.
  private calculateOptimalWithEquivalents(
    state: GameState,
    gameMode: GameMode,
    spawnPiece: ActivePiece,
    targetX: number,
    targetRot: Rot,
  ): Array<Array<FinesseAction>> {
    const calcFor = (x: number, rot: Rot): Array<Array<FinesseAction>> =>
      finesseCalculator.calculateOptimal(spawnPiece, x, rot, state.gameplay);

    // Base case: no special validation hook → single target analysis
    if (typeof gameMode.isTargetSatisfied !== "function") {
      return calcFor(targetX, targetRot);
    }

    // Build a list of equivalent (x,rot) placements that satisfy the target by
    // occupancy on the current board.
    const boardForEquiv = state.board;
    const pieceId = spawnPiece.id;
    const candidates: Array<{ x: number; rot: Rot }> = [];

    const rots: ReadonlyArray<Rot> = ["spawn", "right", "two", "left"];
    for (const rot of rots) {
      const [minX, maxX] = this.validXBounds(pieceId, rot);
      for (let x = minX; x <= maxX; x++) {
        const candidate: ActivePiece = {
          id: pieceId,
          rot,
          x: createGridCoord(x),
          y: createGridCoord(-2),
        };
        const finalPos = dropToBottom(boardForEquiv, candidate);
        // Reuse mode occupancy validation to see if this finalPos would be accepted
        const ok = gameMode.isTargetSatisfied(spawnPiece, finalPos, state);
        if (ok) candidates.push({ rot, x });
      }
    }

    // no debug logging

    // Always include the base target in case none matched (defensive)
    if (!candidates.some((c) => c.x === targetX && c.rot === targetRot)) {
      candidates.push({ rot: targetRot, x: targetX });
    }

    // Calculate and merge unique sequences across all equivalent targets
    const uniq = new Map<string, Array<FinesseAction>>();
    for (const c of candidates) {
      const seqs = calcFor(c.x, c.rot);
      for (const s of seqs) {
        const key = s.join("|");
        if (!uniq.has(key)) uniq.set(key, s);
      }
    }
    return Array.from(uniq.values());
  }

  private validXBounds(pieceId: string, rot: Rot): readonly [number, number] {
    const shape = PIECES[pieceId as keyof typeof PIECES];
    const cells = shape.cells[rot];
    let minDx = Number.POSITIVE_INFINITY;
    let maxDx = Number.NEGATIVE_INFINITY;
    for (const [dx] of cells) {
      if (dx < minDx) minDx = dx;
      if (dx > maxDx) maxDx = dx;
    }
    const minStart = -minDx;
    const maxStart = 9 - maxDx;
    return [minStart, maxStart] as const;
  }

  private compareToOptimal(
    optimalSequences: Array<Array<FinesseAction>>,
    playerInputs: Array<FinesseAction>,
  ): FinesseResult {
    const normalized = playerInputs; // already normalized by extractor

    const minLen = optimalSequences.reduce(
      (min, seq) => Math.min(min, seq.length),
      Number.POSITIVE_INFINITY,
    );
    const optimalLength = minLen === Number.POSITIVE_INFINITY ? 0 : minLen;
    const playerLength = normalized.length;
    const isOptimal = playerLength === optimalLength;

    const faults: Array<Fault> = [];
    if (playerLength > optimalLength) {
      faults.push({
        description: `Used ${String(playerLength)} inputs instead of optimal ${String(optimalLength)}`,
        position: optimalLength,
        type: "extra_input",
      });
    } else if (playerLength < optimalLength) {
      faults.push({
        description: `Sequence incomplete or mismatched; expected ${String(optimalLength)} inputs`,
        position: playerLength,
        type: "suboptimal_path",
      });
    }

    return isOptimal && faults.length === 0
      ? { kind: "optimal", optimalSequences, playerSequence: normalized }
      : {
          faults,
          kind: "faulty",
          optimalSequences,
          playerSequence: normalized,
        };
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
    modeResult: {
      nextPrompt?: string;
      modeData?: unknown;
      postActions?: ReadonlyArray<Action>;
    },
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
    if (modeResult.postActions && modeResult.postActions.length > 0) {
      actions.push(...modeResult.postActions);
    }

    // Clear the processed input log after analysis
    actions.push({ type: "ClearInputLog" });

    return actions;
  }
}

export const finesseService = new DefaultFinesseService();
