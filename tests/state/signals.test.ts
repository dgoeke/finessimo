import { describe, it, expect } from "@jest/globals";

import {
  dispatch as storeDispatch,
  gameStateSignal,
  getCurrentState,
  stateSelectors,
} from "@/state/signals";
import { createSeed } from "@/types/brands";
import { fromNow } from "@/types/timestamp";

describe("signals.ts store and selectors", () => {
  it("initializes state via Init and updates the signal", () => {
    const before = gameStateSignal.get();
    expect(before).toBeUndefined();

    storeDispatch({
      seed: createSeed("test-seed"),
      timestampMs: fromNow(),
      type: "Init",
    });
    const after = getCurrentState();
    expect(after.status).toBe("playing");

    const current = getCurrentState();
    expect(current).toBe(after);
    expect(current.tick).toBe(0);
  });

  it("applies actions and recomputes selectors", () => {
    const prev = getCurrentState();
    storeDispatch({ guidance: { label: "Hello" }, type: "UpdateGuidance" });
    const next = getCurrentState();
    expect(next).not.toBe(prev);

    const fin = stateSelectors.getFinesseState(next);
    expect(fin.modePrompt).toBeNull();
    expect(fin.guidance?.label).toBe("Hello");

    const boardSel = stateSelectors.getBoardState(next);
    expect(boardSel.board.width).toBe(10);
    expect(boardSel.board.height).toBe(20);

    const preview = stateSelectors.getPreviewState(next);
    expect(preview.nextQueue.length).toBeGreaterThan(0);
  });
});
