import { normalizeInputSequence } from "../../src/input/handler";
import { type InputEvent, type KeyAction } from "../../src/state/types";
import { createFrame } from "../../src/types/brands";
import { createTimestamp } from "../../src/types/timestamp";

describe("Input Normalization", () => {
  const createInputEvent = (action: KeyAction, tMs: number): InputEvent => ({
    action,
    frame: createFrame(Math.floor(tMs / 16.67)), // Approximate frame based on timestamp
    tMs: createTimestamp(tMs),
  });

  describe("normalizeInputSequence", () => {
    it("should keep all clean finesse actions", () => {
      const events: Array<InputEvent> = [
        createInputEvent("LeftDown", 100),
        createInputEvent("SoftDropDown", 200),
        createInputEvent("HardDrop", 250),
      ];

      const result = normalizeInputSequence(events, 50);
      expect(result).toEqual(["LeftDown", "SoftDropDown", "HardDrop"]);
    });

    it("should keep relevant events in order", () => {
      const events: Array<InputEvent> = [
        createInputEvent("HardDrop", 300),
        createInputEvent("RotateCW", 100),
        createInputEvent("LeftDown", 200),
      ];

      const result = normalizeInputSequence(events, 50);
      expect(result).toEqual(["RotateCW", "LeftDown", "HardDrop"]);
    });

    it("should cancel opposite directional inputs within window", () => {
      const events: Array<InputEvent> = [
        createInputEvent("LeftDown", 100),
        createInputEvent("RightDown", 130), // Within 50ms window
        createInputEvent("RotateCW", 200),
      ];

      const result = normalizeInputSequence(events, 50);
      expect(result).toEqual(["RotateCW"]);
    });

    it("should not cancel opposite inputs outside window", () => {
      const events: Array<InputEvent> = [
        createInputEvent("LeftDown", 100),
        createInputEvent("RightDown", 200), // Outside 50ms window
        createInputEvent("RotateCW", 300),
      ];

      const result = normalizeInputSequence(events, 50);
      expect(result).toEqual(["LeftDown", "RightDown", "RotateCW"]);
    });

    it("should cancel RightTap -> LeftTap pairs", () => {
      const events: Array<InputEvent> = [
        createInputEvent("RightDown", 100),
        createInputEvent("LeftDown", 120), // Within window
        createInputEvent("RotateCW", 200),
      ];

      const result = normalizeInputSequence(events, 50);
      expect(result).toEqual(["RotateCW"]);
    });

    it("should handle multiple cancellation pairs", () => {
      const events: Array<InputEvent> = [
        createInputEvent("LeftDown", 100),
        createInputEvent("RightDown", 120), // Pair 1
        createInputEvent("RightDown", 200),
        createInputEvent("LeftDown", 230), // Pair 2
        createInputEvent("HardDrop", 300),
      ];

      const result = normalizeInputSequence(events, 50);
      expect(result).toEqual(["HardDrop"]);
    });

    it("should not cancel non-directional inputs", () => {
      const events: Array<InputEvent> = [
        createInputEvent("RotateCW", 100),
        createInputEvent("RotateCCW", 120),
        createInputEvent("Hold", 160),
      ];

      const result = normalizeInputSequence(events, 50);
      expect(result).toEqual(["RotateCW", "RotateCCW", "Hold"]);
    });

    it("should handle edge case with same timestamp", () => {
      const events: Array<InputEvent> = [
        createInputEvent("LeftDown", 100),
        createInputEvent("RightDown", 100), // Same timestamp
        createInputEvent("HardDrop", 200),
      ];

      const result = normalizeInputSequence(events, 50);
      expect(result).toEqual(["HardDrop"]);
    });

    it("should handle complex scenario with partial cancellations", () => {
      const events: Array<InputEvent> = [
        createInputEvent("LeftDown", 100),
        createInputEvent("RotateCW", 120),
        createInputEvent("RightDown", 140), // This should cancel with LeftTap
        createInputEvent("LeftDown", 200), // This should remain
        createInputEvent("HardDrop", 250),
      ];

      const result = normalizeInputSequence(events, 50);
      expect(result).toEqual(["RotateCW", "LeftDown", "HardDrop"]);
    });

    it("should work with different cancellation window sizes", () => {
      const events: Array<InputEvent> = [
        createInputEvent("LeftDown", 100),
        createInputEvent("RightDown", 175), // 75ms apart
      ];

      // With 50ms window - should not cancel
      const result50 = normalizeInputSequence(events, 50);
      expect(result50).toEqual(["LeftDown", "RightDown"]);

      // With 100ms window - should cancel
      const result100 = normalizeInputSequence(events, 100);
      expect(result100).toEqual([]);
    });

    it("should handle empty input array", () => {
      const result = normalizeInputSequence([], 50);
      expect(result).toEqual([]);
    });

    it("should handle single input", () => {
      const events: Array<InputEvent> = [createInputEvent("LeftDown", 100)];
      const result = normalizeInputSequence(events, 50);
      expect(result).toEqual(["LeftDown"]);
    });

    it("should preserve all hold and rotation inputs", () => {
      const events: Array<InputEvent> = [
        createInputEvent("Hold", 100),
        createInputEvent("RotateCW", 150),
        createInputEvent("RotateCCW", 200),
        createInputEvent("HardDrop", 300),
      ];

      const result = normalizeInputSequence(events, 50);
      expect(result).toEqual(["Hold", "RotateCW", "RotateCCW", "HardDrop"]);
    });
  });
});
