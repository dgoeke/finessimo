import { createEmptyBoard } from "../../src/core/board";
import { createInitialState } from "../../src/engine/init";
import { FreePlayMode } from "../../src/modes/freePlay";
import {
  createDurationMs,
  createGridCoord,
  createSeed,
} from "../../src/types/brands";
import { fromNow } from "../../src/types/timestamp";
import { createTestGameState } from "../test-helpers";

import type {
  GameplayConfig,
  ActivePiece,
  PieceId,
  PlayingState,
} from "../../src/state/types";

describe("FreePlay Opening Coaching", () => {
  let mode: FreePlayMode;

  beforeEach(() => {
    mode = new FreePlayMode();
  });

  // Helper to create proper test state for policy
  function createPolicyTestState(
    overrides: Partial<PlayingState> = {},
  ): PlayingState {
    const seed = createSeed("test-seed");
    const timestamp = fromNow();
    const baseState = createInitialState(seed, timestamp);

    const playingState: PlayingState = {
      ...baseState,
      board: createEmptyBoard(),
      nextQueue: ["T", "I", "S", "Z", "O", "L", "J"] as const,
      pendingLock: null,
      status: "playing",
      ...overrides,
    };

    return playingState;
  }

  describe("initModeData", () => {
    it("should initialize mode data with policy context", () => {
      const modeData = mode.initModeData();

      expect(modeData).toEqual({
        policyContext: {
          lastBestScore: null,
          lastPlanId: null,
          lastSecondScore: null,
          lastUpdate: null,
          planAge: 0,
        },
      });
    });
  });

  describe("getGuidance", () => {
    it("should return null when opening coaching is disabled", () => {
      const gameplay: GameplayConfig = {
        finesseCancelMs: createDurationMs(50),
        holdEnabled: true,
        openingCoachingEnabled: false,
      };
      const state = createTestGameState({ gameplay });

      const guidance = mode.getGuidance(state);

      expect(guidance).toBeNull();
    });

    it("should return null when opening coaching is enabled but modeData is null", () => {
      const gameplay: GameplayConfig = {
        finesseCancelMs: createDurationMs(50),
        holdEnabled: true,
        openingCoachingEnabled: true,
      };
      const state = createTestGameState({ gameplay, modeData: null });

      const guidance = mode.getGuidance(state);

      expect(guidance).toBeNull();
    });

    it("should return null when opening coaching is enabled but no active piece", () => {
      const modeData = mode.initModeData();
      const state = createPolicyTestState({
        active: undefined,
        gameplay: {
          finesseCancelMs: createDurationMs(50),
          holdEnabled: true,
          openingCoachingEnabled: true,
        },
        modeData,
      });

      const guidance = mode.getGuidance(state);

      expect(guidance).toBeNull();
    });

    it("should return guidance when opening coaching is enabled with active piece", () => {
      const modeData = mode.initModeData();
      const state = createPolicyTestState({
        active: {
          id: "T" as PieceId,
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(0),
        },
        gameplay: {
          finesseCancelMs: createDurationMs(50),
          holdEnabled: true,
          openingCoachingEnabled: true,
        },
        modeData,
      });

      const guidance = mode.getGuidance(state);

      // Should return guidance with target placement
      expect(guidance).toBeDefined();
      if (guidance) {
        expect(guidance.target).toBeDefined();
        expect(typeof guidance.target?.rot).toBe("string");
        expect(typeof guidance.target?.x).toBe("number");
      }
    });
  });

  describe("onPieceLocked", () => {
    const gameplay: GameplayConfig = {
      finesseCancelMs: createDurationMs(50),
      holdEnabled: true,
      openingCoachingEnabled: false,
    };

    it("should return empty result when opening coaching is disabled", () => {
      const state = createTestGameState({ gameplay });
      const result = mode.onPieceLocked(
        state,
        { kind: "optimal", optimalSequences: [], playerSequence: [] },
        { id: "T", rot: "spawn", x: createGridCoord(4), y: createGridCoord(0) },
        {
          id: "T",
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(19),
        },
      );

      expect(result).toEqual({});
    });

    it("should return empty result when opening coaching is enabled but modeData is null", () => {
      const gameplayWithCoaching: GameplayConfig = {
        ...gameplay,
        openingCoachingEnabled: true,
      };
      const state = createTestGameState({
        gameplay: gameplayWithCoaching,
        modeData: null,
      });
      const result = mode.onPieceLocked(
        state,
        { kind: "optimal", optimalSequences: [], playerSequence: [] },
        { id: "T", rot: "spawn", x: createGridCoord(4), y: createGridCoord(0) },
        {
          id: "T",
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(19),
        },
      );

      expect(result).toEqual({});
    });

    it("should update modeData with policy output when coaching is enabled", () => {
      const modeData = mode.initModeData();
      const activePiece: ActivePiece = {
        id: "T" as PieceId,
        rot: "spawn",
        x: createGridCoord(4),
        y: createGridCoord(0),
      };
      const state = createPolicyTestState({
        active: activePiece,
        gameplay: {
          ...createPolicyTestState().gameplay,
          openingCoachingEnabled: true,
        },
        modeData,
      });

      const result = mode.onPieceLocked(
        state,
        { kind: "optimal", optimalSequences: [], playerSequence: [] },
        activePiece,
        {
          id: "T",
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(19),
        },
      );

      // Should return updated modeData with policy output
      expect(result.modeData).toBeDefined();
      expect(result.modeData).toHaveProperty("policyOutput");
    });
  });

  describe("other methods", () => {
    it("should handle other interface methods correctly", () => {
      const state = createTestGameState();

      expect(mode.onBeforeSpawn(state)).toBeNull();
      expect(mode.shouldPromptNext(state)).toBe(false);
      expect(mode.getNextPrompt(state)).toBeNull();
      expect(
        mode.getTargetFor(
          {
            id: "T",
            rot: "spawn",
            x: createGridCoord(4),
            y: createGridCoord(0),
          },
          state,
        ),
      ).toBeNull();
      expect(mode.getExpectedPiece(state)).toBeUndefined();

      // onResolveLock should return retry when retryOnFinesseError is true and finesse is faulty
      const retryGameplay: GameplayConfig = {
        finesseCancelMs: createDurationMs(50),
        holdEnabled: true,
        openingCoachingEnabled: false,
      };
      const retryState = createTestGameState({
        gameplay: { ...retryGameplay, retryOnFinesseError: true },
      });
      const retryDecision = mode.onResolveLock({
        finesse: {
          faults: [{ type: "suboptimal_path" }],
          kind: "faulty",
          optimalSequences: [["MoveLeft", "HardDrop"]],
          playerSequence: [],
        },
        pending: {
          completedLines: [],
          finalPos: {
            id: "T",
            rot: "spawn",
            x: createGridCoord(4),
            y: createGridCoord(19),
          },
          pieceId: "T",
          source: "hardDrop",
          timestampMs: fromNow(),
        },
        state: retryState,
      });
      expect(retryDecision.action).toBe("retry");

      // onResolveLock should return commit when conditions don't match
      const commitDecision = mode.onResolveLock({
        finesse: { kind: "optimal", optimalSequences: [], playerSequence: [] },
        pending: {
          completedLines: [],
          finalPos: {
            id: "T",
            rot: "spawn",
            x: createGridCoord(4),
            y: createGridCoord(19),
          },
          pieceId: "T",
          source: "gravity",
          timestampMs: fromNow(),
        },
        state: retryState,
      });
      expect(commitDecision.action).toBe("commit");
    });

    it("should handle RNG and preview methods", () => {
      const rng = mode.createRng("test-seed");
      expect(rng).toBeDefined();

      const state = createTestGameState();
      const { newRng, piece } = mode.getNextPiece(state, rng);
      expect(piece).toMatch(/^[TILJOSZ]$/);
      expect(newRng).toBeDefined();

      const { newRng: previewRng, pieces } = mode.getPreview(state, rng, 3);
      expect(pieces).toHaveLength(3);
      expect(previewRng).toBeDefined();
    });
  });

  describe("initialConfig", () => {
    it("should enable hold functionality", () => {
      const config = mode.initialConfig();

      expect(config).toEqual({
        gameplay: {
          holdEnabled: true,
        },
      });
    });
  });
});
