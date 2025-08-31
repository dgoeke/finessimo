import { describe, test, expect } from "@jest/globals";

import { ROTATION_CLASSES, generateCards } from "../../src/modes/guided/deck";

describe("Fix for S/Z guidance issue", () => {
  test("S and Z pieces should only use spawn rotation to eliminate equivalence confusion", () => {
    // Verify that S and Z pieces only use spawn rotation in their representative sets
    expect(ROTATION_CLASSES.S).toEqual(["spawn"]);
    expect(ROTATION_CLASSES.Z).toEqual(["spawn"]);

    // Verify that the generated cards only include spawn rotation for S and Z
    const cards = generateCards();
    const sCards = cards.filter((card) => card.piece === "S");
    const zCards = cards.filter((card) => card.piece === "Z");

    // All S cards should use spawn rotation
    const sRotations = [...new Set(sCards.map((card) => card.rot))];
    expect(sRotations).toEqual(["spawn"]);

    // All Z cards should use spawn rotation
    const zRotations = [...new Set(zCards.map((card) => card.rot))];
    expect(zRotations).toEqual(["spawn"]);

    // Verify we have fewer cards than before (was 17 each, now should be 8 each)
    expect(sCards.length).toBe(8); // Only spawn rotation positions
    expect(zCards.length).toBe(8); // Only spawn rotation positions
  });

  test("Other pieces should retain their full rotation sets", () => {
    // Ensure other pieces are not affected by the S/Z fix
    expect(ROTATION_CLASSES.I).toEqual(["spawn", "left"]);
    expect(ROTATION_CLASSES.J).toEqual(["spawn", "right", "two", "left"]);
    expect(ROTATION_CLASSES.L).toEqual(["spawn", "right", "two", "left"]);
    expect(ROTATION_CLASSES.O).toEqual(["spawn"]);
    expect(ROTATION_CLASSES.T).toEqual(["spawn", "right", "two", "left"]);
  });

  test("Total card count should be reduced by eliminating duplicate S/Z cards", () => {
    const cards = generateCards();

    // With the fix, we should have:
    // I: 17 cards (spawn + left)
    // O: 9 cards (spawn only)
    // T: 34 cards (all 4 rotations)
    // S: 8 cards (spawn only, was 17)
    // Z: 8 cards (spawn only, was 17)
    // J: 34 cards (all 4 rotations)
    // L: 34 cards (all 4 rotations)
    // Total: 144 cards (was 162)

    const cardsByPiece = cards.reduce<Record<string, number>>((acc, card) => {
      const currentCount = acc[card.piece] ?? 0;
      acc[card.piece] = currentCount + 1;
      return acc;
    }, {});

    expect(cardsByPiece["S"]).toBe(8);
    expect(cardsByPiece["Z"]).toBe(8);
    expect(cards.length).toBe(144); // Total reduced from 162
  });
});
