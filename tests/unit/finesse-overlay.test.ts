// Mock Lit to avoid ESM node resolution for real 'lit' package in tests
import { type GameState } from "../../src/state/types";
import { createSeed } from "../../src/types/brands";
import { fromNow } from "../../src/types/timestamp";
import { reducerWithPipeline as reducer } from "../helpers/reducer-with-pipeline";
jest.mock(
  "lit",
  () => ({
    html: () => null,
    LitElement: class LitElement extends HTMLElement {
      __x = 0;
      requestUpdate(): void {
        this.__x += 1;
      }
      // Provide proper custom element lifecycle methods for JSDOM teardown
      connectedCallback(): void {
        // No-op for tests
      }
      disconnectedCallback(): void {
        // No-op for tests
      }
    },
  }),
  { virtual: true },
);
jest.mock(
  "lit/decorators.js",
  () => ({
    customElement: (tag: string) => (cls: unknown) => {
      // Register as a real custom element for createElement to upgrade
      customElements.define(tag, cls as CustomElementConstructor);
      return cls;
    },
    query: () => () => undefined,
    state: () => () => undefined,
  }),
  { virtual: true },
);

describe("finesse-overlay boop behavior", () => {
  beforeAll(async () => {
    // Register the custom element after mocks are in place
    await import("../../src/ui/components/finesse-overlay");
  });
  class FakeOscillator {
    public connected = false;
    public lastFreqValue = 0;
    public lastFreqTarget = 0;
    constructor(private onStart: () => void) {}
    connect(_: unknown): void {
      this.connected = true;
    }
    start(): void {
      this.onStart();
    }
    stop(): void {
      this.connected = false;
    }
    frequency = {
      exponentialRampToValueAtTime: (value: number): void => {
        this.lastFreqTarget = value;
      },
      setValueAtTime: (value: number): void => {
        this.lastFreqValue = value;
      },
    };
  }

  class FakeGain {
    public connected = false;
    connect(_: unknown): void {
      this.connected = true;
    }
    gain = {
      exponentialRampToValueAtTime: (_value: number): void => {
        /* record target */
      },
      setValueAtTime: (_value: number): void => {
        /* record value */
      },
    };
  }

  class FakeAudioContext {
    public state: "running" | "suspended" = "running";
    public destination = {} as unknown;
    public currentTime = 0;
    private onStart: () => void;

    constructor(onStart: () => void) {
      this.onStart = onStart;
    }

    createOscillator(): FakeOscillator {
      return new FakeOscillator(this.onStart);
    }

    createGain(): FakeGain {
      return new FakeGain();
    }

    resume(): Promise<void> {
      this.state = "running";
      return Promise.resolve();
    }
  }

  let boopCount = 0;
  const OriginalAudioContext = (global as unknown as { AudioContext?: unknown })
    .AudioContext;

  beforeEach(() => {
    boopCount = 0;
    // Stub AudioContext so playBoop() increments boopCount once per call
    (global as unknown as { AudioContext: unknown }).AudioContext = class {
      private inner: FakeAudioContext;
      public state: "running" | "suspended";
      public destination: unknown;
      public currentTime: number;
      constructor() {
        this.inner = new FakeAudioContext(() => {
          boopCount += 1;
        });
        this.state = this.inner.state;
        this.destination = this.inner.destination;
        this.currentTime = this.inner.currentTime;
      }
      createOscillator(): FakeOscillator {
        return this.inner.createOscillator();
      }
      createGain(): FakeGain {
        return this.inner.createGain();
      }
      resume(): Promise<void> {
        return this.inner.resume();
      }
    } as unknown as typeof AudioContext;
  });

  afterEach(() => {
    // Restore original AudioContext
    (global as unknown as { AudioContext?: unknown }).AudioContext =
      OriginalAudioContext;
  });

  function createStateWithFeedback(_timestamp: number): GameState {
    const base = reducer(undefined, {
      seed: createSeed("test"),
      timestampMs: fromNow(),
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
        finesseBoopEnabled: true, // boop enabled
        finesseFeedbackEnabled: false, // overlay disabled
      },
    };
  }

  it("plays boop once when overlay is disabled, then never repeats for same feedback", () => {
    const el = document.createElement(
      "finesse-overlay",
    ) as unknown as HTMLElement & {
      updateFinesseFeedback: (s: GameState) => void;
    };
    document.body.appendChild(el);
    // Provide the expected overlay container so logic doesn't early-return
    const overlayDiv = document.createElement("div");
    overlayDiv.className = "finesse-feedback-overlay";
    (el as unknown as { feedbackEl?: HTMLElement }).feedbackEl = overlayDiv;

    const state1 = createStateWithFeedback(1000);
    // First update with new feedback timestamp -> should boop
    (
      el as unknown as { updateFinesseFeedback: (s: GameState) => void }
    ).updateFinesseFeedback(state1);
    expect(boopCount).toBe(1);

    // Subsequent updates with same feedback should not re-boop
    for (let i = 0; i < 5; i++) {
      (
        el as unknown as { updateFinesseFeedback: (s: GameState) => void }
      ).updateFinesseFeedback(state1);
    }
    expect(boopCount).toBe(1);

    // New feedback (different content) should boop again
    const state2 = createStateWithFeedback(1200);
    // Make the feedback different by changing the sequence
    if (state2.finesseFeedback) {
      state2.finesseFeedback = {
        ...state2.finesseFeedback,
        optimalSequences: [["MoveRight"]], // Different from MoveLeft
      };
    }
    (
      el as unknown as { updateFinesseFeedback: (s: GameState) => void }
    ).updateFinesseFeedback(state2);
    expect(boopCount).toBe(2);
  });
});
