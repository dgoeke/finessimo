import type { GameState } from "../../state/types";
import type { RenderOverlay } from "../ui/overlays";

/**
 * Maps UI effects to overlay representations for unified rendering.
 *
 * This bridges the existing UiEffects system with the new overlay architecture.
 * Effects are event-based, TTL-managed overlays that originate from game events.
 */

/**
 * Converts active UI effects to overlay representations.
 * Currently only handles FloatingTextEffect, which maps to no overlays
 * (floating text is handled by a separate dedicated component).
 *
 * Future effect types like "sparkle", "pulse", "line-flash" will be converted
 * to their corresponding overlay types here.
 */
export function selectEffectOverlays(
  s: GameState,
): ReadonlyArray<RenderOverlay> {
  const overlays: Array<RenderOverlay> = [];

  for (const effect of s.uiEffects) {
    // Currently only FloatingTextEffect exists in the UiEffect union
    // FloatingTextEffect is handled by a separate overlay component
    // that reads directly from uiEffects. No conversion to RenderOverlay needed.
    // Future: this might become a dedicated EffectTextOverlay type

    // When additional effect types are added to the UiEffect union,
    // add cases here to convert them to RenderOverlay types:
    // - "sparkle" -> EffectDotOverlay
    // - "lineClear" -> LineFlashOverlay
    // - etc.

    // For now, no overlays are generated from effects
    void effect; // Acknowledge the effect parameter
  }

  return overlays;
}
