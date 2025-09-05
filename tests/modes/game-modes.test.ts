import { describe, test, expect } from "@jest/globals";

import { createSevenBagRng } from "@/core/rng/seeded";
import { type FinesseResult } from "@/engine/finesse/calculator";
import { Airborne } from "@/engine/physics/lock-delay.machine";
import { FreePlayMode } from "@/modes/free-play/mode";
import { GuidedMode } from "@/modes/guided/mode";
import {
  type GameState,
  type ActivePiece,
  createBoardCells,
} from "@/state/types";
import { createDurationMs, createSeed, createGridCoord } from "@/types/brands";
import { createTimestamp } from "@/types/timestamp";

import {
  createTestPhysicsState,
  createTestTimingConfig,
} from "../test-helpers";

const mockGameState: GameState = {
  active: undefined,
  board: {
    cells: createBoardCells(),
    height: 20,
    totalHeight: 23,
    vanishRows: 3,
    width: 10,
  },
  boardDecorations: null,
  canHold: true,
  currentMode: "freePlay",
  finesseFeedback: null,
  gameplay: {
    finesseCancelMs: createDurationMs(50),
    holdEnabled: true,
  },
  guidance: null,
  hold: undefined,
  modeData: null,
  modePrompt: null,
  nextQueue: [],
  pendingLock: null,
  physics: createTestPhysicsState({
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
    attempts: 0,
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
  timing: createTestTimingConfig({
    gravityEnabled: false,
    gravityMs: createDurationMs(1000),
  }),
  uiEffects: [],
};

const mockPiece: ActivePiece = {
  id: "T",
  rot: "spawn",
  x: createGridCoord(4),
  y: createGridCoord(0),
};

const mockOptimalResult: FinesseResult = {
  kind: "optimal",
  optimalSequences: [["MoveLeft", "MoveLeft", "HardDrop"]],
  playerSequence: ["MoveLeft", "MoveLeft", "HardDrop"],
};

const mockSuboptimalResult: FinesseResult = {
  faults: [
    {
      description: "Used 6 inputs instead of optimal 3",
      position: 3,
      type: "extra_input",
    },
  ],
  kind: "faulty",
  optimalSequences: [["MoveLeft", "MoveLeft", "HardDrop"]],
  playerSequence: [
    "MoveLeft",
    "MoveRight",
    "MoveLeft",
    "MoveLeft",
    "MoveLeft",
    "HardDrop",
  ],
};

describe("FreePlayMode", () => {
  const mode = new FreePlayMode();

  test("does not emit textual feedback for optimal finesse", () => {
    const result = mode.onPieceLocked(
      mockGameState,
      mockOptimalResult,
      mockPiece,
      mockPiece,
    );

    expect(result).toEqual({});
  });

  test("does not emit textual feedback for suboptimal finesse", () => {
    const result = mode.onPieceLocked(
      mockGameState,
      mockSuboptimalResult,
      mockPiece,
      mockPiece,
    );

    expect(result).toEqual({});
  });

  test("should not prompt for next challenge", () => {
    expect(mode.shouldPromptNext(mockGameState)).toBe(false);
    expect(mode.getNextPrompt(mockGameState)).toBe(null);
  });
});

describe("GuidedMode (SRS)", () => {
  let mode: GuidedMode;
  let state: GameState;

  beforeEach(() => {
    mode = new GuidedMode();
    state = {
      ...mockGameState,
      currentMode: "guided",
      modeData: mode.initModeData(),
    };
  });

  test("provides guidance and expected piece for selected card", () => {
    const guidance = mode.getGuidance(state);
    const expected = mode.getExpectedPiece(state);
    expect(guidance?.target).toBeDefined();
    expect(expected).toBeDefined();
  });

  test("optimal placement updates deck and changes next selection", () => {
    const guidance = mode.getGuidance(state);
    const expected = mode.getExpectedPiece(state);
    if (guidance?.target === undefined || expected === undefined) return;
    const firstKey = `${expected}:${guidance.target.rot}:${String(guidance.target.x)}`;

    const locked: ActivePiece = {
      id: expected,
      rot: "spawn",
      x: createGridCoord(4),
      y: createGridCoord(0),
    };
    const finalPos: ActivePiece = {
      id: expected,
      rot: guidance.target.rot,
      x: guidance.target.x,
      y: createGridCoord(0),
    };
    const result = mode.onPieceLocked(
      state,
      mockOptimalResult,
      locked,
      finalPos,
    );
    expect(result.modeData).toBeDefined();
    if (result.modeData !== undefined)
      state = { ...state, modeData: result.modeData };

    const guidance2 = mode.getGuidance(state);
    const expected2 = mode.getExpectedPiece(state);
    if (guidance2?.target === undefined || expected2 === undefined) return;
    const secondKey = `${expected2}:${guidance2.target.rot}:${String(guidance2.target.x)}`;
    // After "good", due increased, so next selection should differ
    expect(secondKey).not.toEqual(firstKey);
  });
});
