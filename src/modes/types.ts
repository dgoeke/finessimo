import type { GameState } from "../state/types";
import type { GridCoord } from "../types/brands";

/**
 * Target cell data for mode UI adapters.
 * Represents a single target cell coordinate on the game board.
 */
export type TargetCell = {
  readonly x: GridCoord;
  readonly y: GridCoord;
};

/**
 * Extended mode data that can be populated by UI adapters.
 * This extends the base modeData with standardized UI fields.
 */
export type ExtendedModeData = {
  /**
   * Target cells to be highlighted on the game board.
   * Each array represents a target pattern (e.g., piece placement).
   * Multiple patterns can be displayed simultaneously.
   */
  readonly targets?: ReadonlyArray<ReadonlyArray<TargetCell>>;
};

/**
 * Mode UI Adapter interface for declarative UI data provision.
 *
 * Allows game modes to provide UI data declaratively instead of imperatively.
 * UI adapters compute derived data from game state and populate standardized
 * fields in modeData that can be consumed by selectors.
 *
 * This pattern moves UI logic from imperative "draw this now" calls to
 * declarative "here's the data to render" state population.
 */
export type ModeUiAdapter = {
  /**
   * Compute derived UI data from game state.
   *
   * This method should be pure - no side effects, no dispatch calls.
   * It transforms game state into UI-specific data that gets merged
   * into state.modeData for consumption by UI selectors.
   *
   * @param state - Current game state
   * @returns Partial modeData to merge, or null if no UI updates needed
   */
  computeDerivedUi(state: GameState): Partial<ExtendedModeData> | null;
};
