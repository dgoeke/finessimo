import { describe, test, expect } from "@jest/globals";

import { PIECES } from "../../../src/core/pieces";
import { validColumns } from "../../../src/modes/guided/deck";

import type { Rot } from "../../../src/state/types";

describe("Guided deck column generation", () => {
  const rots: Array<Rot> = ["spawn", "right", "two", "left"];

  test("validColumns only yields x where all absolute cells are in [0,9]", () => {
    for (const [pieceId, shape] of Object.entries(PIECES)) {
      for (const rot of rots) {
        // Skip collapsed rotations for O
        if (pieceId === "O" && rot !== "spawn") continue;
        const cols = validColumns(pieceId as keyof typeof PIECES, rot);
        const cells = shape.cells[rot];
        for (const x of cols) {
          const base = x as unknown as number;
          for (const [dx] of cells) {
            const ax = base + dx;
            expect(ax).toBeGreaterThanOrEqual(0);
            expect(ax).toBeLessThanOrEqual(9);
          }
        }
      }
    }
  });

  test("rightmost column equals 9 - maxDx for each rotation", () => {
    for (const [pieceId, shape] of Object.entries(PIECES)) {
      for (const rot of rots) {
        if (pieceId === "O" && rot !== "spawn") continue;
        const cols = validColumns(pieceId as keyof typeof PIECES, rot);
        const maxDx = Math.max(...shape.cells[rot].map(([dx]) => dx));
        const expectedMax = 9 - maxDx;
        const last = cols[cols.length - 1] as unknown as number;
        expect(last).toBe(expectedMax);
      }
    }
  });
});
