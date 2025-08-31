import { describe, test, expect } from "@jest/globals";

import { createSevenBagRng } from "../../src/core/rng";
import { Airborne } from "../../src/engine/physics/lock-delay.machine";
import { guidedUi } from "../../src/modes/guided/ui";
import { createBoardCells } from "../../src/state/types";
import {
  createDurationMs,
  createGridCoord,
  createSeed,
} from "../../src/types/brands";
import { createTimestamp, fromNow } from "../../src/types/timestamp";

import type { GameState } from "../../src/state/types";

// Local minimal helper to construct a valid GameState for tests
const createMockGameState = (overrides: Partial<GameState> = {}): GameState =>
  ({
    active: undefined,
    board: { cells: createBoardCells(), height: 20, width: 10 },
    boardDecorations: null,
    canHold: true,
    currentMode: "guided",
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
    physics: {
      activePieceSpawnedAt: createTimestamp(1000),
      isSoftDropping: false,
      lastGravityTime: createTimestamp(1),
      lineClearLines: [],
      lineClearStartTime: null,
      lockDelay: Airborne(),
    },
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
      sessionStartMs: createTimestamp(fromNow()),
      singleLines: 0,
      startedAtMs: createTimestamp(fromNow()),
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
      lockDelayMaxResets: 15,
      lockDelayMs: createDurationMs(500),
      softDrop: 10,
      tickHz: 60,
    },
    uiEffects: [],
    ...overrides,
  }) as GameState;

describe("guidedUi.computeDerivedUi", () => {
  test("returns null when not playing (coverage for early return)", () => {
    const state = createMockGameState({ status: "topOut" });

    const result = guidedUi.computeDerivedUi(state);

    expect(result).toBeNull();
  });

  test("returns null when no card is available (empty deck)", () => {
    const state = createMockGameState({
      // Minimal structure to pass isGuidedSrsData check, but with empty items
      modeData: {
        deck: { items: new Map() },
        gradingConfig: { easyThresholdMs: 1000, goodThresholdMs: 2000 },
      },
    });

    const result = guidedUi.computeDerivedUi(state);

    expect(result).toBeNull();
  });

  test("uses default deck when modeData is not guided SRS and produces targets", () => {
    const state = createMockGameState({ modeData: undefined });

    const result = guidedUi.computeDerivedUi(state);

    expect(result).not.toBeNull();
    expect(result?.ghostEnabled).toBe(false);
    // Should have at least one target pattern with at least one cell
    expect(Array.isArray(result?.targets)).toBe(true);
    const patterns = result?.targets ?? [];
    expect(patterns.length).toBeGreaterThan(0);
    const first = patterns[0] ?? [];
    expect(first.length).toBeGreaterThan(0);

    // Validate bounds for returned cells
    for (const cell of first) {
      expect(cell.x as unknown as number).toBeGreaterThanOrEqual(0);
      expect(cell.x as unknown as number).toBeLessThan(state.board.width);
      expect(cell.y as unknown as number).toBeGreaterThanOrEqual(0);
      expect(cell.y as unknown as number).toBeLessThan(state.board.height);
      expect(typeof cell.color).toBe("string");
    }
  });
});
