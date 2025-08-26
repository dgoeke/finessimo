import { signal } from "@lit-labs/signals";

import { reducer } from "./reducer";

import type { Action, GameState } from "./types";

// Global reactive state signal for Lit components
export const gameStateSignal = signal<GameState>(
  undefined as unknown as GameState,
);

/**
 * Dispatch an action through the reducer and update the signal
 * This maintains the pure functional approach while providing reactive updates
 */
export function dispatch(action: Action): void {
  const prevState = gameStateSignal.get();
  const newState = reducer(prevState, action);
  gameStateSignal.set(newState);
}

/**
 * Helper function to get current state without subscribing to changes
 * Useful for one-time reads where reactivity is not needed
 */
export function getCurrentState(): GameState {
  return gameStateSignal.get();
}

/**
 * Helper functions for subscribing to specific state slices
 * These will be useful when components need to react only to specific changes
 */
export const stateSelectors = {
  /** Select board and active piece for game board rendering */
  getBoardState: (
    state: GameState,
  ): {
    active: GameState["active"];
    board: GameState["board"];
    tick: GameState["tick"];
  } => ({
    active: state.active,
    board: state.board,
    tick: state.tick,
  }),

  /** Select finesse-related state for overlay components */
  getFinesseState: (
    state: GameState,
  ): {
    finesseFeedback: GameState["finesseFeedback"];
    guidance: GameState["guidance"];
    modePrompt: GameState["modePrompt"];
  } => ({
    finesseFeedback: state.finesseFeedback,
    guidance: state.guidance,
    modePrompt: state.modePrompt,
  }),

  /** Select hold piece state */
  getHoldState: (
    state: GameState,
  ): { canHold: GameState["canHold"]; hold: GameState["hold"] } => ({
    canHold: state.canHold,
    hold: state.hold,
  }),

  /** Select preview queue state */
  getPreviewState: (
    state: GameState,
  ): {
    nextPieceCount: GameState["gameplay"]["nextPieceCount"];
    nextQueue: GameState["nextQueue"];
  } => ({
    nextPieceCount: state.gameplay.nextPieceCount,
    nextQueue: state.nextQueue,
  }),

  /** Select statistics state */
  getStatsState: (
    state: GameState,
  ): { mode: GameState["currentMode"]; stats: GameState["stats"] } => ({
    mode: state.currentMode,
    stats: state.stats,
  }),
};
