import { describe, it, expect } from "@jest/globals";

import { OnePieceRng, SequenceRng } from "../../src/core/other-rngs";

import type { PieceId } from "../../src/state/types";

describe("other-rngs (OnePieceRng, SequenceRng)", () => {
  it("OnePieceRng returns the same piece and same instance", () => {
    const rng = new OnePieceRng("T");
    const r1 = rng.getNextPiece();
    const r2 = rng.getNextPieces(3);
    expect(r1.piece).toBe("T");
    expect(r1.newRng).toBe(rng);
    expect(r2.pieces).toEqual(["T", "T", "T"] satisfies Array<PieceId>);
    expect(r2.newRng).toBe(rng);
  });

  it("SequenceRng cycles through the sequence immutably", () => {
    const seq: Array<PieceId> = ["I", "O", "T"]; // length 3
    const rng = new SequenceRng(seq);

    const p1 = rng.getNextPiece();
    expect(p1.piece).toBe("I");
    expect(p1.newRng).not.toBe(rng);

    const p2 = p1.newRng.getNextPiece();
    expect(p2.piece).toBe("O");

    const p3 = p2.newRng.getNextPiece();
    expect(p3.piece).toBe("T");

    const p4 = p3.newRng.getNextPiece();
    expect(p4.piece).toBe("I"); // wrapped
  });

  it("SequenceRng getNextPieces returns contiguous sequence and advanced rng", () => {
    const seq: Array<PieceId> = ["J", "L"]; // length 2
    const rng = new SequenceRng(seq);

    const r = rng.getNextPieces(5);
    expect(r.pieces).toEqual(["J", "L", "J", "L", "J"]);

    const r2 = r.newRng.getNextPieces(3);
    expect(r2.pieces).toEqual(["L", "J", "L"]);
  });

  it("SequenceRng throws on empty sequence and invalid index access", () => {
    expect(() => new SequenceRng([])).toThrow();
    // Construct with out-of-bounds index; error should surface on use
    const bad = new SequenceRng(["S"], 999);
    expect(() => bad.getNextPiece()).toThrow();
  });
});
