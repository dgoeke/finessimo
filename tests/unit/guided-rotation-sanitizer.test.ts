import { describe, test, expect, beforeEach } from "@jest/globals";

import { loadGuidedDeck } from "../../src/srs/storage";
import { createTimestamp } from "../../src/types/timestamp";

describe("Guided deck rotation sanitization", () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
  });

  test("filters non-representative rotations (S/Z/I two/right; O right)", () => {
    const now = createTimestamp(10);

    // Craft a persisted v1 payload with non-representative rotations
    // Keep x values within bounds so column filter passes; rotation filter should remove them.
    const persisted = {
      deck: {
        id: "test-deck-rotations",
        items: {
          "I:left:4": {
            card: { piece: "I", rot: "left", x: 4 },
            due: now as unknown as number,
            fsrs: {
              card: { due: new Date(now as unknown as number).toISOString() },
            },
          },
          "I:right:4": {
            card: { piece: "I", rot: "right", x: 4 },
            due: now as unknown as number,
            fsrs: {
              card: { due: new Date(now as unknown as number).toISOString() },
            },
          },
          "I:spawn:4": {
            card: { piece: "I", rot: "spawn", x: 4 },
            due: now as unknown as number,
            fsrs: {
              card: { due: new Date(now as unknown as number).toISOString() },
            },
          },
          "O:right:4": {
            card: { piece: "O", rot: "right", x: 4 },
            due: now as unknown as number,
            fsrs: {
              card: { due: new Date(now as unknown as number).toISOString() },
            },
          },
          "O:spawn:4": {
            card: { piece: "O", rot: "spawn", x: 4 },
            due: now as unknown as number,
            fsrs: {
              card: { due: new Date(now as unknown as number).toISOString() },
            },
          },
          // Allowed examples (should remain)
          "S:spawn:4": {
            card: { piece: "S", rot: "spawn", x: 4 },
            due: now as unknown as number,
            fsrs: {
              card: { due: new Date(now as unknown as number).toISOString() },
            },
          },
          // Disallowed by rotation-class filter
          "S:two:4": {
            card: { piece: "S", rot: "two", x: 4 },
            due: now as unknown as number,
            fsrs: {
              card: { due: new Date(now as unknown as number).toISOString() },
            },
          },
          "Z:left:4": {
            card: { piece: "Z", rot: "left", x: 4 },
            due: now as unknown as number,
            fsrs: {
              card: { due: new Date(now as unknown as number).toISOString() },
            },
          },
          "Z:right:4": {
            card: { piece: "Z", rot: "right", x: 4 },
            due: now as unknown as number,
            fsrs: {
              card: { due: new Date(now as unknown as number).toISOString() },
            },
          },
        },
        params: { maxNewPerSession: 50 },
      },
      version: 1 as const,
    };

    localStorage.setItem("finessimo/guided/fsrs/v1", JSON.stringify(persisted));

    const deck = loadGuidedDeck(now);

    // Expect only the allowed entries to remain
    const remainingKeys = Array.from(deck.items.keys()).sort();
    expect(remainingKeys).toEqual(
      ["I:left:4", "I:spawn:4", "O:spawn:4", "S:spawn:4", "Z:left:4"].sort(),
    );
  });
});
