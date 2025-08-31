import { describe, test, expect } from "@jest/globals";

import { dropToBottom } from "../../src/core/board";
import { createInitialState } from "../../src/engine/init";
import { finesseService } from "../../src/finesse/service";
import { GuidedMode } from "../../src/modes/guided";
import { createColumn } from "../../src/modes/guided/types";
import { makeDeck } from "../../src/srs/fsrs-adapter";
import {
  createDurationMs,
  createGridCoord,
  createSeed,
} from "../../src/types/brands";
import { createTimestamp } from "../../src/types/timestamp";

import type { GameState, ProcessedAction } from "../../src/state/types";

describe("Guided Z: 1-right in left-rot should be 3 inputs", () => {
  function guidedStateWithSingleCard(): GameState {
    // Start in guided mode with strict gameplay config
    const base = createInitialState(createSeed("test"), createTimestamp(1), {
      gameplay: { finesseCancelMs: createDurationMs(50), holdEnabled: false },
      mode: "guided",
    });

    const now = createTimestamp(1);
    // Single card: Z piece, left rotation, one column to the right of spawn (x=5)
    const cards = [
      { piece: "Z" as const, rot: "left" as const, x: createColumn(5) },
    ];
    const deck = makeDeck("guided-test-z", cards, now);

    // Guided mode expects modeData with { deck, gradingConfig }
    const mode = new GuidedMode();
    const modeData = {
      deck,
      gradingConfig: mode.getGradingConfig(base),
    } as const;

    return { ...base, modeData };
  }

  test("service returns optimal result and 3-step minimal sequence", () => {
    const state = guidedStateWithSingleCard();
    const mode = new GuidedMode();

    // Player inputs: Rotate CW, Tap Right, Hard Drop (order doesn't change length)
    const processed: Array<ProcessedAction> = [
      { dir: "CW", kind: "Rotate", t: createTimestamp(10) },
      { dir: 1, kind: "TapMove", t: createTimestamp(20) },
      { kind: "HardDrop", t: createTimestamp(30) },
    ];

    // Build a locked piece that actually matches the guided target occupancy
    const board = state.board;
    const target = {
      id: "Z" as const,
      rot: "left" as const,
      x: createGridCoord(5),
      y: createGridCoord(-2),
    };
    const locked = dropToBottom(board, target);
    const actions = finesseService.analyzePieceLock(
      { ...state, processedInputLog: processed },
      locked,
      mode,
      createTimestamp(40),
    );

    const feedbackAction = actions.find(
      (
        a,
      ): a is Extract<
        (typeof actions)[number],
        { type: "UpdateFinesseFeedback" }
      > => a.type === "UpdateFinesseFeedback",
    );
    expect(feedbackAction).toBeTruthy();
    if (!feedbackAction) return;

    const fb = feedbackAction.feedback;
    expect(fb).toBeTruthy();

    // Should grade as optimal (length-only compare) and minimal optimal len is 3
    // Even if faults are present for other reasons, the optimal sequences should be minimal length 3
    const minLen =
      fb?.optimalSequences && fb.optimalSequences.length > 0
        ? Math.min(...fb.optimalSequences.map((s) => s.length))
        : 0;
    expect(minLen).toBe(3);
    expect(fb?.kind).toBe("optimal");
  });
});
