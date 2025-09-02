import { createTimestamp, fromNow } from "../../../../types/timestamp";
import { ms as unbrandMs } from "../../utils/unbrand";

import { processInputActions } from "./input";
import { processActionWithLockPipeline } from "./lockPipeline";
import { updateModeUi } from "./mode";
import { updatePresentation } from "./presentation";
import { shouldCompleteLineClear } from "./utils";

import type { SceneCtx } from "./types";
import type { Action } from "../../../../state/types";

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

export function handleAutoRestartIfTopOut(ctx: SceneCtx): boolean {
  const s = ctx.state;
  if (s.status !== "topOut") return false;
  const { currentMode, gameplay, timing } = s;
  const seed = ctx.randomSeed();

  const init: Action = {
    gameplay,
    mode: currentMode,
    retainStats: true,
    seed,
    timestampMs: fromNow(),
    timing,
    type: "Init",
  };
  const next = ctx.reduce(s, init);
  ctx.setState(next);
  ctx.safeDispatch(init);
  ctx.spawnNextPiece();
  return true;
}

export function handleAutoSpawn(ctx: SceneCtx): void {
  const s = ctx.state;
  if (s.status !== "playing") return;
  if (s.active) return;
  ctx.spawnNextPiece();
}
