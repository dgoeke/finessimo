import { freePlayUi } from "../../src/modes/freePlay/ui";
import { createTestGameState } from "../test-helpers";

import type { GameState } from "../../src/state/types";

describe("FreePlay UI Adapter - computeDerivedUi", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });
  test("returns null when opening coaching is disabled", () => {
    const state = createTestGameState({
      gameplay: {
        ...createTestGameState().gameplay,
        openingCoachingEnabled: false,
      },
    });

    const result = freePlayUi.computeDerivedUi(state);
    expect(result).toBeNull();
  });

  test("returns null when coaching enabled but modeData is null", () => {
    const base = createTestGameState();
    const state: GameState = {
      ...base,
      gameplay: { ...base.gameplay, openingCoachingEnabled: true },
      modeData: null,
    } as GameState;

    const result = freePlayUi.computeDerivedUi(state);
    expect(result).toBeNull();
  });

  test("returns policyOutput when coaching enabled with policyContext", () => {
    const base = createTestGameState();
    const state: GameState = {
      ...base,
      gameplay: { ...base.gameplay, openingCoachingEnabled: true },
      modeData: {
        policyContext: {
          lastBestScore: null,
          lastPlanId: null,
          lastSecondScore: null,
          lastUpdate: null,
          planAge: 0,
        },
      },
    } as GameState;

    const result = freePlayUi.computeDerivedUi(state);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("policyOutput");

    const po = (result as { policyOutput: unknown }).policyOutput as {
      suggestion: { rationale: string };
    };
    expect(typeof po.suggestion.rationale).toBe("string");
    expect(po.suggestion.rationale.length).toBeGreaterThan(0);
  });
});
