// Mock Lit similar to existing finesse-overlay tests
import { type GameState } from "../../../src/state/types";
import { createSeed } from "../../../src/types/brands";
import { createTimestamp } from "../../../src/types/timestamp";
import { reducerWithPipeline as reducer } from "../../helpers/reducer-with-pipeline";

jest.mock(
  "lit",
  () => ({
    html: () => null,
    LitElement: class LitElement extends HTMLElement {
      __x = 0;
      requestUpdate(): void {
        this.__x += 1;
      }
      connectedCallback(): void {
        // no-op for tests
      }
      disconnectedCallback(): void {
        // no-op for tests
      }
    },
  }),
  { virtual: true },
);

jest.mock(
  "lit/decorators.js",
  () => ({
    customElement: (tag: string) => (cls: unknown) => {
      customElements.define(tag, cls as CustomElementConstructor);
      return cls;
    },
    query: () => () => undefined,
    state: () => () => undefined,
  }),
  { virtual: true },
);

describe("finesse-overlay auto-hide", () => {
  beforeAll(async () => {
    await import("../../../src/ui/components/finesse-overlay");
  });

  function createStateWithFeedback(): GameState {
    const base = reducer(undefined, {
      seed: createSeed("test"),
      timestampMs: createTimestamp(1),
      type: "Init",
    });
    return {
      ...base,
      finesseFeedback: {
        faults: [],
        kind: "faulty",
        optimalSequences: [["MoveLeft"]],
        playerSequence: [],
      },
      gameplay: {
        ...base.gameplay,
        finesseBoopEnabled: false,
        finesseFeedbackEnabled: true,
      },
    };
  }

  it("shows then auto-hides after 1500ms and does not re-show", () => {
    jest.useFakeTimers();

    const el = document.createElement(
      "finesse-overlay",
    ) as unknown as HTMLElement & {
      updateFinesseFeedback: (s: GameState) => void;
    };
    document.body.appendChild(el);

    // Provide overlay container element expected by the component
    const overlayDiv = document.createElement("div");
    overlayDiv.className = "finesse-feedback-overlay";
    (el as unknown as { feedbackEl?: HTMLElement }).feedbackEl = overlayDiv;

    const state = createStateWithFeedback();

    // Initial update should show
    el.updateFinesseFeedback(state);
    expect(overlayDiv.classList.contains("show")).toBe(true);
    expect(overlayDiv.classList.contains("hide")).toBe(false);

    // Advance time to trigger auto-hide
    jest.advanceTimersByTime(1500);

    // After hide, overlay should have 'hide' class
    expect(overlayDiv.classList.contains("show")).toBe(false);
    expect(overlayDiv.classList.contains("hide")).toBe(true);

    // Subsequent updates with the same feedback must NOT re-show
    for (let i = 0; i < 3; i++) {
      el.updateFinesseFeedback(state);
      jest.advanceTimersByTime(16);
      expect(overlayDiv.classList.contains("show")).toBe(false);
      expect(overlayDiv.classList.contains("hide")).toBe(true);
    }

    jest.useRealTimers();
  });
});
