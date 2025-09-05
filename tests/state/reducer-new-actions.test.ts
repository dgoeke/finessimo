import { createSeed } from "@/types/brands";
import { fromNow } from "@/types/timestamp";

import { reducerWithPipeline as reducer } from "../helpers/reducer-with-pipeline";

describe("Reducer - new action branches", () => {
  it("handles SetMode", () => {
    const init = reducer(undefined, {
      seed: createSeed("test"),
      timestampMs: fromNow(),
      type: "Init",
    });
    const state = reducer(init, { mode: "guided", type: "SetMode" });
    expect(state.currentMode).toBe("guided");
    expect(state.finesseFeedback).toBeNull();
    expect(state.modePrompt).toBeNull();
  });

  it("handles UpdateFinesseFeedback", () => {
    const init = reducer(undefined, {
      seed: createSeed("test"),
      timestampMs: fromNow(),
      type: "Init",
    });
    const fb = {
      kind: "optimal" as const,
      optimalSequences: [],
      playerSequence: [],
    };
    const state = reducer(init, {
      feedback: fb,
      type: "UpdateFinesseFeedback",
    });
    expect(state.finesseFeedback).toEqual(fb);
  });

  it("handles UpdateModePrompt", () => {
    const init = reducer(undefined, {
      seed: createSeed("test"),
      timestampMs: fromNow(),
      type: "Init",
    });
    const state = reducer(init, {
      prompt: "Do this",
      type: "UpdateModePrompt",
    });
    expect(state.modePrompt).toBe("Do this");
  });
});
