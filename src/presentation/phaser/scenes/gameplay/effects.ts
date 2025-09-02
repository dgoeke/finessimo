import {
  durationMsAsNumber,
  uiEffectIdAsNumber,
} from "../../../../types/brands";
import { ms as unbrandMs } from "../../utils/unbrand";

import type { SceneCtx } from "./types";
import type { GameState } from "../../../../state/types";

export function drawUiEffects(ctx: SceneCtx): void {
  const now = unbrandMs(ctx.clock.nowMs());
  const seen = new Set<number>();
  for (const effect of ctx.state.uiEffects) {
    if (effect.kind !== "floatingText") continue;
    renderFloatingText(ctx, effect, now, seen);
  }
  for (const [id, obj] of ctx.effectsTexts) {
    if (!seen.has(id)) {
      obj.destroy();
      ctx.effectsTexts.delete(id);
      ctx.effectsStart.delete(id);
    }
  }
}

export function renderFloatingText(
  ctx: SceneCtx,
  effect: Extract<GameState["uiEffects"][number], { kind: "floatingText" }>,
  now: number,
  seen: Set<number>,
): void {
  const id = uiEffectIdAsNumber(effect.id);
  seen.add(id);
  if (!ctx.effectsStart.has(id)) ctx.effectsStart.set(id, now);
  const start = ctx.effectsStart.get(id) ?? now;
  let ttl = durationMsAsNumber(effect.ttlMs);
  if (ttl <= 0) ttl = 1;
  const p = Math.max(0, Math.min(1, (now - start) / ttl));
  const alpha = 1 - p;
  const scaleFrom = effect.scaleFrom ?? 1;
  const scaleTo = effect.scaleTo ?? 1;
  const scale = scaleFrom + (scaleTo - scaleFrom) * p;
  const t = ensureEffectText(ctx, {
    color: effect.color,
    fontPx: effect.fontPx,
    id,
    text: effect.text,
    ...(effect.fontWeight !== undefined
      ? ({ fontWeight: effect.fontWeight } as const)
      : {}),
  });
  const pos = computeEffectBoardPos(ctx, {
    anchor: effect.anchor,
    driftYPx: effect.driftYPx,
    offX: effect.offsetX,
    offY: effect.offsetY,
    p,
  });
  t.setOrigin(pos.ox, pos.oy);
  t.setPosition(pos.x, pos.y);
  t.setAlpha(alpha);
  t.setScale(scale);
}

function ensureEffectText(
  ctx: SceneCtx,
  spec: {
    id: number;
    text: string;
    color: string;
    fontPx: number;
    fontWeight?: number | string;
  },
): Phaser.GameObjects.Text {
  let t = ctx.effectsTexts.get(spec.id);
  if (t) return t;
  t = ctx.scene.add.text(0, 0, spec.text, {
    color: spec.color,
    fontFamily: "monospace",
    fontSize: `${String(spec.fontPx)}px`,
    ...(spec.fontWeight !== undefined ? ({ fontStyle: "bold" } as const) : {}),
  });
  t.setDepth(1000);
  t.setScrollFactor(1);
  ctx.effectsTexts.set(spec.id, t);
  return t;
}

function computeEffectBoardPos(
  ctx: SceneCtx,
  spec: {
    anchor: "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
    offX: number;
    offY: number;
    driftYPx: number;
    p: number;
  },
): { x: number; y: number; ox: number; oy: number } {
  const drift = spec.driftYPx;
  const boardW = 10 * ctx.tileSize;
  const boardH = ctx.boardHeightPx;
  const x0 = ctx.originX;
  const y0 = ctx.originY;
  const mx = Math.max(0, Math.floor(ctx.tileSize * 0.5));
  const my = Math.max(0, Math.floor(ctx.tileSize * 0.5));
  switch (spec.anchor) {
    case "topLeft":
      return {
        ox: 0,
        oy: 0,
        x: x0 + mx + spec.offX,
        y: y0 + my + spec.offY - drift * spec.p,
      };
    case "topRight":
      return {
        ox: 1,
        oy: 0,
        x: x0 + boardW - mx - spec.offX,
        y: y0 + my + spec.offY - drift * spec.p,
      };
    case "bottomLeft":
      return {
        ox: 0,
        oy: 1,
        x: x0 + mx + spec.offX,
        y: y0 + boardH - my - spec.offY - drift * spec.p,
      };
    case "bottomRight":
    default:
      return {
        ox: 1,
        oy: 1,
        x: x0 + boardW - mx - spec.offX,
        y: y0 + boardH - my - spec.offY - drift * spec.p,
      };
  }
}
