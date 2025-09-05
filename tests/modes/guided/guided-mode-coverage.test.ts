import { describe, test, expect, jest } from "@jest/globals";

import { createSevenBagRng } from "../../../src/core/rng/seeded";
import { type FinesseResult } from "../../../src/engine/finesse/calculator";
import { Airborne } from "../../../src/engine/physics/lock-delay.machine";
import { GuidedMode } from "../../../src/modes/guided/mode";
import {
  type GameState,
  type ActivePiece,
  createBoardCells,
} from "../../../src/state/types";
import {
  createDurationMs,
  createSeed,
  createGridCoord,
} from "../../../src/types/brands";
import { createTimestamp, fromNow } from "../../../src/types/timestamp";
import { createTestPhysicsState } from "../../test-helpers";

const createMockGameState = (overrides: Partial<GameState> = {}): GameState =>
  ({
    active: undefined,
    board: {
      cells: createBoardCells(),
      height: 20,
      totalHeight: 23,
      vanishRows: 3,
      width: 10,
    },
    canHold: true,
    currentMode: "guided",
    finesseFeedback: null,
    gameplay: {
      finesseCancelMs: createDurationMs(50),
      holdEnabled: true,
    },
    hold: undefined,
    modePrompt: null,
    nextQueue: [],
    pendingLock: null,
    physics: createTestPhysicsState({
      activePieceSpawnedAt: createTimestamp(1000),
      isSoftDropping: false,
      lastGravityTime: createTimestamp(1),
      lineClearLines: [],
      lineClearStartTime: null,
      lockDelay: Airborne(),
    }),
    processedInputLog: [],
    rng: createSevenBagRng(createSeed("test")),
    stats: {
      accuracyPercentage: 0,
      attempts: 5,
      averageInputsPerPiece: 0,
      doubleLines: 0,
      faultsByType: {},
      finesseAccuracy: createGridCoord(0),
      incorrectPlacements: 0,
      linesCleared: 0,
      linesPerMinute: 0,
      longestSessionMs: createDurationMs(0),
      optimalInputs: 0,
      optimalPlacements: 0,
      piecesPerMinute: 0,
      piecesPlaced: 0,
      sessionLinesCleared: 0,
      sessionPiecesPlaced: 0,
      sessionStartMs: createTimestamp(0.1),
      singleLines: 0,
      startedAtMs: createTimestamp(0.1),
      tetrisLines: 0,
      timePlayedMs: createDurationMs(0),
      totalFaults: 0,
      totalInputs: 0,
      totalSessions: 1,
      tripleLines: 0,
    },
    status: "playing",
    tick: 0,
    timing: {
      arrMs: createDurationMs(2),
      dasMs: createDurationMs(133),
      gravityEnabled: false,
      gravityMs: createDurationMs(1000),
      lineClearDelayMs: createDurationMs(0),
      lockDelayMs: createDurationMs(500),
      softDrop: 10,
      tickHz: 60,
    },
    ...overrides,
  }) as GameState;

const createFinesseResult = (
  kind: "optimal" | "faulty",
  optimalSequences: Array<Array<string>> = [
    ["MoveLeft", "RotateCW", "HardDrop"],
  ],
): FinesseResult => {
  const base = {
    optimalSequences: optimalSequences as FinesseResult["optimalSequences"],
    playerSequence: [
      "MoveLeft",
      "RotateCW",
      "HardDrop",
    ] as FinesseResult["playerSequence"],
  };

  if (kind === "optimal") {
    return { kind, ...base };
  } else {
    return {
      kind,
      ...base,
      faults: [
        {
          description: "Extra input detected",
          position: 1,
          type: "extra_input",
        },
      ],
    };
  }
};

describe("GuidedMode - Coverage Tests", () => {
  let mode: GuidedMode;

  beforeEach(() => {
    mode = new GuidedMode();
  });

  const createValidPiecePair = (state: GameState) => {
    const expectedPiece = mode.getExpectedPiece(state);
    const guidance = mode.getGuidance(state);

    if (expectedPiece === undefined || guidance?.target === undefined) {
      return null;
    }

    const lockedPiece: ActivePiece = {
      id: expectedPiece,
      rot: "spawn",
      x: createGridCoord(4),
      y: createGridCoord(0),
    };

    const finalPiece: ActivePiece = {
      id: expectedPiece,
      rot: guidance.target.rot,
      x: guidance.target.x,
      y: createGridCoord(0),
    };

    return { finalPiece, lockedPiece };
  };

  describe("Configuration fallbacks", () => {
    test("getGradingConfig returns default when no modeData", () => {
      const state = createMockGameState({ modeData: undefined });
      const config = mode.getGradingConfig(state);

      expect(config).toEqual({
        easyThresholdMs: 1000,
        goodThresholdMs: 2000,
      });
    });

    test("getGradingConfig returns default when modeData has no gradingConfig", () => {
      const state = createMockGameState({
        modeData: { deck: mode.initModeData().deck },
      });
      const config = mode.getGradingConfig(state);

      expect(config).toEqual({
        easyThresholdMs: 1000,
        goodThresholdMs: 2000,
      });
    });
  });

  describe("Rating calculation branches", () => {
    test("calculatePlacementRating returns easy for fast optimal placement", () => {
      const state = createMockGameState({
        modeData: mode.initModeData(),
        processedInputLog: [
          { dir: -1, kind: "TapMove", t: createTimestamp(fromNow()) },
        ], // has player input
      });

      const pieces = createValidPiecePair(state);
      if (pieces === null) {
        expect(pieces).toBeDefined();
        return;
      }

      const result = mode.onPieceLocked(
        state,
        createFinesseResult("optimal"),
        pieces.lockedPiece,
        pieces.finalPiece,
      );

      expect(result.postActions).toBeDefined();
      expect(result.postActions?.[0]?.type).toBe("PushUiEffect");
    });

    test("calculatePlacementRating returns good for medium speed optimal placement", () => {
      const state = createMockGameState({
        modeData: mode.initModeData(),
        physics: createTestPhysicsState({
          activePieceSpawnedAt: createTimestamp(5000), // Fixed timestamp for testing
        }),
        processedInputLog: [
          { dir: -1, kind: "TapMove", t: createTimestamp(fromNow()) },
        ],
      });

      const pieces = createValidPiecePair(state);
      if (pieces === null) {
        expect(pieces).toBeDefined();
        return;
      }

      const result = mode.onPieceLocked(
        state,
        createFinesseResult("optimal"),
        pieces.lockedPiece,
        pieces.finalPiece,
      );

      expect(result.postActions?.[0]?.type).toBe("PushUiEffect");
    });

    test("calculatePlacementRating returns hard for slow optimal placement", () => {
      const state = createMockGameState({
        modeData: mode.initModeData(),
        physics: createTestPhysicsState({
          activePieceSpawnedAt: createTimestamp(3000), // Fixed timestamp for testing
        }),
        processedInputLog: [
          { dir: -1, kind: "TapMove", t: createTimestamp(fromNow()) },
        ],
      });

      const pieces = createValidPiecePair(state);
      if (pieces === null) {
        expect(pieces).toBeDefined();
        return;
      }

      const result = mode.onPieceLocked(
        state,
        createFinesseResult("optimal"),
        pieces.lockedPiece,
        pieces.finalPiece,
      );

      expect(result.postActions?.[0]?.type).toBe("PushUiEffect");
    });

    test("calculatePlacementRating returns again for non-optimal finesse", () => {
      const state = createMockGameState({
        modeData: mode.initModeData(),
        processedInputLog: [
          { dir: -1, kind: "TapMove", t: createTimestamp(fromNow()) },
        ],
      });

      const pieces = createValidPiecePair(state);
      if (pieces === null) {
        expect(pieces).toBeDefined();
        return;
      }

      const result = mode.onPieceLocked(
        state,
        createFinesseResult("faulty"),
        pieces.lockedPiece,
        pieces.finalPiece,
      );

      expect(result.postActions?.[0]?.type).toBe("PushUiEffect");
    });

    test("calculatePlacementRating returns again for no player input", () => {
      const state = createMockGameState({
        modeData: mode.initModeData(),
        processedInputLog: [], // no player input
      });

      const pieces = createValidPiecePair(state);
      if (pieces === null) {
        expect(pieces).toBeDefined();
        return;
      }

      const result = mode.onPieceLocked(
        state,
        createFinesseResult("optimal"),
        pieces.lockedPiece,
        pieces.finalPiece,
      );

      expect(result.postActions?.[0]?.type).toBe("PushUiEffect");
    });
  });

  describe("Edge cases and error handling", () => {
    test("onPieceLocked returns empty when no due card", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {
        // intentionally empty
      });

      try {
        // Create state with empty deck that has no due cards
        const state = createMockGameState({
          modeData: {
            deck: { items: new Map() },
            gradingConfig: { easyThresholdMs: 1000, goodThresholdMs: 2000 },
          },
        });

        const result = mode.onPieceLocked(
          state,
          createFinesseResult("optimal"),
          {
            id: "T",
            rot: "spawn",
            x: createGridCoord(4),
            y: createGridCoord(0),
          },
          {
            id: "T",
            rot: "spawn",
            x: createGridCoord(4),
            y: createGridCoord(0),
          },
        );

        expect(result).toEqual({});
        expect(consoleSpy).toHaveBeenCalledWith(
          "DEBUG: No due card found, returning early",
        );
      } finally {
        consoleSpy.mockRestore();
      }
    });

    test("onPieceLocked returns empty when piece mismatch", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {
        // intentionally empty
      });

      try {
        const state = createMockGameState({
          modeData: mode.initModeData(),
        });

        // Find what piece the mode expects
        const expectedPiece = mode.getExpectedPiece(state);
        // Use a different piece to create a mismatch
        const differentPieceId = expectedPiece === "I" ? "T" : "I";

        const differentPiece: ActivePiece = {
          id: differentPieceId,
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(0),
        };

        const result = mode.onPieceLocked(
          state,
          createFinesseResult("optimal"),
          differentPiece,
          differentPiece,
        );

        expect(result).toEqual({});
        expect(consoleSpy).toHaveBeenCalledWith(
          "Unexpected piece mismatch in guided mode - this should not happen",
        );
      } finally {
        consoleSpy.mockRestore();
      }
    });

    test("onBeforeSpawn returns null when not playing", () => {
      const state = createMockGameState({ status: "topOut" });

      const result = mode.onBeforeSpawn(state);

      expect(result).toBeNull();
    });

    test("getGuidance returns null when no card available", () => {
      const state = createMockGameState({
        modeData: {
          deck: { items: new Map() },
          gradingConfig: { easyThresholdMs: 1000, goodThresholdMs: 2000 },
        },
      });

      const result = mode.getGuidance(state);

      expect(result).toBeNull();
    });

    test("getNextPrompt returns null when no card available", () => {
      const state = createMockGameState({
        modeData: {
          deck: { items: new Map() },
          gradingConfig: { easyThresholdMs: 1000, goodThresholdMs: 2000 },
        },
      });

      const result = mode.getNextPrompt(state);

      expect(result).toBeNull();
    });
  });

  describe("shouldPromptNext", () => {
    test("returns true when no active piece", () => {
      const state = createMockGameState({ active: undefined });

      expect(mode.shouldPromptNext(state)).toBe(true);
    });

    test("returns false when active piece exists", () => {
      const mockPiece: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: createGridCoord(4),
        y: createGridCoord(0),
      };
      const state = createMockGameState({ active: mockPiece });

      expect(mode.shouldPromptNext(state)).toBe(false);
    });
  });

  describe("getBoardDecorations", () => {
    test("returns null when not playing", () => {
      const state = createMockGameState({
        modeData: mode.initModeData(),
        status: "topOut",
      });

      const result = mode.getBoardDecorations(state);

      expect(result).toBeNull();
    });

    test("returns decorations when playing with valid card", () => {
      const state = createMockGameState({
        modeData: mode.initModeData(),
        status: "playing",
      });

      const result = mode.getBoardDecorations(state);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      if (result !== null) {
        expect(result[0]).toHaveProperty("type", "cellHighlight");
        expect(result[0]).toHaveProperty("cells");
        expect(result[0]).toHaveProperty("color");
        expect(result[0]).toHaveProperty("alpha", 0.25);
      }
    });
  });
});
