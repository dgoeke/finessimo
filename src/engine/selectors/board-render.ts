import { sortOverlaysByZOrder } from "../ui/overlays";

import { selectEffectOverlays } from "./effects-to-overlays";
import { selectDerivedOverlays } from "./overlays";

import type { GameState } from "../../state/types";
import type { RenderOverlay } from "../ui/overlays";

/**
 * Board render model combining all overlay sources into final render data.
 *
 * This provides the complete data structure needed by the game board renderer,
 * combining derived overlays (ghost, targets) with effect overlays in correct z-order.
 */

/**
 * Complete render model for the game board component.
 */
export type BoardRenderModel = Readonly<{
  /** All overlays sorted by z-order for correct layering */
  overlays: ReadonlyArray<RenderOverlay>;
}>;

/**
 * Selects the complete board render model from game state.
 *
 * This is the main entry point for the game board component to get all
 * overlay data needed for rendering. All overlays are combined and sorted
 * by z-order for proper layering.
 */
export function selectBoardRenderModel(s: GameState): BoardRenderModel {
  const overlays: Array<RenderOverlay> = [];

  // Add derived overlays (ghost, targets from game state)
  const derivedOverlays = selectDerivedOverlays(s);
  overlays.push(...derivedOverlays);

  // Add effect-based overlays (from UI effects system)
  const effectOverlays = selectEffectOverlays(s);
  overlays.push(...effectOverlays);

  // Sort all overlays by z-order for correct rendering
  const sortedOverlays = sortOverlaysByZOrder(overlays);

  return {
    overlays: sortedOverlays,
  } as const;
}
