import { describe, expect, it } from "@jest/globals";

import {
  mapGameStateToViewModel,
  toCol,
  toRow,
} from "../../src/presentation/phaser/presenter/viewModel";
import { createDurationMs, createGridCoord } from "../../src/types/brands";
import { fromNow } from "../../src/types/timestamp";

import type { ViewModel } from "../../src/presentation/phaser/presenter/types";
import type { GameState } from "../../src/state/types";

// Helper to create complete Stats object for testing
function createTestStats(
  overrides: Partial<GameState["stats"]> = {},
): GameState["stats"] {
  const now = fromNow();
  const zeroDuration = createDurationMs(0);
  return {
    accuracyPercentage: 0,
    attempts: 0,
    averageInputsPerPiece: 0,
    doubleLines: 0,
    faultsByType: {},
    finesseAccuracy: 0,
    incorrectPlacements: 0,
    linesCleared: 0,
    linesPerMinute: 0,
    longestSessionMs: zeroDuration,
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
    timePlayedMs: zeroDuration,
    totalFaults: 0,
    totalInputs: 0,
    totalSessions: 1,
    tripleLines: 0,
    ...overrides,
  };
}

// Helper to create minimal GameState for testing
function createTestState(overrides: Partial<GameState> = {}): GameState {
  const base = {
    active: undefined,
    board: {
      cells: new Array(200).fill(0),
      height: 20,
      width: 10,
    },
    currentMode: "test",
    gameplay: {} as GameState["gameplay"],
    hold: undefined,
    modeData: {},
    nextQueue: [],
    pendingLock: null,
    stats: createTestStats(),
    status: "playing" as const,
    timing: {} as GameState["timing"],
  };
  return { ...base, ...overrides } as GameState;
}

// Helper to create minimal ViewModel for testing
function createTestVm(overrides: Partial<ViewModel> = {}): ViewModel {
  const base = {
    board: [[]],
    hud: { lines: 0, mode: "test", score: 0 },
    justLocked: false,
    justSpawned: false,
    linesJustCleared: 0,
    topOut: false,
  };
  return { ...base, ...overrides } as ViewModel;
}

describe("mapGameStateToViewModel — Transition Detection", () => {
  it("detects initial spawn when no previous ViewModel", () => {
    const state = createTestState({
      active: {
        id: "T",
        rot: "spawn",
        x: createGridCoord(4),
        y: createGridCoord(0),
      },
      status: "playing",
    });

    const vm = mapGameStateToViewModel(state, null);

    expect(vm.justSpawned).toBe(true);
    expect(vm.justLocked).toBe(false);
    expect(vm.linesJustCleared).toBe(0);
  });

  it("detects spawn when active piece appears", () => {
    const prevVm = createTestVm({
      // No active piece in previous state
    });

    const state = createTestState({
      active: {
        id: "T",
        rot: "spawn",
        x: createGridCoord(4),
        y: createGridCoord(0),
      },
      status: "playing",
    });

    const vm = mapGameStateToViewModel(state, prevVm);

    expect(vm.justSpawned).toBe(true);
    expect(vm.justLocked).toBe(false);
    expect(vm.linesJustCleared).toBe(0);
  });

  it("detects lock when transitioning from no active to active piece (after lock resolution)", () => {
    const prevVm = createTestVm({
      // No active piece (was in resolvingLock or lineClear state)
    });

    const state = createTestState({
      active: {
        id: "T",
        rot: "spawn",
        x: createGridCoord(4),
        y: createGridCoord(0),
      },
      status: "playing",
    });

    const vm = mapGameStateToViewModel(state, prevVm);

    // This should detect as spawn, not lock (since piece appeared)
    expect(vm.justSpawned).toBe(true);
    expect(vm.justLocked).toBe(false);
  });

  it("detects line clear when line count increases", () => {
    const prevVm = createTestVm({
      hud: { lines: 5, mode: "test", score: 0 },
    });

    const state = createTestState({
      stats: createTestStats({
        linesCleared: 7, // +2 lines cleared
      }),
    });

    const vm = mapGameStateToViewModel(state, prevVm);

    expect(vm.justSpawned).toBe(false);
    expect(vm.justLocked).toBe(false);
    expect(vm.linesJustCleared).toBe(2);
  });

  it("does not detect transitions when nothing changes", () => {
    const prevVm = createTestVm({
      active: {
        cells: [{ col: toCol(4), row: toRow(0) }],
        kind: "T",
      },
      hud: { lines: 5, mode: "test", score: 0 },
    });

    const state = createTestState({
      active: {
        id: "T",
        rot: "spawn",
        x: createGridCoord(4),
        y: createGridCoord(0),
      },
      stats: createTestStats({
        linesCleared: 5, // Same as before
      }),
      status: "playing",
    });

    const vm = mapGameStateToViewModel(state, prevVm);

    expect(vm.justSpawned).toBe(false);
    expect(vm.justLocked).toBe(false);
    expect(vm.linesJustCleared).toBe(0);
  });

  it("detects multiple transitions simultaneously", () => {
    const prevVm = createTestVm({
      // No active piece
      hud: { lines: 3, mode: "test", score: 0 },
    });

    const state = createTestState({
      active: {
        id: "T",
        rot: "spawn",
        x: createGridCoord(4),
        y: createGridCoord(0),
      },
      stats: createTestStats({
        linesCleared: 5, // +2 lines cleared
      }),
      status: "playing",
    });

    const vm = mapGameStateToViewModel(state, prevVm);

    // Should detect both spawn and line clear
    expect(vm.justSpawned).toBe(true);
    expect(vm.justLocked).toBe(false);
    expect(vm.linesJustCleared).toBe(2);
  });
});
