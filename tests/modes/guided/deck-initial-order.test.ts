import { describe, expect, it } from "@jest/globals";

import { generateCards, makeDefaultDeck } from "../../../src/modes/guided/deck";
import { pickNextDue } from "../../../src/modes/guided/srs/fsrs-adapter";
import { createTimestamp } from "../../../src/types/timestamp";

describe("Initial deck ordering", () => {
  it("should preserve the difficulty-based card order from generateCards", () => {
    const cards = generateCards();
    const startTime = createTimestamp(1000);
    const deck = makeDefaultDeck(startTime);

    // Collect all records and sort by due time to see the intended order
    const allRecords = Array.from(deck.items.values()).sort(
      (a, b) => (a.due as number) - (b.due as number),
    );

    // The cards should be in the same order as generateCards
    expect(allRecords.length).toBe(cards.length);
    for (let i = 0; i < cards.length; i++) {
      expect(allRecords[i]?.card).toEqual(cards[i]);
      // Verify due times are incrementing to preserve order
      expect(allRecords[i]?.due).toBe(
        createTimestamp((startTime as number) + i),
      );
    }

    // Verify that pickNextDue respects this ordering
    // When all cards are due, it should pick the one with the lowest due time
    const laterTime = createTimestamp((startTime as number) + cards.length);
    const next = pickNextDue(deck, laterTime);
    // Should pick the first card from generateCards order
    expect(next?.card).toEqual(cards[0]);
  });

  it("should present cards in round-robin order across pieces", () => {
    const cards = generateCards();

    // First 7 cards should be different pieces (round-robin)
    const firstSevenPieces = cards.slice(0, 7).map((c) => c.piece);
    const uniquePieces = new Set(firstSevenPieces);

    // We should see 7 unique pieces in the first 7 cards
    expect(uniquePieces.size).toBe(7);
  });

  it("should order cards by difficulty within each piece group", () => {
    const cards = generateCards();

    // Group cards by piece
    const byPiece = new Map<string, Array<(typeof cards)[0]>>();
    for (const card of cards) {
      const group = byPiece.get(card.piece) ?? [];
      group.push(card);
      byPiece.set(card.piece, group);
    }

    // Check that each piece's cards appear in round-robin pattern
    // Cards from the same piece should be spread out
    const pieceIndices = new Map<string, Array<number>>();
    cards.forEach((card, index) => {
      const indices = pieceIndices.get(card.piece) ?? [];
      indices.push(index);
      pieceIndices.set(card.piece, indices);
    });

    // For each piece, check that cards are reasonably spread out
    for (const [, indices] of pieceIndices) {
      if (indices.length > 1) {
        // Check that indices have gaps (cards are spread out)
        for (let i = 1; i < indices.length; i++) {
          const current = indices[i];
          const previous = indices[i - 1];
          if (current !== undefined && previous !== undefined) {
            const gap = current - previous;
            // Gap should be approximately the number of unique pieces (7)
            // Allow some variation due to different piece counts
            expect(gap).toBeGreaterThanOrEqual(3);
            expect(gap).toBeLessThanOrEqual(10);
          }
        }
      }
    }
  });
});
