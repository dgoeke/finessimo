import { reducer } from "../../src/state/reducer";

describe("Reducer - new action branches", () => {
  it("handles SetMode", () => {
    const init = reducer(undefined, { type: "Init", seed: "test" });
    const state = reducer(init, { type: "SetMode", mode: "guided" });
    expect(state.currentMode).toBe("guided");
    expect(state.finesseFeedback).toBeNull();
    expect(state.modePrompt).toBeNull();
  });

  it("handles UpdateFinesseFeedback", () => {
    const init = reducer(undefined, { type: "Init", seed: "test" });
    const fb = { message: "ok", isOptimal: true, timestamp: performance.now() };
    const state = reducer(init, {
      type: "UpdateFinesseFeedback",
      feedback: fb,
    });
    expect(state.finesseFeedback).toEqual(fb);
  });

  it("handles UpdateModePrompt", () => {
    const init = reducer(undefined, { type: "Init", seed: "test" });
    const state = reducer(init, {
      type: "UpdateModePrompt",
      prompt: "Do this",
    });
    expect(state.modePrompt).toBe("Do this");
  });
});
