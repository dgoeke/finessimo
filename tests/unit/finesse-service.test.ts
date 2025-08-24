import { describe, test, expect } from "@jest/globals";
import { DefaultFinesseService } from "../../src/finesse/service";
import { FreePlayMode } from "../../src/modes/freePlay";
import { reducer } from "../../src/state/reducer";
import type { GameState, ActivePiece, InputEvent } from "../../src/state/types";
import { PIECES } from "../../src/core/pieces";
import { ProcessedAction } from "../../src/input/handler";
import { createTimestamp } from "../../src/types/timestamp";

function baseState(): GameState {
  return reducer(undefined, { type: "Init" });
}

describe("FinesseService", () => {
  const service = new DefaultFinesseService();
  const mode = new FreePlayMode();

  test("uses normalization window to cancel opposite taps", () => {
    let state = baseState();
    const events: InputEvent[] = [
      { tMs: 100, frame: 6, action: "LeftDown" },
      { tMs: 130, frame: 8, action: "RightDown" }, // within 50ms → cancel
      { tMs: 200, frame: 12, action: "HardDrop" },
    ];
    // The opposite taps cancel out, leaving only HardDrop
    const processedActions: ProcessedAction[] = [
      {
        action: { type: "HardDrop", timestampMs: createTimestamp(200) },
        timestamp: 200,
      },
    ];
    state = {
      ...state,
      inputLog: events,
      processedInputLog: processedActions,
      gameplay: { finesseCancelMs: 50 },
    };

    // locked piece at spawn; final target is same column/rot, so optimal is HardDrop only
    const topLeft = PIECES.T.spawnTopLeft;
    const locked: ActivePiece = {
      id: "T",
      rot: "spawn",
      x: topLeft[0],
      y: topLeft[1],
    };

    const actions = service.analyzePieceLock(state, locked, mode);
    const feedback = actions.find((a) => a.type === "UpdateFinesseFeedback");
    expect(feedback).toBeTruthy();
    // Should be optimal because normalized to just HardDrop
    // @ts-expect-error narrowing by runtime check above
    expect(feedback.feedback.isOptimal).toBe(true);
  });

  test("analyzes from spawn state (not current pre-lock position)", () => {
    let state = baseState();
    // Player performed minimal inputs to go from spawn x=3 to x=0: DASLeft + HardDrop
    const events: InputEvent[] = [
      { tMs: 100, frame: 6, action: "LeftDown" },
      { tMs: 200, frame: 12, action: "HardDrop" },
    ];
    const processedActions: ProcessedAction[] = [
      { action: { type: "Move", dir: -1, source: "das" }, timestamp: 100 },
      {
        action: { type: "HardDrop", timestampMs: createTimestamp(200) },
        timestamp: 200,
      },
    ];
    state = {
      ...state,
      inputLog: events,
      processedInputLog: processedActions,
      gameplay: { finesseCancelMs: 50 },
    };

    // Simulate that the piece was already at x=0 before lock
    const locked: ActivePiece = { id: "T", rot: "spawn", x: 0, y: 5 };

    const actions = service.analyzePieceLock(state, locked, mode);
    const feedback = actions.find((a) => a.type === "UpdateFinesseFeedback");
    expect(feedback).toBeTruthy();
    // If analyzed from spawn, optimal len is 2 and player len is 2 → optimal true
    // If erroneously analyzed from current, optimal len would be 1 (HardDrop only) → optimal false
    // @ts-expect-error narrowing by runtime check above
    expect(feedback.feedback.isOptimal).toBe(true);
  });

  test("creates actions with custom timestamp", () => {
    let state = baseState();
    const customTimestamp = 12345;
    const events: InputEvent[] = [{ tMs: 100, frame: 6, action: "HardDrop" }];
    const processedActions: ProcessedAction[] = [
      {
        action: { type: "HardDrop", timestampMs: createTimestamp(100) },
        timestamp: 100,
      },
    ];
    state = { ...state, inputLog: events, processedInputLog: processedActions };

    const locked: ActivePiece = { id: "T", rot: "spawn", x: 3, y: 5 };
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
    // @ts-expect-error narrowing by runtime check above
    expect(feedbackAction.feedback.timestamp).toBe(customTimestamp);
  });

  test("always includes ClearInputLog action as final action", () => {
    let state = baseState();
    const events: InputEvent[] = [{ tMs: 100, frame: 6, action: "HardDrop" }];
    const processedActions: ProcessedAction[] = [
      {
        action: { type: "HardDrop", timestampMs: createTimestamp(100) },
        timestamp: 100,
      },
    ];
    state = { ...state, inputLog: events, processedInputLog: processedActions };

    const locked: ActivePiece = { id: "T", rot: "spawn", x: 3, y: 5 };
    const actions = service.analyzePieceLock(state, locked, mode);

    const clearAction = actions[actions.length - 1];
    expect(clearAction).toBeDefined();
    expect(clearAction?.type).toBe("ClearInputLog");
  });

  test("calculates optimal input count correctly", () => {
    let state = baseState();
    const events: InputEvent[] = [{ tMs: 100, frame: 6, action: "HardDrop" }];
    const processedActions: ProcessedAction[] = [
      {
        action: { type: "HardDrop", timestampMs: createTimestamp(100) },
        timestamp: 100,
      },
    ];
    state = { ...state, inputLog: events, processedInputLog: processedActions };

    const locked: ActivePiece = { id: "T", rot: "spawn", x: 3, y: 5 }; // At spawn position
    const actions = service.analyzePieceLock(state, locked, mode);

    const recordAction = actions.find((a) => a.type === "RecordPieceLock");
    expect(recordAction).toBeTruthy();
    // @ts-expect-error narrowing by runtime check above
    expect(recordAction.optimalInputCount).toBe(1); // Just HardDrop is optimal at spawn
    // @ts-expect-error narrowing by runtime check above
    expect(recordAction.inputCount).toBe(1); // Player also did just HardDrop
    // @ts-expect-error narrowing by runtime check above
    expect(recordAction.isOptimal).toBe(true);
  });

  test("returns actions array with required action types", () => {
    let state = baseState();
    const events: InputEvent[] = [{ tMs: 100, frame: 6, action: "HardDrop" }];
    const processedActions: ProcessedAction[] = [
      {
        action: { type: "HardDrop", timestampMs: createTimestamp(100) },
        timestamp: 100,
      },
    ];
    state = { ...state, inputLog: events, processedInputLog: processedActions };

    const locked: ActivePiece = { id: "T", rot: "spawn", x: 3, y: 5 };
    const actions = service.analyzePieceLock(state, locked, mode);

    // Should have at least: UpdateFinesseFeedback, RecordPieceLock, ClearInputLog
    expect(actions.length).toBeGreaterThanOrEqual(3);

    const actionTypes = actions.map((a) => a.type);
    expect(actionTypes).toContain("UpdateFinesseFeedback");
    expect(actionTypes).toContain("RecordPieceLock");
    expect(actionTypes).toContain("ClearInputLog");
  });
});
