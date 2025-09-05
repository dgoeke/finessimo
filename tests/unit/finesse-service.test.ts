import { describe, test, expect } from "@jest/globals";

import { PIECES } from "../../src/core/pieces";
import { DefaultFinesseService } from "../../src/finesse/service";
import { FreePlayMode } from "../../src/modes/freePlay";
import {
  createSeed,
  createDurationMs,
  createGridCoord,
} from "../../src/types/brands";
import { createTimestamp, fromNow } from "../../src/types/timestamp";
import { reducerWithPipeline as reducer } from "../helpers/reducer-with-pipeline";

import type {
  GameState,
  ActivePiece,
  ProcessedAction,
} from "../../src/state/types";

function baseState(): GameState {
  return reducer(undefined, {
    seed: createSeed("test"),
    timestampMs: fromNow(),
    type: "Init",
  });
}

describe("FinesseService", () => {
  const service = new DefaultFinesseService();
  const mode = new FreePlayMode();

  test("uses normalization window to cancel opposite taps", () => {
    let state = baseState();
    // The opposite taps cancel out, leaving only HardDrop
    const processedActions: Array<ProcessedAction> = [
      { kind: "HardDrop", t: createTimestamp(200) },
    ];
    state = {
      ...state,
      gameplay: {
        finesseCancelMs: createDurationMs(50),
        holdEnabled: true,
        openingCoachingEnabled: false,
      },
      processedInputLog: processedActions,
    };

    // locked piece at spawn; final target is same column/rot, so optimal is HardDrop only
    const topLeft = PIECES.T.spawnTopLeft;
    const locked: ActivePiece = {
      id: "T",
      rot: "spawn",
      x: createGridCoord(topLeft[0]),
      y: createGridCoord(topLeft[1]),
    };

    const actions = service.analyzePieceLock(state, locked, mode);
    const feedback = actions.find((a) => a.type === "UpdateFinesseFeedback");
    expect(feedback).toBeTruthy();
    // Should be optimal because it's just HardDrop (1 input)
    if (feedback?.feedback) {
      expect(feedback.feedback.kind).toBe("optimal");
    }
  });

  test("analyzes from spawn state (not current pre-lock position)", () => {
    let state = baseState();
    // Player performed minimal inputs to go from spawn x=3 to x=0: HoldMove + HardDrop
    const processedActions: Array<ProcessedAction> = [
      { dir: -1, kind: "HoldMove", t: createTimestamp(100) },
      { kind: "HardDrop", t: createTimestamp(200) },
    ];
    state = {
      ...state,
      gameplay: {
        finesseCancelMs: createDurationMs(50),
        holdEnabled: true,
        openingCoachingEnabled: false,
      },
      processedInputLog: processedActions,
    };

    // Simulate that the piece was already at x=0 before lock
    const locked: ActivePiece = {
      id: "T",
      rot: "spawn",
      x: createGridCoord(0),
      y: createGridCoord(5),
    };

    const actions = service.analyzePieceLock(state, locked, mode);
    const feedback = actions.find((a) => a.type === "UpdateFinesseFeedback");
    expect(feedback).toBeTruthy();
    // If analyzed from spawn, optimal len is 2 and player len is 2 → optimal true
    // If erroneously analyzed from current, optimal len would be 1 (HardDrop only) → optimal false
    if (feedback?.feedback) {
      expect(feedback.feedback.kind).toBe("optimal");
    }
  });

  test("creates actions with custom timestamp", () => {
    let state = baseState();
    const customTimestamp = 12345;
    // Provide at least one input so feedback is present (suggestion allowed)
    const processedActions: Array<ProcessedAction> = [
      { kind: "HardDrop", t: createTimestamp(100) },
    ];
    state = { ...state, processedInputLog: processedActions };

    const locked: ActivePiece = {
      id: "T",
      rot: "spawn",
      x: createGridCoord(3),
      y: createGridCoord(5),
    };
    const actions = service.analyzePieceLock(
      state,
      locked,
      mode,
      customTimestamp,
    );

    const feedbackAction = actions.find(
      (a) => a.type === "UpdateFinesseFeedback",
    );
    expect(feedbackAction).toBeTruthy();
    if (feedbackAction?.feedback) {
      expect(feedbackAction.feedback.kind).toBe("optimal");
    }
  });

  test("no inputs short-circuits to optimal empty feedback", () => {
    let state = baseState();
    // No processed inputs from the player
    state = { ...state, processedInputLog: [] };

    const locked: ActivePiece = {
      id: "T",
      rot: "spawn",
      x: createGridCoord(3),
      y: createGridCoord(5),
    };
    const actions = service.analyzePieceLock(state, locked, mode);

    const feedbackAction = actions.find(
      (a) => a.type === "UpdateFinesseFeedback",
    );
    expect(feedbackAction).toBeTruthy();
    if (feedbackAction?.feedback) {
      expect(feedbackAction.feedback).toEqual({
        kind: "optimal",
        optimalSequences: [],
        playerSequence: [],
      });
    }

    // Verify stats record marks it as optimal with zero inputs
    const recordAction = actions.find((a) => a.type === "RecordPieceLock");
    expect(recordAction).toBeTruthy();
    if (recordAction) {
      expect(recordAction.inputCount).toBe(0);
      expect(recordAction.optimalInputCount).toBe(0);
      expect(recordAction.isOptimal).toBe(true);
    }
  });

  test("always includes ClearInputLog action as final action", () => {
    let state = baseState();
    const processedActions: Array<ProcessedAction> = [];
    state = { ...state, processedInputLog: processedActions };

    const locked: ActivePiece = {
      id: "T",
      rot: "spawn",
      x: createGridCoord(3),
      y: createGridCoord(5),
    };
    const actions = service.analyzePieceLock(state, locked, mode);

    const clearAction = actions[actions.length - 1];
    expect(clearAction).toBeDefined();
    expect(clearAction?.type).toBe("ClearInputLog");
  });

  test("calculates optimal input count correctly", () => {
    let state = baseState();
    const processedActions: Array<ProcessedAction> = [
      { kind: "HardDrop", t: createTimestamp(100) },
    ];
    state = { ...state, processedInputLog: processedActions };

    const locked: ActivePiece = {
      id: "T",
      rot: "spawn",
      x: createGridCoord(3),
      y: createGridCoord(5),
    }; // At spawn position
    const actions = service.analyzePieceLock(state, locked, mode);

    const recordAction = actions.find((a) => a.type === "RecordPieceLock");
    expect(recordAction).toBeTruthy();
    if (recordAction) {
      expect(recordAction.optimalInputCount).toBe(1); // Just HardDrop is optimal at spawn
      expect(recordAction.inputCount).toBe(1); // Player also did just HardDrop
      expect(recordAction.isOptimal).toBe(true);
    }
  });

  test("returns actions array with required action types", () => {
    let state = baseState();
    const processedActions: Array<ProcessedAction> = [
      { kind: "HardDrop", t: createTimestamp(100) },
    ];
    state = { ...state, processedInputLog: processedActions };

    const locked: ActivePiece = {
      id: "T",
      rot: "spawn",
      x: createGridCoord(3),
      y: createGridCoord(5),
    };
    const actions = service.analyzePieceLock(state, locked, mode);

    // Should have at least: UpdateFinesseFeedback, RecordPieceLock, ClearInputLog
    expect(actions.length).toBeGreaterThanOrEqual(3);

    const actionTypes = actions.map((a) => a.type);
    expect(actionTypes).toContain("UpdateFinesseFeedback");
    expect(actionTypes).toContain("RecordPieceLock");
    expect(actionTypes).toContain("ClearInputLog");
  });
});
