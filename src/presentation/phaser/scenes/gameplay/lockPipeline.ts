import { finesseService } from "../../../../finesse/service";
import { gameModeRegistry } from "../../../../modes";
import { runLockPipeline } from "../../../../modes/lock-pipeline";
import { planPreviewRefill } from "../../../../modes/spawn-service";
import { fromNow } from "../../../../types/timestamp";

import type { SceneCtx } from "./types";
import type { FinesseResult } from "../../../../finesse/calculator";
import type { GameState, Action } from "../../../../state/types";

export function processActionWithLockPipeline(
  ctx: SceneCtx,
  state: GameState,
  action: Action,
): GameState {
  const prevQueueLen = state.nextQueue.length;
  let newState = ctx.reduce(state, action);

  if (
    newState.status === "resolvingLock" &&
    action.type !== "CommitLock" &&
    action.type !== "RetryPendingLock"
  ) {
    runLockPipeline(
      newState,
      (pipelineAction) => {
        newState = ctx.reduce(newState, pipelineAction);
      },
      createFinesseAnalyzer(ctx),
      fromNow(),
    );
  }

  if (newState.nextQueue.length < prevQueueLen) {
    newState = ensurePreviewFilled(ctx, newState);
  }

  return newState;
}

export function createFinesseAnalyzer(
  ctx: SceneCtx,
): (state: GameState) => { result: FinesseResult; actions: Array<Action> } {
  ctx.clock.nowMs();
  const isFinesseUpdateAction = (
    action: Action,
  ): action is Extract<Action, { type: "UpdateFinesseFeedback" }> => {
    return action.type === "UpdateFinesseFeedback";
  };

  return (state: GameState) => {
    const currentMode = gameModeRegistry.get(state.currentMode);
    if (!currentMode || !state.pendingLock) {
      return {
        actions: [],
        result: {
          kind: "optimal",
          optimalSequences: [],
          playerSequence: [],
        },
      };
    }

    const activePiece = state.pendingLock.finalPos;
    const actions = finesseService.analyzePieceLock(
      state,
      activePiece,
      currentMode,
      state.pendingLock.timestampMs,
    );

    const finesseUpdateAction = actions.find(isFinesseUpdateAction);
    const result: FinesseResult = finesseUpdateAction?.feedback ?? {
      kind: "optimal",
      optimalSequences: [],
      playerSequence: [],
    };

    return { actions, result };
  };
}

function ensurePreviewFilled(ctx: SceneCtx, state: GameState): GameState {
  const mode = gameModeRegistry.get(state.currentMode);
  const desired = Math.max(5, state.gameplay.nextPieceCount ?? 5);
  const refill = planPreviewRefill(state, mode, desired);
  if (!refill || refill.pieces.length === 0) return state;

  const refillAction = {
    pieces: refill.pieces,
    rng: refill.newRng,
    type: "RefillPreview" as const,
  };

  const reduced = ctx.reduce(state, refillAction);
  ctx.safeDispatch(refillAction);
  return reduced;
}
