/**
 * Reducer helper with lock-pipeline integration for tests.
 *
 * This wraps the pure reducer and, whenever a pending lock is staged
 * (status === 'resolvingLock'), runs the lock pipeline to make a
 * commit/retry decision using the real finesse service and active mode.
 * It also mirrors app-level preview refill behavior for deterministic tests.
 */

import { finesseService } from "@/engine/finesse/service";
import { gameModeRegistry } from "@/modes/index";
import { runLockPipeline } from "@/modes/lock-pipeline";
import { planPreviewRefill } from "@/modes/spawn-service";
import { reducer } from "@/state/reducer";

import type { FinesseResult } from "@/engine/finesse/calculator";
import type { Action, GameState } from "@/state/types";

export function reducerWithPipeline(
  state: GameState | undefined,
  action: Action,
): GameState {
  const prevQueueLen =
    state !== undefined && Array.isArray(state.nextQueue)
      ? state.nextQueue.length
      : 0;

  let currentState = reducer(state, action);

  // When a pending lock is staged, run the pure lock pipeline to decide
  if (currentState.status === "resolvingLock") {
    const analyze = (
      s: GameState,
    ): { result: FinesseResult; actions: Array<Action> } => {
      const mode = gameModeRegistry.get(s.currentMode);
      if (!mode) {
        return {
          actions: [],
          result: { kind: "optimal", optimalSequences: [], playerSequence: [] },
        };
      }
      if (!s.pendingLock) {
        return {
          actions: [],
          result: { kind: "optimal", optimalSequences: [], playerSequence: [] },
        };
      }
      const actions = finesseService.analyzePieceLock(
        s,
        s.pendingLock.finalPos,
        mode,
        s.pendingLock.timestampMs,
      );

      // Extract the latest finesse result from emitted feedback action
      const feedbackAction = actions.find(
        (a): a is Extract<Action, { type: "UpdateFinesseFeedback" }> =>
          a.type === "UpdateFinesseFeedback",
      );

      const result: FinesseResult = feedbackAction?.feedback ?? {
        kind: "optimal",
        optimalSequences: [],
        playerSequence: [],
      };

      return { actions, result };
    };

    runLockPipeline(
      currentState,
      (pipelineAction) => {
        currentState = reducer(currentState, pipelineAction);
      },
      analyze,
      currentState.pendingLock.timestampMs,
    );
  }

  // If preview queue shrank, mirror app behavior to refill via the active mode
  if (
    state !== undefined &&
    Array.isArray(currentState.nextQueue) &&
    currentState.nextQueue.length < prevQueueLen
  ) {
    try {
      const mode = gameModeRegistry.get(currentState.currentMode);
      const desiredRaw =
        typeof (currentState as { gameplay?: { nextPieceCount?: number } })
          .gameplay?.nextPieceCount === "number"
          ? (currentState as { gameplay: { nextPieceCount: number } }).gameplay
              .nextPieceCount
          : 5;
      const desired = Math.max(5, desiredRaw);
      const refill = planPreviewRefill(currentState, mode, desired);
      if (refill !== null && refill.pieces.length > 0) {
        currentState = reducer(currentState, {
          pieces: refill.pieces,
          rng: refill.newRng,
          type: "RefillPreview",
        });
      }
    } catch {
      // In malformed states used by certain tests, just skip auto-refill
    }
  }

  return currentState;
}
