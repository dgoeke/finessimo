/**
 * Lock pipeline coordinator.
 *
 * Coordinates finesse analysis, mode-driven retry decisions, and final
 * commit/retry actions when a pending lock is staged.
 *
 * Flow:
 * 1) Run finesse analysis and dispatch feedback/stat actions.
 * 2) Ask the active mode for a commit vs. retry decision.
 * 3) Dispatch CommitLock or RetryPendingLock accordingly.
 * 4) Reducer handles zero-delay line clear paths deterministically.
 *
 * Pure module: reads GameState, uses finesse service and mode hooks, and
 * emits reducer actions via dispatch.
 */

import { gameModeRegistry } from "./index";

import type { ResolveLockDecision } from "./index";
import type { FinesseResult } from "../finesse/calculator";
import type { GameState, Action } from "../state/types";

export type PipelineAnalyzer = (state: GameState) => {
  result: FinesseResult;
  actions: Array<Action>;
};

/**
 * Main pipeline runner - processes pending lock resolution
 * This is called from the app loop when state.status === 'resolvingLock'
 */
export const runLockPipeline = (
  state: GameState,
  dispatch: (action: Action) => void,
  analyzeFinesse: PipelineAnalyzer,
): { decision: ResolveLockDecision } => {
  if (state.status !== "resolvingLock") {
    return { decision: { action: "commit" } }; // No-op; default commit
  }

  const pending = state.pendingLock;

  // Step 1: Run finesse analysis
  const { actions: finesseActions, result: finesse } = analyzeFinesse(state);

  // Step 2: Dispatch finesse feedback actions (includes ClearInputLog as final action)
  for (const action of finesseActions) {
    dispatch(action);
  }

  // Step 3: Get mode decision
  const mode = gameModeRegistry.get(state.currentMode);
  if (!mode) {
    // Mode not found, default to commit (maintains game flow)
    dispatch({ type: "CommitLock" });
    return { decision: { action: "commit" } };
  }

  const decision = mode.onResolveLock
    ? mode.onResolveLock({ finesse, pending, state })
    : { action: "commit" as const };

  // Step 4: Execute decision
  if (decision.action === "retry") {
    dispatch({ type: "RetryPendingLock" });
    return { decision };
  } else {
    dispatch({ type: "CommitLock" });
    // Note: CommitLock's applyPendingLock already handles zero-delay line clears
    if (decision.postActions && decision.postActions.length > 0) {
      for (const a of decision.postActions) dispatch(a);
    }
    return { decision };
  }
};
