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
import type {
  GameState,
  Action,
  PendingLock,
  ActivePiece,
} from "../state/types";
import type { Timestamp } from "../types/timestamp";

export type PipelineAnalyzer = (state: GameState) => {
  result: FinesseResult;
  actions: Array<Action>;
};

/**
 * Main pipeline runner - processes pending lock resolution
 * This is called from the app loop when state.status === 'resolvingLock'
 */
function dispatchMany(
  dispatch: (action: Action) => void,
  actions: ReadonlyArray<Action>,
): void {
  for (const a of actions) dispatch(a);
}

function buildLockedPieceForHook(p: PendingLock): ActivePiece {
  return {
    id: p.pieceId,
    rot: p.finalPos.rot,
    x: p.finalPos.x,
    y: p.finalPos.y,
  };
}

function handleCommit(
  dispatch: (action: Action) => void,
  decision: ResolveLockDecision,
  modeResult?: { postActions?: ReadonlyArray<Action> },
): ResolveLockDecision {
  dispatch({ type: "CommitLock" });
  // Note: CommitLock's applyPendingLock already handles zero-delay line clears
  type CommitDecision = Extract<ResolveLockDecision, { action: "commit" }>;
  const commitDecision = decision as CommitDecision;
  if (commitDecision.postActions && commitDecision.postActions.length > 0) {
    dispatchMany(dispatch, commitDecision.postActions);
  }
  // Emit mode-provided postActions (e.g., feedback effect) AFTER reset/commit for desired timing
  if (modeResult?.postActions && modeResult.postActions.length > 0) {
    dispatchMany(dispatch, modeResult.postActions);
  }
  return decision;
}

export const runLockPipeline = (
  state: GameState,
  dispatch: (action: Action) => void,
  analyzeFinesse: PipelineAnalyzer,
  timestampMs: Timestamp,
): { decision: ResolveLockDecision } => {
  if (state.status !== "resolvingLock") {
    return { decision: { action: "commit" } }; // No-op; default commit
  }

  const pending = state.pendingLock;

  // Step 1: Run finesse analysis
  const { actions: finesseActions, result: finesse } = analyzeFinesse(state);

  // Step 2: Dispatch finesse feedback actions (includes ClearInputLog as final action)
  dispatchMany(dispatch, finesseActions);

  // Step 3: Let the mode react to the piece lock (rating, feedback, persistence)
  const mode = gameModeRegistry.get(state.currentMode);
  if (!mode) {
    // Mode not found, default to commit (maintains game flow)
    dispatch({ type: "CommitLock" });
    return { decision: { action: "commit" } };
  }

  // Build a best-effort locked piece for the hook; mode typically checks id only
  const lockedPieceForHook = buildLockedPieceForHook(pending);

  const modeHasOnPieceLocked =
    typeof (mode as { onPieceLocked?: unknown }).onPieceLocked === "function";
  const modeResult = modeHasOnPieceLocked
    ? (mode as Required<Pick<typeof mode, "onPieceLocked">>).onPieceLocked(
        state,
        finesse,
        lockedPieceForHook,
        pending.finalPos,
      )
    : undefined;

  // Apply mode-provided modeData updates immediately (e.g., Guided deck advancement)
  if (modeResult?.modeData !== undefined) {
    dispatch({ data: modeResult.modeData, type: "UpdateModeData" });
  }

  const decision =
    typeof (mode as { onResolveLock?: unknown }).onResolveLock === "function"
      ? (mode as Required<Pick<typeof mode, "onResolveLock">>).onResolveLock({
          finesse,
          pending,
          state,
        })
      : ({ action: "commit" } as const);

  // Step 4: Execute decision
  if (decision.action === "retry") {
    dispatch({ timestampMs, type: "RetryPendingLock" });
    return { decision };
  }

  const finalDecision = handleCommit(dispatch, decision, modeResult);
  return { decision: finalDecision };
};
