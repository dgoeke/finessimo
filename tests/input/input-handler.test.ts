import { normalizeInputSequence } from "../../src/input/handler";
import { type InputEvent } from "../../src/state/types";
import { createFrame } from "../../src/types/brands";
import { createTimestamp } from "../../src/types/timestamp";

describe("normalizeInputSequence", () => {
  test("cancels opposite inputs within window", () => {
    const t = 1000;
    const events: Array<InputEvent> = [
      { action: "LeftDown", frame: createFrame(1), tMs: createTimestamp(t) },
      {
        action: "RightDown",
        frame: createFrame(2),
        tMs: createTimestamp(t + 40),
      }, // within 50ms window
      {
        action: "RotateCW",
        frame: createFrame(3),
        tMs: createTimestamp(t + 200),
      },
    ];
    const out = normalizeInputSequence(events, 50);
    expect(out).toEqual(["RotateCW"]);
  });

  test("keeps inputs outside cancel window", () => {
    const t = 1000;
    const events: Array<InputEvent> = [
      { action: "LeftDown", frame: createFrame(1), tMs: createTimestamp(t) },
      {
        action: "RightDown",
        frame: createFrame(2),
        tMs: createTimestamp(t + 80),
      }, // outside 50ms window
    ];
    const out = normalizeInputSequence(events, 50);
    expect(out).toEqual(["LeftDown", "RightDown"]);
  });

  test("handles multiple cancellation pairs", () => {
    const t = 1000;
    const events: Array<InputEvent> = [
      { action: "LeftDown", frame: createFrame(1), tMs: createTimestamp(t) },
      {
        action: "RightDown",
        frame: createFrame(2),
        tMs: createTimestamp(t + 10),
      }, // cancels with LeftDown
      {
        action: "RightDown",
        frame: createFrame(3),
        tMs: createTimestamp(t + 100),
      },
      {
        action: "LeftDown",
        frame: createFrame(4),
        tMs: createTimestamp(t + 120),
      }, // cancels with second RightDown
      {
        action: "RotateCW",
        frame: createFrame(5),
        tMs: createTimestamp(t + 200),
      },
    ];
    const out = normalizeInputSequence(events, 50);
    expect(out).toEqual(["RotateCW"]);
  });

  test("preserves non-movement actions", () => {
    const t = 1000;
    const events: Array<InputEvent> = [
      { action: "RotateCW", frame: createFrame(1), tMs: createTimestamp(t) },
      {
        action: "RotateCCW",
        frame: createFrame(2),
        tMs: createTimestamp(t + 10),
      },
      {
        action: "HardDrop",
        frame: createFrame(3),
        tMs: createTimestamp(t + 20),
      },
      { action: "Hold", frame: createFrame(4), tMs: createTimestamp(t + 30) },
    ];
    const out = normalizeInputSequence(events, 50);
    expect(out).toEqual(["RotateCW", "RotateCCW", "HardDrop", "Hold"]);
  });
});
