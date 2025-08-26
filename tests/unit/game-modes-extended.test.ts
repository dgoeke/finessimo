import { describe, test, expect, beforeEach } from "@jest/globals";

import { createRng } from "../../src/core/rng";
import { FreePlayMode } from "../../src/modes/freePlay";
import { GuidedMode } from "../../src/modes/guided";

import type { FinesseResult } from "../../src/finesse/calculator";
import type { GameState, ActivePiece, Rot } from "../../src/state/types";

const mockState = (): GameState => ({
  active: undefined,
  board: { cells: new Uint8Array(200), height: 20, width: 10 },
  canHold: true,
  currentMode: "freePlay",
  finesseFeedback: null,
  gameplay: { finesseCancelMs: 50 },
  hold: undefined,
  modePrompt: null,
  nextQueue: [],
  physics: {
    isSoftDropping: false,
    lastGravityTime: 0,
    lineClearLines: [],
    lineClearStartTime: null,
    lockDelayStartTime: null,
  },
  processedInputLog: [],
  rng: createRng("t"),
  stats: {
    accuracyPercentage: 0,
    attempts: 0,
    averageInputsPerPiece: 0,
    doubleLines: 0,
    faultsByType: {},
    finesseAccuracy: 0,
    incorrectPlacements: 0,
    linesCleared: 0,
    linesPerMinute: 0,
    longestSessionMs: 0,
    optimalInputs: 0,
    optimalPlacements: 0,
    piecesPerMinute: 0,
    piecesPlaced: 0,
    sessionLinesCleared: 0,
    sessionPiecesPlaced: 0,
    sessionStartMs: 0,
    singleLines: 0,
    startedAtMs: 0,
    tetrisLines: 0,
    timePlayedMs: 0,
    totalFaults: 0,
    totalInputs: 0,
    totalSessions: 1,
    tripleLines: 0,
  },
  status: "playing",
  tick: 0,
  timing: {
    arrMs: 2,
    dasMs: 133,
    gravityEnabled: false,
    gravityMs: 1000,
    lineClearDelayMs: 0,
    lockDelayMs: 500,
    softDrop: 10,
    tickHz: 60,
  },
});

describe("FreePlayMode - extended", () => {
  test("suboptimal shorter sequence lists issues without extra inputs", () => {
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
      isOptimal: false,
      optimalSequences: [["MoveLeft", "MoveLeft", "HardDrop"]],
      playerSequence: ["MoveLeft"], // shorter
    };

    const out = mode.onPieceLocked(
      state,
      res,
      { id: "T", rot: "spawn", x: 3, y: 0 },
      { id: "T", rot: "spawn", x: 0, y: 0 },
    );
    expect(out.feedback).toContain("✗ Non-optimal finesse");
    expect(out.feedback).toContain("Used 1 inputs, optimal was 3");
    expect(out.feedback).not.toContain("extra input");
    expect(out.feedback).toContain("Issues: Sequence incomplete");
  });

  test("target and expected piece helpers are null/undefined", () => {
    const mode = new FreePlayMode();
    const state = mockState();
    const target = mode.getTargetFor(
      { id: "T", rot: "spawn", x: 3, y: 0 },
      state,
    );
    const exp = mode.getExpectedPiece(state);
    expect(target).toBeNull();
    expect(exp).toBeUndefined();
  });
});

describe("GuidedMode - extended", () => {
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

  test("wrong piece does not advance and gives feedback", () => {
    const guidance = mode.getGuidance(state);
    expect(guidance?.target).toBeDefined();
    const wrongPiece: ActivePiece = { id: "J", rot: "spawn", x: 4, y: 0 };
    if (!guidance?.target) return;
    const finalPos: ActivePiece = {
      id: "J",
      rot: guidance.target.rot,
      x: guidance.target.x,
      y: 0,
    };
    const result = mode.onPieceLocked(
      state,
      {
        faults: [],
        isOptimal: true,
        optimalSequences: [["HardDrop"]],
        playerSequence: ["HardDrop"],
      },
      wrongPiece,
      finalPos,
    );

    expect(result.feedback).toContain("Wrong piece");
    expect(
      (state.modeData as { currentDrillIndex: number } | undefined)
        ?.currentDrillIndex ?? 0,
    ).toBe(0);
  });

  test("wrong target does not advance and gives feedback", () => {
    const guidance = mode.getGuidance(state);
    const expected = mode.getExpectedPiece(state);
    expect(guidance?.target).toBeDefined();
    expect(expected).toBeDefined();
    if (guidance?.target === undefined || expected === undefined) return;
    const locked: ActivePiece = { id: expected, rot: "spawn", x: 4, y: 0 };
    // send a different target x/rot
    const badX = guidance.target.x === 0 ? 1 : 0;
    const badRot: Rot = guidance.target.rot === "spawn" ? "right" : "spawn";
    const finalPos: ActivePiece = { id: locked.id, rot: badRot, x: badX, y: 0 };
    const result = mode.onPieceLocked(
      state,
      {
        faults: [],
        isOptimal: true,
        optimalSequences: [["HardDrop"]],
        playerSequence: ["HardDrop"],
      },
      locked,
      finalPos,
    );

    expect(result.feedback).toContain("Wrong target");
    expect(
      (state.modeData as { currentDrillIndex: number } | undefined)
        ?.currentDrillIndex ?? 0,
    ).toBe(0);
  });

  test("getTargetFor/getExpectedPiece reflect current drill", () => {
    const guidance = mode.getGuidance(state);
    const exp = mode.getExpectedPiece(state);
    expect(guidance?.target).toEqual({ rot: "spawn", x: 0 });
    expect(exp).toBe("T");
  });

  test("shouldPromptNext is false when active piece exists", () => {
    const stateWithActive = {
      ...state,
      active: { id: "T" as const, rot: "spawn" as const, x: 3, y: 0 },
    };
    expect(mode.shouldPromptNext(stateWithActive)).toBe(false);
  });
});
