import { signal } from "@lit-labs/signals";

import { reducer } from "./reducer";

import type { Action, GameState } from "./types";

// Single source of truth for UI reactivity; avoids prop drilling and manual subscriptions
export const gameStateSignal = signal<GameState>(
  undefined as unknown as GameState,
);

/**
 * Dispatch via pure reducer, then publish the new state.
 * Keeps core logic pure while letting Lit react to changes efficiently.
 */
export function dispatch(action: Action): void {
  const prevState = gameStateSignal.get();
  const newState = reducer(prevState, action);
  gameStateSignal.set(newState);
}

/**
 * One-time read of the current state without subscribing.
 */
export function getCurrentState(): GameState {
  return gameStateSignal.get();
}

/**
 * Selector helpers for components to depend on minimal slices of state.
 * Reduces unnecessary re-renders and clarifies intent at call sites.
 */
export const stateSelectors = {
  /** Select board and active piece for game board rendering */
  getBoardState: (
    state: GameState,
  ): {
    active: GameState["active"];
    board: GameState["board"];
    boardDecorations: GameState["boardDecorations"];
    tick: GameState["tick"];
  } => ({
    active: state.active,
    board: state.board,
    boardDecorations: state.boardDecorations,
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
