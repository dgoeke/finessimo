import { describe, test, expect } from "@jest/globals";

import { dropToBottom } from "@/core/board";
import { finesseService } from "@/engine/finesse/service";
import { createInitialState } from "@/engine/init";
import { GuidedMode } from "@/modes/guided/mode";
import { makeDeck } from "@/modes/guided/srs/fsrs-adapter";
import { createColumn } from "@/modes/guided/types";
import { createDurationMs, createGridCoord, createSeed } from "@/types/brands";
import { createTimestamp } from "@/types/timestamp";

import type { GameState, ProcessedAction } from "@/state/types";

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
