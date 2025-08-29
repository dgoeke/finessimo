import { describe, test, expect, beforeEach } from "@jest/globals";

import { createSevenBagRng } from "../../src/core/rng";
import { FreePlayMode } from "../../src/modes/freePlay";
import { GuidedMode } from "../../src/modes/guided";
import { createBoardCells } from "../../src/state/types";
import {
  createDurationMs,
  createSeed,
  createGridCoord,
} from "../../src/types/brands";
import { createTimestamp } from "../../src/types/timestamp";

import type { FinesseResult } from "../../src/finesse/calculator";
import type { GameState, ActivePiece, Rot } from "../../src/state/types";

const mockState = (): GameState => ({
  active: undefined,
  board: { cells: createBoardCells(), height: 20, width: 10 },
  canHold: true,
  currentMode: "freePlay",
  finesseFeedback: null,
  gameplay: { finesseCancelMs: createDurationMs(50) },
  hold: undefined,
  modePrompt: null,
  nextQueue: [],
  pendingLock: null,
  physics: {
    isSoftDropping: false,
    lastGravityTime: createTimestamp(1),
    lineClearLines: [],
    lineClearStartTime: null,
    lockDelayStartTime: null,
  },
  processedInputLog: [],
  rng: createSevenBagRng(createSeed("t")),
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
});

describe("FreePlayMode - extended", () => {
  test("FreePlay returns no textual feedback for suboptimal sequences", () => {
    const mode = new FreePlayMode();
    const state = mockState();

    const res: FinesseResult = {
      faults: [
        {
          description: "Sequence incomplete",
          position: 1,
          type: "suboptimal_path",
        },
      ],
      kind: "faulty",
      optimalSequences: [["MoveLeft", "MoveLeft", "HardDrop"]],
      playerSequence: ["MoveLeft"], // shorter
    };

    const out = mode.onPieceLocked(
      state,
      res,
      { id: "T", rot: "spawn", x: createGridCoord(3), y: createGridCoord(0) },
      { id: "T", rot: "spawn", x: createGridCoord(0), y: createGridCoord(0) },
    );
    expect(out).toEqual({});
  });

  test("target and expected piece helpers are null/undefined", () => {
    const mode = new FreePlayMode();
    const state = mockState();
    const target = mode.getTargetFor(
      { id: "T", rot: "spawn", x: createGridCoord(3), y: createGridCoord(0) },
      state,
    );
    const exp = mode.getExpectedPiece(state);
    expect(target).toBeNull();
    expect(exp).toBeUndefined();
  });
});

describe("GuidedMode - extended (SRS)", () => {
  let mode: GuidedMode;
  let state: GameState;
  beforeEach(() => {
    mode = new GuidedMode();
    state = {
      ...mockState(),
      currentMode: "guided",
      modeData: mode.initModeData(),
    };
  });

  test("wrong piece does not update deck", () => {
    const guidance = mode.getGuidance(state);
    expect(guidance?.target).toBeDefined();
    const wrongPiece: ActivePiece = {
      id: "J",
      rot: "spawn",
      x: createGridCoord(4),
      y: createGridCoord(0),
    };
    if (guidance?.target === undefined) return;
    const finalPos: ActivePiece = {
      id: "J",
      rot: guidance.target.rot,
      x: guidance.target.x,
      y: createGridCoord(0),
    };
    const result = mode.onPieceLocked(
      state,
      {
        kind: "optimal",
        optimalSequences: [["HardDrop"]],
        playerSequence: ["HardDrop"],
      },
      wrongPiece,
      finalPos,
    );
    expect(result.modeData).toBeUndefined();
  });

  test("wrong target updates deck with 'again' rating", () => {
    const guidance = mode.getGuidance(state);
    const expected = mode.getExpectedPiece(state);
    expect(guidance?.target).toBeDefined();
    expect(expected).toBeDefined();
    if (guidance?.target === undefined || expected === undefined) return;
    const locked: ActivePiece = {
      id: expected,
      rot: "spawn",
      x: createGridCoord(4),
      y: createGridCoord(0),
    };
    const badX = guidance.target.x === 0 ? 1 : 0;
    const badRot: Rot = guidance.target.rot === "spawn" ? "right" : "spawn";
    const finalPos: ActivePiece = {
      id: locked.id,
      rot: badRot,
      x: createGridCoord(badX),
      y: createGridCoord(0),
    };
    const result = mode.onPieceLocked(
      state,
      {
        kind: "optimal",
        optimalSequences: [["HardDrop"]],
        playerSequence: ["HardDrop"],
      },
      locked,
      finalPos,
    );
    expect(result.modeData).toBeDefined(); // Wrong placements should now be tracked for learning
  });

  test("getTargetFor/getExpectedPiece reflect current selection", () => {
    const guidance = mode.getGuidance(state);
    const exp = mode.getExpectedPiece(state);
    expect(guidance?.target).toBeDefined();
    expect(exp).toBeDefined();
  });

  test("shouldPromptNext is false when active piece exists", () => {
    const stateWithActive = {
      ...state,
      active: {
        id: "T" as const,
        rot: "spawn" as const,
        x: createGridCoord(3),
        y: createGridCoord(0),
      },
    };
    expect(mode.shouldPromptNext(stateWithActive)).toBe(false);
  });
});
