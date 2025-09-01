import type { ViewModel } from "./types";
import type { GameState } from "../../../state/types";

// Phase 0: Expose the pure mapping signature; implemented in Phase 2
export function mapGameStateToViewModel(_s: Readonly<GameState>): ViewModel {
  // Placeholder to satisfy signature in early phase
  // Will be implemented with a pure projection in Phase 2
  throw new Error("mapGameStateToViewModel is not implemented in Phase 0");
}
