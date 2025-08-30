import { assertNever } from "../../state/types";

import type { GameState, UiEffect } from "../../state/types";
import type {
  RenderOverlay,
  EffectDotOverlay,
  LineFlashOverlay,
} from "../ui/overlays";

/**
 * Maps UI effects to overlay representations for unified rendering.
 *
 * This bridges the existing UiEffects system with the new overlay architecture.
 * Effects are event-based, TTL-managed overlays that originate from game events.
 */

/**
 * Converts active UI effects to overlay representations.
 *
 * This function maps UI effects from the effects system into overlay types
 * for unified rendering. Uses exhaustive switch for type safety.
 */
export function selectEffectOverlays(
  s: GameState,
): ReadonlyArray<RenderOverlay> {
  const overlays: Array<RenderOverlay> = [];

  for (const effect of s.uiEffects) {
    const overlay = convertEffectToOverlay(effect);
    if (overlay) {
      overlays.push(overlay);
    }
  }

  return overlays;
}

/**
 * Converts a single UI effect to its corresponding overlay representation.
 * Returns null for effects that don't generate overlays (like FloatingTextEffect).
 */
function convertEffectToOverlay(effect: UiEffect): RenderOverlay | null {
  switch (effect.kind) {
    case "floatingText":
      // FloatingTextEffect is handled by a separate dedicated component
      // that reads directly from uiEffects. No RenderOverlay needed.
      return null;

    case "lineFlash": {
      const lineFlashOverlay: LineFlashOverlay = {
        kind: "line-flash",
        rows: effect.rows,
        z: 4, // Z.effect
        ...(effect.color !== undefined && { color: effect.color }),
        ...(effect.intensity !== undefined && { intensity: effect.intensity }),
      } as const;
      return lineFlashOverlay;
    }

    case "finesseBoop": {
      const effectDotOverlay: EffectDotOverlay = {
        at: [effect.gridX, effect.gridY] as const,
        kind: "effect-dot",
        style: effect.style,
        z: 4, // Z.effect
        ...(effect.color !== undefined && { color: effect.color }),
        ...(effect.size !== undefined && { size: effect.size }),
      } as const;
      return effectDotOverlay;
    }

    default:
      return assertNever(effect);
  }
}
