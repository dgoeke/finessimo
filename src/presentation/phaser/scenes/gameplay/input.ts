import {
  createProcessedHardDrop,
  createProcessedHoldMove,
  createProcessedRotate,
  createProcessedSoftDrop,
  createProcessedTapMove,
} from "../../../../finesse/log";

import { processActionWithLockPipeline } from "./lockPipeline";

import type { SceneCtx } from "./types";
import type { DASEvent } from "../../../../input/machines/das";
import type { Action } from "../../../../state/types";
import type { InputEvent } from "../../input/PhaserInputAdapter";

export function isDasEvent(e: InputEvent): e is DASEvent {
  return (
    e.type === "KEY_DOWN" ||
    e.type === "KEY_UP" ||
    e.type === "TIMER_TICK" ||
    e.type === "UPDATE_CONFIG"
  );
}

export function isTapMove(
  a: Action,
): a is Extract<Action, { type: "TapMove" }> {
  return a.type === "TapMove";
}

export function processInputActions(ctx: SceneCtx): void {
  const { fixedDt, input } = ctx;
  const events = input.drainEvents(fixedDt);
  const actions: Array<Action> = [];
  for (const e of events) {
    if (isDasEvent(e)) {
      actions.push(...processDasEvent(ctx, e));
    } else {
      actions.push(e);
    }
  }
  for (const a of actions) {
    const pair = withProcessedIfNeeded(ctx, a);
    for (const step of pair) {
      const next = processActionWithLockPipeline(ctx, ctx.state, step);
      ctx.setState(next);
      ctx.state = next;
    }
  }
}

export function processDasEvent(ctx: SceneCtx, e: DASEvent): Array<Action> {
  const out: Array<Action> = [];
  if (e.type === "KEY_DOWN") {
    const ctxDir = ctx.das.getState().context.direction;
    if (ctxDir !== undefined && ctxDir !== e.direction) {
      const upActions = ctx.das.send({
        direction: ctxDir,
        timestamp: e.timestamp,
        type: "KEY_UP",
      });
      out.push(...upActions);
    }
  }
  const dasActions = ctx.das.send(e);
  for (const a of dasActions) {
    if (isTapMove(a) && a.optimistic) {
      ctx.setPendingTap({ dir: a.dir, t: a.timestampMs });
    }
    if (a.type === "HoldStart") ctx.setPendingTap(null);
  }
  if (e.type === "KEY_UP") {
    const p = ctx.pendingTap;
    if (p !== null && p.dir === e.direction) {
      const entry = createProcessedTapMove(p.dir, p.t);
      out.push({ entry, type: "AppendProcessed" });
      ctx.setPendingTap(null);
    }
  }
  out.push(...dasActions);
  return out;
}

function withProcessedIfNeeded(
  ctx: SceneCtx,
  action: Action,
): ReadonlyArray<Action> {
  const s = ctx.state;
  if (s.status !== "playing" || !s.active) {
    return [action];
  }
  if (action.type === "TapMove") {
    if (action.optimistic) return [action];
    const entry = createProcessedTapMove(action.dir, action.timestampMs);
    return [{ entry, type: "AppendProcessed" }, action];
  }
  if (action.type === "HoldStart") {
    const entry = createProcessedHoldMove(action.dir, action.timestampMs);
    return [{ entry, type: "AppendProcessed" }, action];
  }
  if (action.type === "Rotate") {
    const entry = createProcessedRotate(action.dir, action.timestampMs);
    return [{ entry, type: "AppendProcessed" }, action];
  }
  if (action.type === "HardDrop") {
    const entry = createProcessedHardDrop(action.timestampMs);
    return [{ entry, type: "AppendProcessed" }, action];
  }
  if (action.type === "SoftDrop") {
    if (action.on === ctx.softDropOn) return [action];
    ctx.setSoftDropOn(action.on);
    const entry = createProcessedSoftDrop(action.on, action.timestampMs);
    return [{ entry, type: "AppendProcessed" }, action];
  }
  return [action];
}
