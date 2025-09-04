import { describe, expect, test } from "@jest/globals";

import { createEmptyBoard } from "../../src/core/board";
import { createActivePiece } from "../../src/core/spawning";
import { createPendingLock } from "../../src/engine/lock-utils";
import { gameModeRegistry } from "../../src/modes";
import { runLockPipeline } from "../../src/modes/lock-pipeline";
import { createDurationMs, createUiEffectId } from "../../src/types/brands";
import { asNumber, fromNow } from "../../src/types/timestamp";

import type { FinesseResult } from "../../src/finesse/calculator";
import type { GameMode, ResolveLockDecision } from "../../src/modes";
import type { Action, GameState, GameplayConfig } from "../../src/state/types";

const dummyAnalyze = (
  _s: GameState,
): { result: FinesseResult; actions: Array<Action> } => ({
  actions: [],
  result: { kind: "optimal", optimalSequences: [], playerSequence: [] },
});

function makeBaseState(): GameState {
  // Minimal, typed state borrowed from init semantics
  const gameplay: GameplayConfig = {
    finesseCancelMs: createDurationMs(50),
    holdEnabled: false,
    openingCoachingEnabled: false,
  };
  const board = createEmptyBoard();
  const now = fromNow();
  return {
    active: undefined,
    board,
    boardDecorations: null,
    canHold: false,
    currentMode: "freePlay",
    finesseFeedback: null,
    gameplay,
    guidance: null,
    hold: undefined,
    modeData: null,
    modePrompt: null,
    nextQueue: [],
    pendingLock: null,
    physics: {
      activePieceSpawnedAt: null,
      isSoftDropping: false,
      lastGravityTime: now,
      lineClearLines: [],
      lineClearStartTime: null,
      lockDelay: { resets: 0, tag: "Airborne" },
    },
    processedInputLog: [],
    rng: {
      getNextPiece: () => ({ newRng: null as unknown, piece: "T" }),
      getNextPieces: (_: number) => ({
        newRng: null as unknown,
        pieces: ["T"],
      }),
    } as unknown,
    stats: {
      accuracyPercentage: 0,
      attempts: 0,
      averageInputsPerPiece: 0,
      doubleLines: 0,
      faultsByType: {},
      finesseAccuracy: 0 as unknown,
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
      sessionStartMs: now,
      singleLines: 0,
      startedAtMs: now,
      tetrisLines: 0,
      timePlayedMs: createDurationMs(0),
      totalFaults: 0,
      totalInputs: 0,
      totalSessions: 0,
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
      lockDelayMaxResets: 15,
      lockDelayMs: createDurationMs(500),
      softDrop: 10,
      tickHz: 60,
    },
    uiEffects: [],
  } as GameState;
}

describe("lock-pipeline coverage", () => {
  test("returns commit immediately when not resolving", () => {
    const base = makeBaseState();
    const dispatched: Array<Action> = [];
    const { decision } = runLockPipeline(
      base,
      (a) => dispatched.push(a),
      dummyAnalyze,
      fromNow(),
    );
    expect(decision.action).toBe("commit");
    expect(dispatched.length).toBe(0);
  });

  test("mode not found: commits and dispatches CommitLock", () => {
    const base = makeBaseState();
    const active = createActivePiece("T");
    const pending = createPendingLock(
      base.board,
      active,
      "hardDrop",
      fromNow(),
    );
    const resolving = {
      ...base,
      currentMode: "nonexistent",
      pendingLock: pending,
      status: "resolvingLock",
    } as GameState;
    const dispatched: Array<Action> = [];
    const { decision } = runLockPipeline(
      resolving,
      (a) => dispatched.push(a),
      dummyAnalyze,
      fromNow(),
    );
    expect(decision.action).toBe("commit");
    expect(dispatched.some((a) => a.type === "CommitLock")).toBe(true);
  });

  test("mode onPieceLocked updates modeData and post actions dispatch after commit", () => {
    const modeName = "pipeline_test";
    const mode: GameMode = {
      getNextPrompt: () => null,
      name: modeName,
      onPieceLocked: (
        _s: GameState,
        _r: FinesseResult,
        _lp: unknown,
        _fp: unknown,
      ) => ({
        modeData: { updated: true },
        postActions: [
          {
            effect: {
              anchor: "bottomRight",
              color: "#fff",
              createdAt: fromNow(),
              driftYPx: 0,
              fontPx: 10,
              id: createUiEffectId(asNumber(fromNow())),
              kind: "floatingText",
              offsetX: 0,
              offsetY: 0,
              text: "ok",
              ttlMs: createDurationMs(500),
            },
            type: "PushUiEffect",
          },
        ],
      }),
      onResolveLock: (): ResolveLockDecision => ({
        action: "commit",
        postActions: [{ type: "ResetBoard" }],
      }),
      reset: () => void 0,
      shouldPromptNext: () => false,
    };
    gameModeRegistry.register(mode);

    const base = makeBaseState();
    const active = createActivePiece("T");
    const pending = createPendingLock(
      base.board,
      active,
      "hardDrop",
      fromNow(),
    );
    const resolving = {
      ...base,
      currentMode: modeName,
      pendingLock: pending,
      status: "resolvingLock",
    } as GameState;
    const dispatched: Array<Action> = [];
    const { decision } = runLockPipeline(
      resolving,
      (a) => dispatched.push(a),
      dummyAnalyze,
      fromNow(),
    );
    expect(decision.action).toBe("commit");
    // Ensure UpdateModeData dispatched before commit branch effects
    expect(dispatched.some((a) => a.type === "UpdateModeData")).toBe(true);
    // Ensure ResetBoard then PushUiEffect both dispatched
    const resetIdx = dispatched.findIndex((a) => a.type === "ResetBoard");
    const effectIdx = dispatched.findIndex((a) => a.type === "PushUiEffect");
    expect(resetIdx).toBeGreaterThanOrEqual(0);
    expect(effectIdx).toBeGreaterThan(resetIdx);
  });
});
