import { describe, it, expect } from "@jest/globals";

import {
  type GuidedCard,
  canonicalId,
  initRecord,
  pickNextDue,
  type SrsDeck,
  type SrsRecord,
} from "../../../../src/modes/guided/srs/fsrs-adapter";
import { createDeckId, createColumn } from "../../../../src/modes/guided/types";
import { createTimestamp } from "../../../../src/types/timestamp";

describe("fsrs-adapter tie-breakers", () => {
  const now = createTimestamp(1000);

  function makeDeckFromRecords(records: Array<SrsRecord>): SrsDeck {
    const items = new Map(records.map((r) => [r.key, r]));
    return {
      id: createDeckId("test"),
      items,
      params: { maxNewPerSession: 50 },
    };
  }

  it("prefers due cards over not-due cards", () => {
    const a: GuidedCard = { piece: "I", rot: "spawn", x: createColumn(3) };
    const b: GuidedCard = { piece: "J", rot: "spawn", x: createColumn(3) };
    const recA = initRecord(a, createTimestamp((now as number) + 5000)); // not due
    const recB = initRecord(b, now); // due

    const deck = makeDeckFromRecords([recA, recB]);
    const picked = pickNextDue(deck, now);
    expect(picked?.key).toBe(canonicalId(b));
  });

  it("uses earliest due time when both are due", () => {
    const a: GuidedCard = { piece: "S", rot: "spawn", x: createColumn(4) };
    const b: GuidedCard = { piece: "Z", rot: "spawn", x: createColumn(4) };
    const recEarly = initRecord(a, createTimestamp((now as number) - 10));
    const recLate = initRecord(b, createTimestamp((now as number) - 5));

    const deck = makeDeckFromRecords([recLate, recEarly]);
    const picked = pickNextDue(deck, now);
    expect(picked?.key).toBe(canonicalId(a)); // earliest due wins
  });

  it("breaks ties lexicographically when due times are equal", () => {
    const a: GuidedCard = { piece: "I", rot: "spawn", x: createColumn(1) }; // key starts with I
    const z: GuidedCard = { piece: "Z", rot: "spawn", x: createColumn(1) }; // key starts with Z
    const recI = initRecord(a, now);
    const recZ = initRecord(z, now);

    // Force equal due explicitly to avoid scheduler variance
    const recIEqual: SrsRecord = { ...recI, due: now };
    const recZEqual: SrsRecord = { ...recZ, due: now };
    const deck = makeDeckFromRecords([recZEqual, recIEqual]);
    const picked = pickNextDue(deck, now);

    // Lexicographically, "I:..." < "Z:..."
    expect(picked?.key).toBe(canonicalId(a));
  });
});
