import { describe, expect, test } from "@jest/globals";

import { keyOf } from "../../src/modes/guided/deck";

describe("guided deck utils", () => {
  test("keyOf builds stable id", () => {
    const card = { piece: "T", rot: "left", x: 3 as unknown as any } as const;
    expect(keyOf(card)).toBeDefined();
    expect(String(keyOf(card))).toContain("T:left:3");
  });
});

