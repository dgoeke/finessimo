import { describe, it, expect } from "@jest/globals";

import {
  createInitialReviewState,
  nextReview,
  isReviewDue,
  timeUntilDue,
  overdueTime,
  isValidReviewState,
  describeInterval,
  type Grade,
  type ReviewState,
} from "../../src/scenarios/srs";
import { createDurationMs, durationMsAsNumber } from "../../src/types/brands";
import {
  createTimestamp,
  asNumber as timestampAsNumber,
} from "../../src/types/timestamp";

describe("Spaced Repetition Scheduler", () => {
  const baseTime = 1000000000; // Fixed timestamp for deterministic tests
  const now = createTimestamp(baseTime);

  describe("createInitialReviewState", () => {
    it("should create initial state with default values", () => {
      const state = createInitialReviewState(now);

      expect(state.ease).toBe(2.5);
      expect(durationMsAsNumber(state.interval)).toBe(60000); // 1 minute
      expect(timestampAsNumber(state.due)).toBe(baseTime + 60000);
    });

    it("should create state due in 1 minute from now", () => {
      const state = createInitialReviewState(now);
      const expectedDue = baseTime + 60000; // 1 minute later

      expect(timestampAsNumber(state.due)).toBe(expectedDue);
    });

    it("should be deterministic for same timestamp", () => {
      const state1 = createInitialReviewState(now);
      const state2 = createInitialReviewState(now);

      expect(state1).toEqual(state2);
    });

    it("should vary due time based on input timestamp", () => {
      const later = createTimestamp(baseTime + 1000);

      const stateNow = createInitialReviewState(now);
      const stateLater = createInitialReviewState(later);

      expect(timestampAsNumber(stateLater.due)).toBe(
        timestampAsNumber(stateNow.due) + 1000,
      );
    });
  });

  describe("nextReview", () => {
    const initialState: ReviewState = {
      due: createTimestamp(baseTime),
      ease: 2.0,
      interval: createDurationMs(60000), // 1 minute
    };

    describe("Grade: Again", () => {
      it("should reset interval to 1 minute", () => {
        const nextState = nextReview(now, initialState, "Again");

        expect(durationMsAsNumber(nextState.interval)).toBe(60000); // Reset to 1 minute
      });

      it("should decrease ease factor", () => {
        const nextState = nextReview(now, initialState, "Again");

        expect(nextState.ease).toBe(1.8); // 2.0 - 0.2
      });

      it("should not let ease go below 1.3", () => {
        const lowEaseState: ReviewState = {
          ...initialState,
          ease: 1.4,
        };

        const nextState = nextReview(now, lowEaseState, "Again");

        expect(nextState.ease).toBe(1.3); // Clamped to minimum
      });
    });

    describe("Grade: Hard", () => {
      it("should slightly increase interval", () => {
        const nextState = nextReview(now, initialState, "Hard");

        const expectedInterval = Math.round(60000 * 1.2); // 1.2x multiplier
        expect(durationMsAsNumber(nextState.interval)).toBe(expectedInterval);
      });

      it("should decrease ease factor slightly", () => {
        const nextState = nextReview(now, initialState, "Hard");

        expect(nextState.ease).toBe(1.85); // 2.0 - 0.15
      });

      it("should not let ease go below 1.3", () => {
        const lowEaseState: ReviewState = {
          ...initialState,
          ease: 1.4,
        };

        const nextState = nextReview(now, lowEaseState, "Hard");

        expect(nextState.ease).toBe(1.3); // Clamped to minimum
      });
    });

    describe("Grade: Good", () => {
      it("should multiply interval by ease factor", () => {
        const nextState = nextReview(now, initialState, "Good");

        const expectedInterval = Math.round(60000 * 2.0); // Current ease factor
        expect(durationMsAsNumber(nextState.interval)).toBe(expectedInterval);
      });

      it("should keep ease factor unchanged", () => {
        const nextState = nextReview(now, initialState, "Good");

        expect(nextState.ease).toBe(2.0); // Unchanged
      });
    });

    describe("Grade: Easy", () => {
      it("should multiply interval by ease factor * 1.3", () => {
        const nextState = nextReview(now, initialState, "Easy");

        const newEase = 2.0 + 0.15; // 2.15
        const expectedInterval = Math.round(60000 * newEase * 1.3);
        expect(durationMsAsNumber(nextState.interval)).toBe(expectedInterval);
      });

      it("should increase ease factor", () => {
        const nextState = nextReview(now, initialState, "Easy");

        expect(nextState.ease).toBe(2.15); // 2.0 + 0.15
      });

      it("should not let ease go above 2.8", () => {
        const highEaseState: ReviewState = {
          ...initialState,
          ease: 2.7,
        };

        const nextState = nextReview(now, highEaseState, "Easy");

        expect(nextState.ease).toBe(2.8); // Clamped to maximum
      });
    });

    describe("Interval bounds", () => {
      it("should ensure minimum interval of 1 minute", () => {
        const shortIntervalState: ReviewState = {
          ...initialState,
          interval: createDurationMs(30000), // 30 seconds
        };

        const nextState = nextReview(now, shortIntervalState, "Hard");

        expect(durationMsAsNumber(nextState.interval)).toBeGreaterThanOrEqual(
          60000,
        );
      });

      it("should cap maximum interval at 30 days", () => {
        const longIntervalState: ReviewState = {
          ...initialState,
          ease: 2.8,
          interval: createDurationMs(25 * 24 * 60 * 60 * 1000), // 25 days
        };

        const nextState = nextReview(now, longIntervalState, "Easy");

        const maxInterval = 30 * 24 * 60 * 60 * 1000; // 30 days
        expect(durationMsAsNumber(nextState.interval)).toBeLessThanOrEqual(
          maxInterval,
        );
      });
    });

    describe("Due time calculation", () => {
      it("should set due time correctly for all grades", () => {
        const grades: ReadonlyArray<Grade> = ["Again", "Hard", "Good", "Easy"];

        for (const grade of grades) {
          const nextState = nextReview(now, initialState, grade);
          const expectedDue = baseTime + durationMsAsNumber(nextState.interval);
          expect(timestampAsNumber(nextState.due)).toBe(expectedDue);
        }
      });
    });

    describe("Interval monotonicity", () => {
      it("should maintain proper interval ordering (Again ≤ Hard ≤ Good ≤ Easy)", () => {
        const testState: ReviewState = {
          due: createTimestamp(baseTime),
          ease: 2.0,
          interval: createDurationMs(120000), // 2 minutes
        };

        const againState = nextReview(now, testState, "Again");
        const hardState = nextReview(now, testState, "Hard");
        const goodState = nextReview(now, testState, "Good");
        const easyState = nextReview(now, testState, "Easy");

        const againInterval = durationMsAsNumber(againState.interval);
        const hardInterval = durationMsAsNumber(hardState.interval);
        const goodInterval = durationMsAsNumber(goodState.interval);
        const easyInterval = durationMsAsNumber(easyState.interval);

        expect(againInterval).toBeLessThanOrEqual(hardInterval);
        expect(hardInterval).toBeLessThanOrEqual(goodInterval);
        expect(goodInterval).toBeLessThanOrEqual(easyInterval);
      });
    });
  });

  describe("isReviewDue", () => {
    it("should return true when review is due", () => {
      const dueState: ReviewState = {
        due: createTimestamp(baseTime), // Due now
        ease: 2.0,
        interval: createDurationMs(60000),
      };

      expect(isReviewDue(dueState, now)).toBe(true);
    });

    it("should return true when review is overdue", () => {
      const overdueState: ReviewState = {
        due: createTimestamp(baseTime - 1000), // 1 second ago
        ease: 2.0,
        interval: createDurationMs(60000),
      };

      expect(isReviewDue(overdueState, now)).toBe(true);
    });

    it("should return false when review is not due", () => {
      const futureState: ReviewState = {
        due: createTimestamp(baseTime + 1000), // 1 second in future
        ease: 2.0,
        interval: createDurationMs(60000),
      };

      expect(isReviewDue(futureState, now)).toBe(false);
    });
  });

  describe("timeUntilDue", () => {
    it("should return correct time until due", () => {
      const futureState: ReviewState = {
        due: createTimestamp(baseTime + 5000), // 5 seconds in future
        ease: 2.0,
        interval: createDurationMs(60000),
      };

      const timeRemaining = timeUntilDue(futureState, now);

      expect(durationMsAsNumber(timeRemaining)).toBe(5000);
    });

    it("should return 0 when overdue", () => {
      const overdueState: ReviewState = {
        due: createTimestamp(baseTime - 1000), // 1 second ago
        ease: 2.0,
        interval: createDurationMs(60000),
      };

      const timeRemaining = timeUntilDue(overdueState, now);

      expect(durationMsAsNumber(timeRemaining)).toBe(0);
    });

    it("should return 0 when exactly due", () => {
      const dueState: ReviewState = {
        due: createTimestamp(baseTime),
        ease: 2.0,
        interval: createDurationMs(60000),
      };

      const timeRemaining = timeUntilDue(dueState, now);

      expect(durationMsAsNumber(timeRemaining)).toBe(0);
    });
  });

  describe("overdueTime", () => {
    it("should return correct overdue time", () => {
      const overdueState: ReviewState = {
        due: createTimestamp(baseTime - 3000), // 3 seconds ago
        ease: 2.0,
        interval: createDurationMs(60000),
      };

      const overdue = overdueTime(overdueState, now);

      expect(durationMsAsNumber(overdue)).toBe(3000);
    });

    it("should return 0 when not overdue", () => {
      const futureState: ReviewState = {
        due: createTimestamp(baseTime + 1000), // 1 second in future
        ease: 2.0,
        interval: createDurationMs(60000),
      };

      const overdue = overdueTime(futureState, now);

      expect(durationMsAsNumber(overdue)).toBe(0);
    });

    it("should return 0 when exactly due", () => {
      const dueState: ReviewState = {
        due: createTimestamp(baseTime),
        ease: 2.0,
        interval: createDurationMs(60000),
      };

      const overdue = overdueTime(dueState, now);

      expect(durationMsAsNumber(overdue)).toBe(0);
    });
  });

  describe("isValidReviewState", () => {
    it("should validate correct review states", () => {
      const validState: ReviewState = {
        due: createTimestamp(baseTime),
        ease: 2.0,
        interval: createDurationMs(60000),
      };

      expect(isValidReviewState(validState)).toBe(true);
    });

    it("should reject states with ease out of bounds", () => {
      const lowEaseState = {
        due: createTimestamp(baseTime),
        ease: 1.2, // Below minimum of 1.3
        interval: createDurationMs(60000),
      };

      const highEaseState = {
        due: createTimestamp(baseTime),
        ease: 3.0, // Above maximum of 2.8
        interval: createDurationMs(60000),
      };

      expect(isValidReviewState(lowEaseState)).toBe(false);
      expect(isValidReviewState(highEaseState)).toBe(false);
    });

    it("should reject states with negative intervals", () => {
      const negativeIntervalState = {
        due: createTimestamp(baseTime),
        ease: 2.0,
        interval: -1000, // Raw number instead of branded value
      };

      expect(isValidReviewState(negativeIntervalState)).toBe(false);
    });

    it("should reject states with invalid due timestamps", () => {
      const invalidDueState = {
        due: 0, // Raw number instead of branded value (0 is invalid)
        ease: 2.0,
        interval: createDurationMs(60000),
      };

      expect(isValidReviewState(invalidDueState)).toBe(false);
    });

    it("should reject null, undefined, and non-objects", () => {
      expect(isValidReviewState(null)).toBe(false);
      expect(isValidReviewState(undefined)).toBe(false);
      expect(isValidReviewState("string")).toBe(false);
      expect(isValidReviewState(42)).toBe(false);
      expect(isValidReviewState([])).toBe(false);
    });

    it("should reject objects with missing fields", () => {
      expect(isValidReviewState({})).toBe(false);
      expect(isValidReviewState({ ease: 2.0 })).toBe(false);
      expect(
        isValidReviewState({ ease: 2.0, interval: createDurationMs(60000) }),
      ).toBe(false);
    });

    it("should reject objects with wrong field types", () => {
      const wrongTypeState = {
        due: createTimestamp(baseTime),
        ease: "2.0", // Should be number
        interval: createDurationMs(60000),
      };

      expect(isValidReviewState(wrongTypeState)).toBe(false);
    });
  });

  describe("describeInterval", () => {
    it("should describe seconds correctly", () => {
      expect(describeInterval(createDurationMs(1000))).toBe("1 second");
      expect(describeInterval(createDurationMs(2000))).toBe("2 seconds");
      expect(describeInterval(createDurationMs(30000))).toBe("30 seconds");
    });

    it("should describe minutes correctly", () => {
      expect(describeInterval(createDurationMs(60000))).toBe("1 minute");
      expect(describeInterval(createDurationMs(120000))).toBe("2 minutes");
      expect(describeInterval(createDurationMs(1800000))).toBe("30 minutes");
    });

    it("should describe hours correctly", () => {
      expect(describeInterval(createDurationMs(3600000))).toBe("1 hour");
      expect(describeInterval(createDurationMs(7200000))).toBe("2 hours");
      expect(describeInterval(createDurationMs(43200000))).toBe("12 hours");
    });

    it("should describe days correctly", () => {
      expect(describeInterval(createDurationMs(86400000))).toBe("1 day");
      expect(describeInterval(createDurationMs(172800000))).toBe("2 days");
      expect(describeInterval(createDurationMs(604800000))).toBe("7 days");
    });

    it("should round to nearest whole unit", () => {
      expect(describeInterval(createDurationMs(1500))).toBe("2 seconds"); // 1.5 seconds -> 2
      expect(describeInterval(createDurationMs(90000))).toBe("2 minutes"); // 1.5 minutes -> 2
      expect(describeInterval(createDurationMs(5400000))).toBe("2 hours"); // 1.5 hours -> 2
      expect(describeInterval(createDurationMs(129600000))).toBe("2 days"); // 1.5 days -> 2
    });

    it("should prefer larger units", () => {
      expect(describeInterval(createDurationMs(86400000))).toBe("1 day"); // Not "24 hours"
      expect(describeInterval(createDurationMs(3600000))).toBe("1 hour"); // Not "60 minutes"
    });
  });

  describe("SM-2 algorithm correctness", () => {
    it("should implement proper SM-2-like intervals", () => {
      let state = createInitialReviewState(now);

      // Simulate a sequence of "Good" responses
      const intervals: Array<number> = [];

      for (let i = 0; i < 5; i++) {
        state = nextReview(
          createTimestamp(timestampAsNumber(state.due)),
          state,
          "Good",
        );
        intervals.push(durationMsAsNumber(state.interval));
      }

      // Intervals should generally increase (with ease factor 2.5)
      for (let i = 1; i < intervals.length; i++) {
        const current = intervals[i];
        const previous = intervals[i - 1];
        if (current !== undefined && previous !== undefined) {
          expect(current).toBeGreaterThan(previous);
        }
      }
    });

    it("should handle mixed grade sequences appropriately", () => {
      let state = createInitialReviewState(now);
      let currentTime = timestampAsNumber(now);

      // Good -> Easy -> Hard -> Again -> Good
      const grades: ReadonlyArray<Grade> = [
        "Good",
        "Easy",
        "Hard",
        "Again",
        "Good",
      ];
      const intervals: Array<number> = [];

      for (const grade of grades) {
        currentTime = timestampAsNumber(state.due);
        state = nextReview(createTimestamp(currentTime), state, grade);
        intervals.push(durationMsAsNumber(state.interval));
      }

      // After "Again", interval should reset to minimum
      expect(intervals[3]).toBe(60000); // Reset to 1 minute

      // Ease factor should be affected by the sequence
      expect(state.ease).toBeLessThan(2.5); // Should have decreased from failures
    });
  });

  describe("Long-term behavior", () => {
    it("should handle many successful reviews", () => {
      let state = createInitialReviewState(now);
      let currentTime = timestampAsNumber(now);

      // Simulate 10 successful "Good" reviews
      for (let i = 0; i < 10; i++) {
        currentTime = timestampAsNumber(state.due);
        state = nextReview(createTimestamp(currentTime), state, "Good");
      }

      // Should have reasonable final values
      expect(state.ease).toBe(2.5); // Unchanged for "Good"
      expect(durationMsAsNumber(state.interval)).toBeGreaterThan(60000); // Longer than initial
      expect(durationMsAsNumber(state.interval)).toBeLessThanOrEqual(
        30 * 24 * 60 * 60 * 1000,
      ); // Not exceed max
    });

    it("should handle many failed reviews", () => {
      let state = createInitialReviewState(now);
      let currentTime = timestampAsNumber(now);

      // Simulate 10 failed "Again" reviews
      for (let i = 0; i < 10; i++) {
        currentTime = timestampAsNumber(state.due);
        state = nextReview(createTimestamp(currentTime), state, "Again");
      }

      // Should have minimum values
      expect(state.ease).toBe(1.3); // Should reach minimum
      expect(durationMsAsNumber(state.interval)).toBe(60000); // Should stay at minimum interval
    });
  });

  describe("Helper function integration", () => {
    it("should work together for complete review cycle", () => {
      const state = createInitialReviewState(now);

      // Initially not due (1 minute in future)
      expect(isReviewDue(state, now)).toBe(false);
      expect(durationMsAsNumber(timeUntilDue(state, now))).toBe(60000);
      expect(durationMsAsNumber(overdueTime(state, now))).toBe(0);

      // Advance time to when it's due
      const dueTime = createTimestamp(timestampAsNumber(state.due));
      expect(isReviewDue(state, dueTime)).toBe(true);
      expect(durationMsAsNumber(timeUntilDue(state, dueTime))).toBe(0);
      expect(durationMsAsNumber(overdueTime(state, dueTime))).toBe(0);

      // Review it and check next state
      const nextState = nextReview(dueTime, state, "Good");
      expect(isValidReviewState(nextState)).toBe(true);
      expect(timestampAsNumber(nextState.due)).toBeGreaterThan(
        timestampAsNumber(dueTime),
      );
    });
  });
});

// Extract the edge cases and error handling tests to reduce nesting
describe("Spaced Repetition Scheduler - Edge Cases and Error Handling", () => {
  const baseTime = 1000000000; // Fixed timestamp for deterministic tests
  const now = createTimestamp(baseTime);

  const initialState: ReviewState = {
    due: createTimestamp(baseTime),
    ease: 2.0,
    interval: createDurationMs(60000), // 1 minute
  };

  it("should handle invalid grade gracefully", () => {
    const invalidGradeAction = () =>
      nextReview(now, initialState, "InvalidGrade" as Grade);
    expect(invalidGradeAction).toThrow("Invalid grade: InvalidGrade");
  });
});
