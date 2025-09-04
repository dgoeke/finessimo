import { FreePlayMode } from "../../src/modes/freePlay";
import * as policy from "../../src/policy/index";
import { createGridCoord } from "../../src/types/brands";
import { createTestGameState } from "../test-helpers";

import type { GameState, PieceId } from "../../src/state/types";

describe("FreePlayMode.getBoardDecorations (coaching)", () => {
  const mode = new FreePlayMode();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("returns null when not playing or coaching disabled", () => {
    const base = createTestGameState({
      gameplay: {
        ...createTestGameState().gameplay,
        openingCoachingEnabled: false,
      },
    });
    const result = mode.getBoardDecorations(base);
    expect(result).toBeNull();
  });

  test("returns decorated cells when coaching enabled with active piece", () => {
    const base = createTestGameState(
      {
        gameplay: {
          ...createTestGameState().gameplay,
          openingCoachingEnabled: true,
        },
        modeData: {
          policyContext: {
            lastBestScore: null,
            lastPlanId: null,
            lastSecondScore: null,
            lastUpdate: null,
            planAge: 0,
          },
        },
        nextQueue: ["I", "T", "S", "Z", "O"] as Array<PieceId>,
      },
      {
        active: {
          id: "T",
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(0),
        },
      },
    );

    const result = mode.getBoardDecorations(base as unknown as GameState);
    // Should render a single cellHighlight decoration with at least one cell
    expect(result).not.toBeNull();
    expect(Array.isArray(result)).toBe(true);
    if (result) {
      expect(result[0]).toHaveProperty("type", "cellHighlight");
      expect(result[0]).toHaveProperty("cells");
      const cells = (result[0] as unknown as { cells: ReadonlyArray<unknown> })
        .cells;
      expect(cells.length).toBeGreaterThan(0);
    }
  });

  test("returns null when coaching enabled but modeData is null", () => {
    const base = createTestGameState({
      gameplay: {
        ...createTestGameState().gameplay,
        openingCoachingEnabled: true,
      },
      modeData: null,
    });
    const result = mode.getBoardDecorations(base as unknown as GameState);
    expect(result).toBeNull();
  });

  test("returns null when not in playing state", () => {
    const base = createTestGameState({
      gameplay: {
        ...createTestGameState().gameplay,
        openingCoachingEnabled: true,
      },
      modeData: {
        policyContext: {
          lastBestScore: null,
          lastPlanId: null,
          lastSecondScore: null,
          lastUpdate: null,
          planAge: 0,
        },
      },
    });
    const nonPlaying = {
      ...(base as unknown as Record<string, unknown>),
      status: "topOut",
    } as GameState;
    const result = mode.getBoardDecorations(nonPlaying);
    expect(result).toBeNull();
  });

  test("returns null when suggestion uses hold (skip next-piece decoration)", () => {
    const base = createTestGameState(
      {
        gameplay: {
          ...createTestGameState().gameplay,
          openingCoachingEnabled: true,
        },
        modeData: {
          policyContext: {
            lastBestScore: null,
            lastPlanId: null,
            lastSecondScore: null,
            lastUpdate: null,
            planAge: 0,
          },
        },
        nextQueue: ["I", "T", "S", "Z", "O"] as Array<PieceId>,
      },
      {
        active: {
          id: "J",
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(0),
        },
      },
    ) as unknown as GameState;

    jest.spyOn(policy, "recommendMove").mockReturnValue({
      nextCtx: {
        lastBestScore: null,
        lastPlanId: null,
        lastSecondScore: null,
        lastUpdate: null,
        planAge: 0,
      },
      suggestion: {
        confidence: 1,
        intent: "TKI",
        placement: { rot: "spawn", useHold: true, x: createGridCoord(4) },
        rationale: "hold recommended",
      },
    });

    const result = mode.getBoardDecorations(base);
    expect(result).toBeNull();
  });

  test("returns null when active piece is undefined", () => {
    const base = createTestGameState({
      gameplay: {
        ...createTestGameState().gameplay,
        openingCoachingEnabled: true,
      },
      modeData: {
        policyContext: {
          lastBestScore: null,
          lastPlanId: null,
          lastSecondScore: null,
          lastUpdate: null,
          planAge: 0,
        },
      },
    });
    const result = mode.getBoardDecorations(base as unknown as GameState);
    expect(result).toBeNull();
  });

  test("handles policy errors gracefully in guidance and lock handlers", () => {
    const base = createTestGameState(
      {
        gameplay: {
          ...createTestGameState().gameplay,
          openingCoachingEnabled: true,
        },
        modeData: {
          policyContext: {
            lastBestScore: null,
            lastPlanId: null,
            lastSecondScore: null,
            lastUpdate: null,
            planAge: 0,
          },
        },
        nextQueue: ["T", "I", "S", "Z", "O"] as Array<PieceId>,
      },
      {
        active: {
          id: "J",
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(0),
        },
      },
    ) as unknown as GameState;

    jest.spyOn(policy, "recommendMove").mockImplementation(() => {
      throw new Error("boom");
    });

    // getGuidance should swallow error and return null
    expect(mode.getGuidance(base)).toBeNull();
    // onPieceLocked should swallow error and return empty result
    const active = base.active;
    if (!active) throw new Error("expected active piece for test");
    const res = mode.onPieceLocked(
      base,
      { kind: "optimal", optimalSequences: [], playerSequence: [] },
      active,
      active,
    );
    expect(res).toEqual({});
  });
});
