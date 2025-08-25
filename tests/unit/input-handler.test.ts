import { normalizeInputSequence } from "../../src/input/handler";
import { InputEvent } from "../../src/state/types";

describe("normalizeInputSequence", () => {
  test("cancels opposite inputs within window", () => {
    const t = 1000;
    const events: InputEvent[] = [
      { tMs: t, frame: 1, action: "LeftDown" },
      { tMs: t + 40, frame: 2, action: "RightDown" }, // within 50ms window
      { tMs: t + 200, frame: 3, action: "RotateCW" },
    ];
    const out = normalizeInputSequence(events, 50);
    expect(out).toEqual(["RotateCW"]);
  });

  test("keeps inputs outside cancel window", () => {
    const t = 1000;
    const events: InputEvent[] = [
      { tMs: t, frame: 1, action: "LeftDown" },
      { tMs: t + 80, frame: 2, action: "RightDown" }, // outside 50ms window
    ];
    const out = normalizeInputSequence(events, 50);
    expect(out).toEqual(["LeftDown", "RightDown"]);
  });

  test("handles multiple cancellation pairs", () => {
    const t = 1000;
    const events: InputEvent[] = [
      { tMs: t, frame: 1, action: "LeftDown" },
      { tMs: t + 10, frame: 2, action: "RightDown" }, // cancels with LeftDown
      { tMs: t + 100, frame: 3, action: "RightDown" },
      { tMs: t + 120, frame: 4, action: "LeftDown" }, // cancels with second RightDown
      { tMs: t + 200, frame: 5, action: "RotateCW" },
    ];
    const out = normalizeInputSequence(events, 50);
    expect(out).toEqual(["RotateCW"]);
  });

  test("preserves non-movement actions", () => {
    const t = 1000;
    const events: InputEvent[] = [
      { tMs: t, frame: 1, action: "RotateCW" },
      { tMs: t + 10, frame: 2, action: "RotateCCW" },
      { tMs: t + 20, frame: 3, action: "HardDrop" },
      { tMs: t + 30, frame: 4, action: "Hold" },
    ];
    const out = normalizeInputSequence(events, 50);
    expect(out).toEqual(["RotateCW", "RotateCCW", "HardDrop", "Hold"]);
  });
});
