import { describe, test, expect } from "@jest/globals";

import { PIECES } from "@/core/pieces";
import { validColumns, ROTATION_CLASSES } from "@/modes/guided/deck";

import type { PieceId, Rot } from "@/state/types";

describe("Guided mode left wall placement", () => {
  test("all pieces can be placed flush against left wall when physically possible", () => {
    // Test each piece and rotation to see if it can be placed flush against left wall
    const results: Array<{
      piece: PieceId;
      rotation: Rot;
      canBeFlushLeft: boolean;
      validColumns: Array<number>;
      minValidColumn: number;
      expectedMinColumn: number;
    }> = [];

    for (const [pieceId, rotations] of Object.entries(
      ROTATION_CLASSES,
    ) as Array<[PieceId, Array<Rot>]>) {
      for (const rot of rotations) {
        const cells = PIECES[pieceId].cells[rot];
        const minDx = Math.min(...cells.map(([x]) => x));

        // A piece can be flush against left wall if we can position it such that
        // the leftmost cell (min board position) is at board column 0
        // This happens when piece.x + minDx = 0, so piece.x = -minDx
        const flushLeftPieceX = -minDx;
        const canBeFlushLeft = flushLeftPieceX >= -10; // reasonable constraint

        const validCols = validColumns(pieceId, rot);
        const validColNumbers = validCols.map((col) => col as number);
        const minValidColumn = Math.min(...validColNumbers);

        // For pieces that can be flush left, we expect minValidColumn to allow
        // the leftmost cell to be at board position 0
        const expectedMinColumn = canBeFlushLeft
          ? flushLeftPieceX
          : Math.max(0, -minDx);

        results.push({
          canBeFlushLeft,
          expectedMinColumn,
          minValidColumn,
          piece: pieceId,
          rotation: rot,
          validColumns: validColNumbers,
        });

        // Test specific expectations for pieces that should be flush against left wall
        if (canBeFlushLeft) {
          // The leftmost cell should be able to be at board position 0
          const leftmostBoardPosition = minValidColumn + minDx;
          expect(leftmostBoardPosition).toBeLessThanOrEqual(0);

          // More specifically, we want at least one valid position where leftmost cell is at x=0
          expect(minValidColumn).toBeLessThanOrEqual(-minDx);
        }
      }
    }

    // Ensure we have results for all expected pieces/rotations
    expect(results.length).toBeGreaterThan(0);
  });

  test("I-piece vertical rotation can be placed flush against left wall", () => {
    // I-piece "left" rotation has cells at dx=1, so at piece.x=-1, leftmost cell is at board x=0
    const leftRotationCols = validColumns("I", "left");
    const leftColNumbers = leftRotationCols.map((col) => col as number);
    expect(Math.min(...leftColNumbers)).toBeLessThanOrEqual(-1);
  });

  test("O-piece can be placed flush against left wall", () => {
    // O-piece has cells at dx=[1,2], so at piece.x=-1, leftmost cell is at board x=0
    const oCols = validColumns("O", "spawn");
    const oColNumbers = oCols.map((col) => col as number);
    expect(Math.min(...oColNumbers)).toBeLessThanOrEqual(-1);
  });
});
