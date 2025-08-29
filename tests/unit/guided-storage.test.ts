import { describe, test, expect, beforeEach } from "@jest/globals";

import { serialize } from "../../src/srs/fsrs-adapter";
import { loadGuidedDeck, saveGuidedDeck } from "../../src/srs/storage";
import { createTimestamp } from "../../src/types/timestamp";

describe("Guided deck persistence", () => {
  beforeEach(() => {
    // Clear storage for isolated tests
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
  });

  test("load returns default deck when storage is empty, and save+load roundtrips", () => {
    const now = createTimestamp(1);
    const deck = loadGuidedDeck(now);
    expect(deck.items.size).toBeGreaterThan(0);

    // Persist and reload
    saveGuidedDeck(deck);
    const reloaded = loadGuidedDeck(now);

    // Compare persisted form for stable equality
    const a = serialize(deck);
    const b = serialize(reloaded);
    expect(b.deck.id).toEqual(a.deck.id);
    expect(Object.keys(b.deck.items).length).toEqual(
      Object.keys(a.deck.items).length,
    );
  });

  test("migration fallback when version is wrong returns default deck", () => {
    const now = createTimestamp(2);
    // Store an invalid/old version payload
    localStorage.setItem(
      "finessimo/guided/fsrs/v1",
      JSON.stringify({ deck: {}, version: 0 }),
    );
    const deck = loadGuidedDeck(now);
    expect(deck.items.size).toBeGreaterThan(0);
  });

  test("deserialize tolerates unknown fields and still loads", () => {
    const now = createTimestamp(3);
    const deck = loadGuidedDeck(now);
    const persisted = serialize(deck);
    const mutated = {
      ...persisted,
      deck: { ...persisted.deck, extra2: 123 },
      extra: "ignore-me",
    } as unknown as ReturnType<typeof serialize>;
    localStorage.setItem(
      "finessimo/guided/fsrs/v1",
      JSON.stringify(mutated as unknown),
    );
    const reloaded = loadGuidedDeck(now);
    expect(reloaded.items.size).toBeGreaterThan(0);
  });

  test("sanitizes invalid cards on load (filters out-of-bounds x)", () => {
    const now = createTimestamp(4);
    // Craft a persisted v1 payload with an invalid card for S at 'right' with x beyond legal bound
    const persisted = {
      deck: {
        id: "test-deck",
        items: {
          // For S-right, maxDx is 2, so max x is 7; x=9 is invalid
          "S:right:9": {
            card: { piece: "S", rot: "right", x: 9 },
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
    // Sanitizer should remove the invalid entry
    expect(deck.items.size).toBe(0);
  });
});
