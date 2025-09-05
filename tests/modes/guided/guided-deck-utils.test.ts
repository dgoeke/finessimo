import { describe, expect, test } from "@jest/globals";

import { keyOf } from "@/modes/guided/deck";
import { createColumn } from "@/modes/guided/types";

describe("guided deck utils", () => {
  test("keyOf builds stable id", () => {
    const card = { piece: "T", rot: "left", x: createColumn(3) } as const;
    expect(keyOf(card)).toBeDefined();
    expect(String(keyOf(card))).toContain("T:left:3");
  });
});
