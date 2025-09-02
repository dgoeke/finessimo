import { describe, expect, it } from "@jest/globals";

import { createDurationMs } from "../../src/types/brands";
import {
  createDelayedEffect,
  createImmediateEffect,
  isDelayedEffect,
  isImmediateEffect,
} from "../../src/types/effects";

describe("Effect Patterns", () => {
  describe("createDelayedEffect", () => {
    it("creates delayed effect with correct structure", () => {
      const delay = createDurationMs(1000);
      const action = () => "test result";

      const effect = createDelayedEffect(delay, action);

      expect(effect.type).toBe("delayed");
      expect(effect.delayMs).toBe(delay);
      expect(effect.action).toBe(action);
    });

    it("preserves action return type", () => {
      const action = () => 42;
      const effect = createDelayedEffect(createDurationMs(500), action);

      expect(effect.action()).toBe(42);
    });
  });

  describe("createImmediateEffect", () => {
    it("creates immediate effect with correct structure", () => {
      const action = () => "immediate";

      const effect = createImmediateEffect(action);

      expect(effect.type).toBe("immediate");
      expect(effect.action).toBe(action);
    });
  });

  describe("type guards", () => {
    it("isDelayedEffect correctly identifies delayed effects", () => {
      const delayed = createDelayedEffect(createDurationMs(100), () => {
        /* test function */
      });
      const immediate = createImmediateEffect(() => {
        /* test function */
      });

      expect(isDelayedEffect(delayed)).toBe(true);
      expect(isDelayedEffect(immediate)).toBe(false);
    });

    it("isImmediateEffect correctly identifies immediate effects", () => {
      const delayed = createDelayedEffect(createDurationMs(100), () => {
        /* test function */
      });
      const immediate = createImmediateEffect(() => {
        /* test function */
      });

      expect(isImmediateEffect(immediate)).toBe(true);
      expect(isImmediateEffect(delayed)).toBe(false);
    });
  });
});
