import {
  createPercentage,
  createUnbrandedMs,
  createDurationMs,
} from "../../../../types/brands";
import { mapOption } from "../../../../types/option";
import { createTimestamp } from "../../../../types/timestamp";
import { ms as unbrandMs } from "../../utils/unbrand";

import { processInputActions } from "./input";
import { processActionWithLockPipeline } from "./lockPipeline";
import { updateModeUi } from "./mode";
import { updatePresentation } from "./presentation";
import { shouldCompleteLineClear } from "./utils";

import type { SceneCtx } from "./types";
import type { Action, GameState } from "../../../../state/types";
import type { Option } from "../../../../types/option";
import type { ResultsSummary } from "../Results";

export function processFixedTimeStep(ctx: SceneCtx): void {
  // Input → actions (includes DAS) and Tick
  processInputActions(ctx);
  processTickAction(ctx);

  if (handleAutoRestartIfTopOut(ctx)) return;

  updateModeUi(ctx);
  updatePresentation(ctx);
  handleAutoSpawn(ctx);
}

export function processTickAction(ctx: SceneCtx): void {
  ctx.clock.tick(ctx.fixedDt);
  const currentTime = unbrandMs(ctx.clock.nowMs());

  // Always dispatch Tick via reducer+pipeline for deterministic physics/LD
  const withTick = processActionWithLockPipeline(ctx, ctx.state, {
    timestampMs: createTimestamp(currentTime),
    type: "Tick",
  } satisfies Action);
  ctx.setState(withTick);
  ctx.state = withTick;

  if (shouldCompleteLineClear(withTick, currentTime)) {
    const afterClear = processActionWithLockPipeline(ctx, withTick, {
      type: "CompleteLineClear",
    } satisfies Action);
    ctx.setState(afterClear);
    ctx.state = afterClear;
  }
}

export function handleAutoRestartIfTopOut(_ctx: SceneCtx): boolean {
  // For now, we handle auto-restart in loop but the scene will transition to Results
  // The actual transition is handled by checkGameOverState in the Gameplay scene
  return false;
}

export function handleTopOutTransition(ctx: SceneCtx): boolean {
  // Allow the scene to handle the transition to Results
  // This function can be used to determine if we should transition
  return ctx.state.status === "topOut";
}

export function handleAutoSpawn(ctx: SceneCtx): void {
  const s = ctx.state;
  if (s.status !== "playing") return;
  if (s.active) return;
  ctx.spawnNextPiece();
}

export function computeResultsSummary(
  state: Option<GameState>,
): ResultsSummary {
  return mapOption(
    state,
    (s) => ({
      accuracyPercentage: createPercentage(
        Math.round(s.stats.accuracyPercentage),
      ),
      linesCleared: s.stats.linesCleared,
      piecesPlaced: s.stats.piecesPlaced,
      timePlayedMs: createUnbrandedMs(s.stats.timePlayedMs),
    }),
    {
      accuracyPercentage: createPercentage(0),
      linesCleared: 0,
      piecesPlaced: 0,
      timePlayedMs: createUnbrandedMs(createDurationMs(0)),
    },
  );
}
