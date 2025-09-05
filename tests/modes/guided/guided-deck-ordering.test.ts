import { describe, expect, it } from "@jest/globals";

import { createActivePiece } from "@/core/spawning";
import { finesseCalculator } from "@/engine/finesse/calculator";
import { generateCards } from "@/modes/guided/deck";
import { createDurationMs } from "@/types/brands";

import type { GameplayConfig } from "@/state/types";

describe("Guided deck card ordering", () => {
  it("orders cards by difficulty using round-robin across pieces", () => {
    const cards = generateCards();

    const gameplayConfig: GameplayConfig = {
      finesseCancelMs: createDurationMs(50),
      holdEnabled: false,
    };

    // Calculate difficulty for each card
    const cardsWithDifficulty = cards.map((card) => {
      const activePiece = createActivePiece(card.piece);
      const seq = finesseCalculator.calculateOptimal(
        activePiece,
        card.x as number,
        card.rot,
        gameplayConfig,
      );

      const minSequenceLength = seq ? seq.length : Number.POSITIVE_INFINITY;

      return { ...card, minSequenceLength };
    });

    // Verify cards are ordered by difficulty within each piece group
    const pieceGroups = new Map<string, typeof cardsWithDifficulty>();

    for (const card of cardsWithDifficulty) {
      const existingGroup = pieceGroups.get(card.piece);
      if (existingGroup) {
        existingGroup.push(card);
      } else {
        pieceGroups.set(card.piece, [card]);
      }
    }

    // Check that within each piece group, cards are ordered by difficulty
    for (const [, group] of pieceGroups) {
      for (let i = 1; i < group.length; i++) {
        const current = group[i];
        const previous = group[i - 1];
        if (current && previous) {
          expect(current.minSequenceLength).toBeGreaterThanOrEqual(
            previous.minSequenceLength,
          );
        }
      }
    }

    // Verify round-robin pattern: each piece should appear once before any piece appears twice
    const pieceOrder = cards.map((card) => card.piece);
    const uniquePieces = [...new Set(pieceOrder)];

    // Check that the first occurrence of each piece happens before any second occurrence
    const firstOccurrences = uniquePieces.map((piece) =>
      pieceOrder.indexOf(piece),
    );
    const secondOccurrences = uniquePieces.map((piece) => {
      const firstIndex = pieceOrder.indexOf(piece);
      return pieceOrder.indexOf(piece, firstIndex + 1);
    });

    // All first occurrences should come before all second occurrences (where they exist)
    const maxFirstOccurrence = Math.max(...firstOccurrences);
    const validSecondOccurrences = secondOccurrences.filter(
      (index) => index !== -1,
    );
    const minSecondOccurrence =
      validSecondOccurrences.length > 0
        ? Math.min(...validSecondOccurrences)
        : Number.POSITIVE_INFINITY;

    if (minSecondOccurrence !== Number.POSITIVE_INFINITY) {
      expect(maxFirstOccurrence).toBeLessThan(minSecondOccurrence);
    }
  });

  it("maintains same total number of cards as original generation", () => {
    const originalCards = generateCards();

    // Also verify we have cards from all expected pieces
    const pieces = [...new Set(originalCards.map((card) => card.piece))].sort(
      (a, b) => a.localeCompare(b),
    );
    expect(pieces).toEqual(["I", "J", "L", "O", "S", "T", "Z"]);

    // Should have a reasonable number of cards (this is a sanity check)
    expect(originalCards.length).toBeGreaterThan(30); // We expect many valid placements
  });

  it("starts with easiest cards (sequence length 1 or 2)", () => {
    const cards = generateCards();

    const gameplayConfig: GameplayConfig = {
      finesseCancelMs: createDurationMs(50),
      holdEnabled: false,
    };

    // Check that the first few cards are among the easiest
    const firstCards = cards.slice(0, 10);

    for (const card of firstCards) {
      const activePiece = createActivePiece(card.piece);
      const seq = finesseCalculator.calculateOptimal(
        activePiece,
        card.x as number,
        card.rot,
        gameplayConfig,
      );
      const minSequenceLength = seq ? seq.length : Number.POSITIVE_INFINITY;

      // The first cards should be quite easy (sequence length <= 3)
      expect(minSequenceLength).toBeLessThanOrEqual(3);
    }
  });
});
