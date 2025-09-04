// Spaced repetition scheduler for scenario system
// Chapter 2: SM-2-like algorithm for scheduling scenario reviews

import { createDurationMs, durationMsAsNumber } from "../types/brands";
import {
  asNumber as timestampAsNumber,
  createTimestamp,
} from "../types/timestamp";

import type { DurationMs } from "../types/brands";
import type { Timestamp } from "../types/timestamp";

// Grade for user performance on a scenario
export type Grade = "Again" | "Hard" | "Good" | "Easy";

// Review state for tracking spaced repetition
export type ReviewState = Readonly<{
  ease: number; // ease factor (1.3 - 2.8, higher = longer intervals)
  interval: DurationMs; // time until next review
  due: Timestamp; // when this item is due for review
}>;

// Default initial values for new reviews
const DEFAULT_EASE = 2.5;
const INITIAL_INTERVAL_MS = 1000 * 60; // 1 minute
const MIN_EASE = 1.3;
const MAX_EASE = 2.8;

/**
 * Create initial review state for a new scenario
 * @param now Current timestamp
 * @returns Initial ReviewState with default values
 */
export function createInitialReviewState(now: Timestamp): ReviewState {
  const initialInterval = createDurationMs(INITIAL_INTERVAL_MS);
  const due = createTimestamp(timestampAsNumber(now) + INITIAL_INTERVAL_MS);

  return {
    due,
    ease: DEFAULT_EASE,
    interval: initialInterval,
  };
}

/**
 * Calculate next review state based on user performance
 * Implements SM-2-like algorithm with bounded ease factor
 * @param now Current timestamp
 * @param prev Previous review state
 * @param grade User performance grade
 * @returns Updated ReviewState for next review
 */
export function nextReview(
  now: Timestamp,
  prev: ReviewState,
  grade: Grade,
): ReviewState {
  let newEase = prev.ease;
  let intervalMultiplier: number;

  // Adjust ease factor and determine interval multiplier based on grade
  switch (grade) {
    case "Again":
      // Reset to short interval, decrease ease factor
      newEase = Math.max(MIN_EASE, prev.ease - 0.2);
      intervalMultiplier = 0.0; // Will be overridden to minimum
      break;

    case "Hard":
      // Slight decrease in ease, modest interval increase
      newEase = Math.max(MIN_EASE, prev.ease - 0.15);
      intervalMultiplier = 1.2;
      break;

    case "Good":
      // Standard interval multiplication with current ease
      intervalMultiplier = newEase;
      break;

    case "Easy":
      // Increase ease factor, longer interval multiplication
      newEase = Math.min(MAX_EASE, prev.ease + 0.15);
      intervalMultiplier = newEase * 1.3;
      break;

    default: {
      // Type guard - should never reach here with proper typing
      const exhaustiveCheck: never = grade;
      throw new Error(`Invalid grade: ${String(exhaustiveCheck)}`);
    }
  }

  // Calculate new interval
  let newIntervalMs: number;
  if (grade === "Again") {
    // Reset to short interval (1 minute)
    newIntervalMs = INITIAL_INTERVAL_MS;
  } else {
    const prevIntervalMs = durationMsAsNumber(prev.interval);
    newIntervalMs = Math.round(prevIntervalMs * intervalMultiplier);

    // Ensure minimum interval of 1 minute
    newIntervalMs = Math.max(newIntervalMs, INITIAL_INTERVAL_MS);

    // Cap maximum interval at 30 days for practical reasons
    const maxIntervalMs = 30 * 24 * 60 * 60 * 1000; // 30 days
    newIntervalMs = Math.min(newIntervalMs, maxIntervalMs);
  }

  const newInterval = createDurationMs(newIntervalMs);
  const newDue = createTimestamp(timestampAsNumber(now) + newIntervalMs);

  return {
    due: newDue,
    ease: newEase,
    interval: newInterval,
  };
}

/**
 * Check if a review is due
 * @param state ReviewState to check
 * @param now Current timestamp
 * @returns True if review is due or overdue
 */
export function isReviewDue(state: ReviewState, now: Timestamp): boolean {
  return timestampAsNumber(state.due) <= timestampAsNumber(now);
}

/**
 * Get time remaining until review is due
 * @param state ReviewState to check
 * @param now Current timestamp
 * @returns DurationMs until due (0 if overdue)
 */
export function timeUntilDue(state: ReviewState, now: Timestamp): DurationMs {
  const remainingMs = timestampAsNumber(state.due) - timestampAsNumber(now);
  return createDurationMs(Math.max(0, remainingMs));
}

/**
 * Calculate how overdue a review is
 * @param state ReviewState to check
 * @param now Current timestamp
 * @returns DurationMs overdue (0 if not overdue)
 */
export function overdueTime(state: ReviewState, now: Timestamp): DurationMs {
  const overdueMs = timestampAsNumber(now) - timestampAsNumber(state.due);
  return createDurationMs(Math.max(0, overdueMs));
}

/**
 * Type guard to validate ReviewState
 * @param obj Object to check
 * @returns True if object is a valid ReviewState
 */
export function isValidReviewState(obj: unknown): obj is ReviewState {
  if (obj === null || obj === undefined || typeof obj !== "object") {
    return false;
  }

  const state = obj as Record<string, unknown>;

  return (
    typeof state["ease"] === "number" &&
    state["ease"] >= MIN_EASE &&
    state["ease"] <= MAX_EASE &&
    typeof state["interval"] === "number" &&
    state["interval"] >= 0 &&
    typeof state["due"] === "number" &&
    state["due"] > 0
  );
}

/**
 * Get human-readable description of interval
 * @param interval DurationMs interval
 * @returns String description of the interval
 */
export function describeInterval(interval: DurationMs): string {
  const ms = durationMsAsNumber(interval);
  const seconds = ms / 1000;
  const minutes = seconds / 60;
  const hours = minutes / 60;
  const days = hours / 24;

  if (days >= 1) {
    const dayCount = Math.round(days);
    return dayCount === 1 ? "1 day" : `${dayCount.toString()} days`;
  } else if (hours >= 1) {
    const hourCount = Math.round(hours);
    return hourCount === 1 ? "1 hour" : `${hourCount.toString()} hours`;
  } else if (minutes >= 1) {
    const minuteCount = Math.round(minutes);
    return minuteCount === 1 ? "1 minute" : `${minuteCount.toString()} minutes`;
  } else {
    const secondCount = Math.round(seconds);
    return secondCount === 1 ? "1 second" : `${secondCount.toString()} seconds`;
  }
}
