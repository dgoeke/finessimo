/**
 * Board Render Frame Type
 *
 * Unified data structure containing all information needed for a single
 * board rendering frame. Used to decouple render modules from the Lit component
 * and provide a clean interface for pure render functions.
 */

import type { BoardViewport } from "./brands-render";
import type { RenderOverlay } from "../../engine/ui/overlays";
import type { GameState, Board } from "../../state/types";

/**
 * Complete frame data for board rendering operations.
 *
 * This immutable structure contains all state needed to render a complete
 * board frame including the board state, active piece, overlays, and viewport
 * configuration.
 *
 * Design notes:
 * - All properties are readonly to prevent accidental mutation
 * - Used across all render modules to avoid coupling to Lit component
 * - Viewport provides branded coordinate conversion context
 */
export type BoardRenderFrame = Readonly<{
  board: Board;
  active: GameState["active"]; // ActivePiece | null
  tick: GameState["tick"];
  overlays: ReadonlyArray<RenderOverlay>;
  viewport: BoardViewport;
}>;
