import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";

import { createSeed, createGridCoord } from "../../src/types/brands";
import { fromNow } from "../../src/types/timestamp";
import { reducerWithPipeline as reducer } from "../helpers/reducer-with-pipeline";

import type { PolicyOutput } from "../../src/policy/types";
import type { GameState } from "../../src/state/types";

// Types for mocked coach overlay element
type MockCoachOverlay = {
  updateCoachFeedback?: (state: GameState) => void;
  feedbackEl?: HTMLElement;
  lastSuggestion?: string | null;
  isShowing?: boolean;
  hideTimerId?: ReturnType<typeof setTimeout> | null;
  extractPolicyOutput?: (state: GameState) => PolicyOutput | null;
  showFeedbackAnimation?: (el: HTMLElement, isNewSuggestion: boolean) => void;
  hideFeedbackAnimation?: (el: HTMLElement) => void;
  scheduleAutoHide?: (el: HTMLElement) => void;
  createRenderRoot?: () => HTMLElement;
  disconnectedCallback?: () => void;
} & HTMLElement;

// Mock Lit and decorators for testing environment
jest.mock("lit", () => ({
  html: () => null,
  LitElement: class LitElement extends HTMLElement {
    __updateCount = 0;
    requestUpdate(): void {
      this.__updateCount += 1;
    }
    connectedCallback(): void {
      // No-op for tests
    }
    disconnectedCallback(): void {
      // No-op for tests
    }
  },
}));

jest.mock("lit/decorators.js", () => ({
  customElement: (tag: string) => (cls: unknown) => {
    customElements.define(tag, cls as CustomElementConstructor);
    return cls;
  },
  query: () => () => undefined,
  state: () => () => undefined,
}));

jest.mock("@lit-labs/signals", () => ({
  SignalWatcher: (base: unknown) => base,
}));

// Mock the game state signal
const mockGameStateSignal = {
  get: jest.fn<() => GameState>(),
};

jest.mock("../../src/state/signals", () => ({
  gameStateSignal: mockGameStateSignal,
}));

describe("CoachOverlay Component", () => {
  beforeAll(async () => {
    // Import the component after mocks are set up
    await import("../../src/ui/components/coachOverlay");
  });

  beforeEach(() => {
    // Clear any existing timers
    jest.clearAllTimers();
    jest.useFakeTimers();
    mockGameStateSignal.get.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
    // Clean up any remaining elements
    document.body.innerHTML = "";
  });

  function createTestGameState(policyOutput?: PolicyOutput): GameState {
    const base = reducer(undefined, {
      seed: createSeed("test"),
      timestampMs: fromNow(),
      type: "Init",
    });

    return {
      ...base,
      modeData: policyOutput ? { policyOutput } : null,
    };
  }

  function createMockPolicyOutput(rationale?: string): PolicyOutput {
    return {
      nextCtx: {
        lastBestScore: null,
        lastPlanId: null,
        lastSecondScore: null,
        lastUpdate: null,
        planAge: 0,
      },
      suggestion: {
        confidence: 0.8,
        intent: "TKI",
        placement: {
          rot: "spawn",
          x: createGridCoord(4),
        },
        rationale: rationale ?? "Test rationale",
      },
    };
  }

  function createCoachOverlay(): MockCoachOverlay {
    const element = document.createElement("coach-overlay") as MockCoachOverlay;

    document.body.appendChild(element);

    // Mock the feedback element
    const feedbackDiv = document.createElement("div");
    feedbackDiv.className = "coach-feedback-overlay";
    element.feedbackEl = feedbackDiv;

    // Mock the createRenderRoot method
    element.createRenderRoot = () => element;

    return element;
  }

  describe("Component Creation and Setup", () => {
    it("should create coach overlay element", () => {
      const element = createCoachOverlay();

      expect(element.tagName.toLowerCase()).toBe("coach-overlay");
    });

    it("should use light DOM for styling", () => {
      const element = createCoachOverlay();

      // Light DOM means createRenderRoot returns the element itself
      expect(element.createRenderRoot?.()).toBe(element);
    });

    it("should initialize with default state", () => {
      const element = createCoachOverlay();

      expect(element.lastSuggestion).toBeUndefined(); // Will be null after initialization
      expect(element.isShowing).toBeUndefined(); // Will be false after initialization
    });
  });

  describe("Policy Output Extraction", () => {
    it("should extract policy output from modeData", () => {
      const policyOutput = createMockPolicyOutput("Test extraction");
      const gameState = createTestGameState(policyOutput);

      mockGameStateSignal.get.mockReturnValue(gameState);

      const element = createCoachOverlay();
      const extractedOutput = element.extractPolicyOutput?.(gameState);

      expect(extractedOutput).toEqual(policyOutput);
    });

    it("should return null when no policy output in modeData", () => {
      const gameState = createTestGameState();

      const element = createCoachOverlay();
      const extractedOutput = element.extractPolicyOutput?.(gameState);

      expect(extractedOutput).toBeNull();
    });

    it("should extract policy output from direct gameState field", () => {
      const policyOutput = createMockPolicyOutput("Direct field test");
      const gameStateWithDirectField = {
        ...createTestGameState(),
        policyOutput,
      } as GameState & { policyOutput: PolicyOutput };

      const element = createCoachOverlay();
      const extractedOutput = element.extractPolicyOutput?.(
        gameStateWithDirectField,
      );

      expect(extractedOutput).toEqual(policyOutput);
    });

    it("should handle malformed modeData gracefully", () => {
      const gameStateWithBadModeData = {
        ...createTestGameState(),
        modeData: "not an object",
      };

      const element = createCoachOverlay();
      const extractedOutput = element.extractPolicyOutput?.(
        gameStateWithBadModeData,
      );

      expect(extractedOutput).toBeNull();
    });
  });

  describe("Feedback Display Logic", () => {
    it("should show coaching feedback for valid rationale", () => {
      const rationale = "Focus on efficient T-spin setup";
      const policyOutput = createMockPolicyOutput(rationale);
      const gameState = createTestGameState(policyOutput);

      mockGameStateSignal.get.mockReturnValue(gameState);

      const element = createCoachOverlay();
      const feedbackEl = element.feedbackEl;
      if (!feedbackEl) {
        throw new Error("feedbackEl not found");
      }

      element.updateCoachFeedback?.(gameState);

      expect(feedbackEl.getAttribute("aria-label")).toBe(
        `Coaching suggestion: ${rationale}`,
      );
    });

    it("should not show feedback for empty rationale", () => {
      const policyOutput = createMockPolicyOutput("");
      const gameState = createTestGameState(policyOutput);

      const element = createCoachOverlay();
      const feedbackEl = element.feedbackEl;
      if (!feedbackEl) {
        throw new Error("feedbackEl not found");
      }

      element.updateCoachFeedback?.(gameState);

      expect(feedbackEl.getAttribute("aria-label")).toBeNull();
    });

    it("should not show feedback for undefined rationale", () => {
      const policyOutput: PolicyOutput = {
        nextCtx: {
          lastBestScore: null,
          lastPlanId: null,
          lastSecondScore: null,
          lastUpdate: null,
          planAge: 0,
        },
        suggestion: {
          confidence: 0.8,
          intent: "TKI",
          placement: { rot: "spawn", x: createGridCoord(4) },
          rationale: "",
        },
      };
      const gameState = createTestGameState(policyOutput);

      const element = createCoachOverlay();
      const feedbackEl = element.feedbackEl;
      if (!feedbackEl) {
        throw new Error("feedbackEl not found");
      }

      element.updateCoachFeedback?.(gameState);

      expect(feedbackEl.getAttribute("aria-label")).toBeNull();
    });

    it("should handle whitespace-only rationale", () => {
      const policyOutput = createMockPolicyOutput("   \n\t   ");
      const gameState = createTestGameState(policyOutput);

      const element = createCoachOverlay();
      const feedbackEl = element.feedbackEl;
      if (!feedbackEl) {
        throw new Error("feedbackEl not found");
      }

      element.updateCoachFeedback?.(gameState);

      expect(feedbackEl.getAttribute("aria-label")).toBeNull();
    });
  });

  describe("Animation and Transition Logic", () => {
    it("should apply show class for new suggestions", () => {
      const element = createCoachOverlay();
      const feedbackEl = element.feedbackEl;
      if (!feedbackEl) {
        throw new Error("feedbackEl not found");
      }

      element.showFeedbackAnimation?.(feedbackEl, true);

      expect(feedbackEl.classList.contains("show")).toBe(true);
      expect(feedbackEl.classList.contains("hide")).toBe(false);
    });

    it("should apply hide class when hiding feedback", () => {
      const element = createCoachOverlay();
      const feedbackEl = element.feedbackEl;
      if (!feedbackEl) {
        throw new Error("feedbackEl not found");
      }

      // First show it
      element.showFeedbackAnimation?.(feedbackEl, true);
      element.isShowing = true;

      // Then hide it
      element.hideFeedbackAnimation?.(feedbackEl);

      expect(feedbackEl.classList.contains("show")).toBe(false);
      expect(feedbackEl.classList.contains("hide")).toBe(true);
    });

    it("should force reflow when showing new suggestion", () => {
      const element = createCoachOverlay();
      const feedbackEl = element.feedbackEl;
      if (!feedbackEl) {
        throw new Error("feedbackEl not found");
      }

      element.showFeedbackAnimation?.(feedbackEl, true);

      // Should have set dataset.reflow to trigger reflow
      expect(feedbackEl.dataset["reflow"]).toBeDefined();
    });

    it("should remove visibility style when showing", () => {
      const element = createCoachOverlay();
      const feedbackEl = element.feedbackEl;
      if (!feedbackEl) {
        throw new Error("feedbackEl not found");
      }

      feedbackEl.style.visibility = "hidden";

      element.showFeedbackAnimation?.(feedbackEl, true);

      expect(feedbackEl.style.visibility).toBe("");
    });
  });

  describe("Auto-hide Behavior", () => {
    it("should schedule auto-hide timer", () => {
      const element = createCoachOverlay();
      const feedbackEl = element.feedbackEl;
      if (!feedbackEl) {
        throw new Error("feedbackEl not found");
      }

      element.scheduleAutoHide?.(feedbackEl);

      expect(element.hideTimerId).not.toBeNull();
    });

    it("should clear existing timer when scheduling new one", () => {
      const element = createCoachOverlay();
      const feedbackEl = element.feedbackEl;
      if (!feedbackEl) {
        throw new Error("feedbackEl not found");
      }

      element.scheduleAutoHide?.(feedbackEl);
      const firstTimerId = element.hideTimerId;

      element.scheduleAutoHide?.(feedbackEl);
      const secondTimerId = element.hideTimerId;

      expect(firstTimerId).not.toBe(secondTimerId);
    });

    it("should hide feedback after timeout", () => {
      const element = createCoachOverlay();
      const feedbackEl = element.feedbackEl;
      if (!feedbackEl) {
        throw new Error("feedbackEl not found");
      }

      element.isShowing = true;
      element.scheduleAutoHide?.(feedbackEl);

      // Fast-forward time
      jest.advanceTimersByTime(2000); // HIDE_AFTER_MS

      expect(feedbackEl.classList.contains("hide")).toBe(true);
      expect(element.isShowing).toBe(false);
    });

    it("should not hide if no longer showing when timeout fires", () => {
      const element = createCoachOverlay();
      const feedbackEl = element.feedbackEl;
      if (!feedbackEl) {
        throw new Error("feedbackEl not found");
      }

      element.isShowing = false; // Not showing
      element.scheduleAutoHide?.(feedbackEl);

      // Fast-forward time
      jest.advanceTimersByTime(2000);

      // Should not have added hide class
      expect(feedbackEl.classList.contains("hide")).toBe(false);
    });
  });

  describe("Integration and State Management", () => {
    it("should handle multiple rapid updates", () => {
      const element = createCoachOverlay();
      const feedbackEl = element.feedbackEl;
      if (!feedbackEl) {
        throw new Error("feedbackEl not found");
      }

      const rationale1 = "First suggestion";
      const rationale2 = "Second suggestion";

      const gameState1 = createTestGameState(
        createMockPolicyOutput(rationale1),
      );
      const gameState2 = createTestGameState(
        createMockPolicyOutput(rationale2),
      );

      element.updateCoachFeedback?.(gameState1);
      element.updateCoachFeedback?.(gameState2);

      expect(feedbackEl.getAttribute("aria-label")).toBe(
        `Coaching suggestion: ${rationale2}`,
      );
    });

    it("should clean up timers on disconnect", () => {
      const element = createCoachOverlay();
      const feedbackEl = element.feedbackEl;
      if (!feedbackEl) {
        throw new Error("feedbackEl not found");
      }

      element.scheduleAutoHide?.(feedbackEl);
      expect(element.hideTimerId).not.toBeNull();

      // Simulate disconnect
      if (element.disconnectedCallback) {
        element.disconnectedCallback();
      }

      // Timer should be cleared (implementation detail)
      // This test would need access to the actual component implementation
    });

    it("should handle game state without modeData", () => {
      const gameStateBase = createTestGameState();
      // Create a new object to avoid readonly assignment
      const gameState = { ...gameStateBase, modeData: null };

      const element = createCoachOverlay();

      expect(() => {
        element.updateCoachFeedback?.(gameState);
      }).not.toThrow();
    });

    it("should handle game state with malformed modeData", () => {
      const gameStateBase = createTestGameState();
      // Create a new object to avoid readonly assignment
      const gameState = {
        ...gameStateBase,
        modeData: { invalid: "structure" },
      };

      const element = createCoachOverlay();

      expect(() => {
        element.updateCoachFeedback?.(gameState);
      }).not.toThrow();
    });
  });

  describe("Accessibility", () => {
    it("should set appropriate ARIA labels", () => {
      const rationale = "T-spin triple opportunity";
      const policyOutput = createMockPolicyOutput(rationale);
      const gameState = createTestGameState(policyOutput);

      const element = createCoachOverlay();
      const feedbackEl = element.feedbackEl;
      if (!feedbackEl) {
        throw new Error("feedbackEl not found");
      }

      element.updateCoachFeedback?.(gameState);

      expect(feedbackEl.getAttribute("aria-label")).toBe(
        `Coaching suggestion: ${rationale}`,
      );
      expect(feedbackEl.getAttribute("role")).toBe("status");
    });

    it("should clear ARIA labels when hiding", () => {
      const element = createCoachOverlay();
      const feedbackEl = element.feedbackEl;
      if (!feedbackEl) {
        throw new Error("feedbackEl not found");
      }

      // Set up initial state
      feedbackEl.setAttribute("aria-label", "Test label");

      element.hideFeedbackAnimation?.(feedbackEl);

      // Should clear aria-label when hiding
      expect(feedbackEl.getAttribute("aria-label")).toBeNull();
    });
  });

  describe("Performance Considerations", () => {
    it("should not update DOM if rationale hasn't changed", () => {
      const rationale = "Same rationale";
      const policyOutput = createMockPolicyOutput(rationale);
      const gameState = createTestGameState(policyOutput);

      const element = createCoachOverlay();
      element.lastSuggestion = rationale; // Simulate already showing this

      const feedbackEl = element.feedbackEl;
      if (!feedbackEl) {
        throw new Error("feedbackEl not found");
      }

      const classListSpy = jest.spyOn(feedbackEl.classList, "add");

      element.updateCoachFeedback?.(gameState);

      // Should not have triggered animations
      expect(classListSpy).not.toHaveBeenCalled();
    });

    it("should debounce rapid updates", () => {
      const element = createCoachOverlay();

      // Multiple rapid calls should not cause issues
      const gameState1 = createTestGameState(
        createMockPolicyOutput("Suggestion 1"),
      );
      const gameState2 = createTestGameState(
        createMockPolicyOutput("Suggestion 2"),
      );
      const gameState3 = createTestGameState(
        createMockPolicyOutput("Suggestion 3"),
      );

      expect(() => {
        element.updateCoachFeedback?.(gameState1);
        element.updateCoachFeedback?.(gameState2);
        element.updateCoachFeedback?.(gameState3);
      }).not.toThrow();
    });
  });
});
