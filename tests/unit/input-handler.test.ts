import { normalizeInputSequence } from "../../src/input/handler";
import { type InputEvent } from "../../src/state/types";

describe("normalizeInputSequence", () => {
  test("cancels opposite inputs within window", () => {
    const t = 1000;
    const events: Array<InputEvent> = [
      { action: "LeftDown", frame: 1, tMs: t },
      { action: "RightDown", frame: 2, tMs: t + 40 }, // within 50ms window
      { action: "RotateCW", frame: 3, tMs: t + 200 },
    ];
    const out = normalizeInputSequence(events, 50);
    expect(out).toEqual(["RotateCW"]);
  });

  test("keeps inputs outside cancel window", () => {
    const t = 1000;
    const events: Array<InputEvent> = [
      { action: "LeftDown", frame: 1, tMs: t },
      { action: "RightDown", frame: 2, tMs: t + 80 }, // outside 50ms window
    ];
    const out = normalizeInputSequence(events, 50);
    expect(out).toEqual(["LeftDown", "RightDown"]);
  });

  test("handles multiple cancellation pairs", () => {
    const t = 1000;
    const events: Array<InputEvent> = [
      { action: "LeftDown", frame: 1, tMs: t },
      { action: "RightDown", frame: 2, tMs: t + 10 }, // cancels with LeftDown
      { action: "RightDown", frame: 3, tMs: t + 100 },
      { action: "LeftDown", frame: 4, tMs: t + 120 }, // cancels with second RightDown
      { action: "RotateCW", frame: 5, tMs: t + 200 },
    ];
    const out = normalizeInputSequence(events, 50);
    expect(out).toEqual(["RotateCW"]);
  });

  test("preserves non-movement actions", () => {
    const t = 1000;
    const events: Array<InputEvent> = [
      { action: "RotateCW", frame: 1, tMs: t },
      { action: "RotateCCW", frame: 2, tMs: t + 10 },
      { action: "HardDrop", frame: 3, tMs: t + 20 },
      { action: "Hold", frame: 4, tMs: t + 30 },
    ];
    const out = normalizeInputSequence(events, 50);
    expect(out).toEqual(["RotateCW", "RotateCCW", "HardDrop", "Hold"]);
  });
});
