import { selectDerivedOverlays } from "../../../../engine/selectors/overlays";
import { gridCoordAsNumber } from "../../../../types/brands";
import { mapGameStateToViewModel } from "../../presenter/viewModel";

import { drawUiEffects } from "./effects";
import { updateHoldPreview, updateNextPreviews } from "./previews";
import { hexToNumber } from "./utils";

import type { SceneCtx } from "./types";
import type { RenderOverlay } from "../../../../engine/ui/overlays";

export function updatePresentation(ctx: SceneCtx): void {
  const vm = mapGameStateToViewModel(ctx.state);
  const plan = ctx.presenter.computePlan(ctx.vmPrev, vm);
  ctx.presenter.apply(plan);
  ctx.vmPrev = vm;

  updateNextPreviews(ctx.nextPreviewContainers, ctx.state.nextQueue);
  updateHoldPreview(ctx.holdContainer, ctx.state.hold ?? null);

  drawOverlays(ctx);
  drawUiEffects(ctx);
}

export function drawOverlays(ctx: SceneCtx): void {
  const overlays: ReadonlyArray<RenderOverlay> = selectDerivedOverlays(
    ctx.state,
  );
  ctx.overlayColumns?.clear();
  ctx.overlayTargets?.clear();

  drawColumnHighlights(ctx, overlays);
  drawTargets(ctx, overlays);
}

export function drawColumnHighlights(
  ctx: SceneCtx,
  overlays: ReadonlyArray<RenderOverlay>,
): void {
  const g = ctx.overlayColumns;
  if (!g) return;
  for (const ov of overlays) {
    if (ov.kind !== "column-highlight") continue;
    const colorStr = ov.color ?? "#ffffff";
    const color = hexToNumber(colorStr);
    const alpha = ov.intensity ?? 0.08;
    g.fillStyle(color, alpha);
    for (const col of ov.columns) {
      const x = ctx.originX + col * ctx.tileSize;
      const y = ctx.originY;
      g.fillRect(x, y, ctx.tileSize, ctx.boardHeightPx);
    }
  }
}

export function drawTargets(
  ctx: SceneCtx,
  overlays: ReadonlyArray<RenderOverlay>,
): void {
  const g = ctx.overlayTargets;
  if (!g) return;
  for (const ov of overlays) {
    if (ov.kind !== "target") continue;
    const color = hexToNumber(ov.color ?? "#60a5fa");
    const alpha = ov.alpha ?? 0.6;
    g.lineStyle(2, color, alpha);
    for (const [cx, cy] of ov.cells) {
      const x = ctx.originX + gridCoordAsNumber(cx) * ctx.tileSize;
      const y = ctx.originY + gridCoordAsNumber(cy) * ctx.tileSize;
      g.strokeRect(x, y, ctx.tileSize, ctx.tileSize);
    }
  }
}
