import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { createEmptyCard } from "ts-fsrs";

import { GuidedMode } from "../../src/modes/guided";
import {
  createCardId,
  createDeckId,
  createColumn,
} from "../../src/modes/guided/types";
import * as fsrsAdapter from "../../src/srs/fsrs-adapter";
import * as srsStorage from "../../src/srs/storage";
import { createGridCoord } from "../../src/types/brands";
import { createTimestamp } from "../../src/types/timestamp";

import type { FinesseResult } from "../../src/finesse/calculator";
import type { SrsRecord, SrsDeck } from "../../src/srs/fsrs-adapter";
import type { GameState, ActivePiece } from "../../src/state/types";

describe("Guided mode finesse warnings", () => {
  let consoleWarnSpy: jest.SpiedFunction<typeof console.warn>;
  let guidedMode: GuidedMode;

  // Helper to create valid CardInput for mocking
  const createMockCardInput = () => {
    return createEmptyCard(new Date(1));
  };

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {
      // Mock implementation for console.warn
    });
    guidedMode = new GuidedMode();

    // Mock SRS functions to avoid FSRS library issues
    jest.spyOn(fsrsAdapter, "rate").mockReturnValue({
      card: { piece: "T", rot: "spawn", x: createColumn(3) },
      due: createTimestamp(1),
      fsrs: { card: createMockCardInput() },
      key: createCardId("T:spawn:3"),
    } satisfies SrsRecord);

    jest.spyOn(fsrsAdapter, "updateDeckRecord").mockReturnValue({
      id: createDeckId("test"),
      items: new Map(),
      params: { maxNewPerSession: 50 },
    } satisfies SrsDeck);

    jest.spyOn(srsStorage, "saveGuidedDeck").mockImplementation(() => {
      // Mock implementation for saveGuidedDeck
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("logs console warning when finesse is faulty", () => {
    // Create a minimal game state
    const gameState = {
      currentMode: "guided",
      modeData: { deck: { items: new Map() } },
      stats: { attempts: 1, startedAtMs: createTimestamp(1000) },
    } as GameState;

    const finesseResult: FinesseResult = {
      faults: [{ description: "Unnecessary move", type: "extra_input" }],
      kind: "faulty",
      optimalSequences: [["MoveLeft", "HardDrop"]],
      playerSequence: ["MoveLeft", "MoveLeft", "HardDrop"],
    };

    const lockedPiece: ActivePiece = {
      id: "T",
      rot: "spawn",
      x: createGridCoord(3),
      y: createGridCoord(0),
    };

    const finalPosition: ActivePiece = {
      id: "T",
      rot: "spawn",
      x: createGridCoord(3),
      y: createGridCoord(18),
    };

    // Mock the getDeck method to return a deck with the expected card
    const mockGetDeck = jest.spyOn(guidedMode, "getDeck").mockReturnValue({
      id: createDeckId("test"),
      items: new Map([
        [
          createCardId("T:spawn:3"),
          {
            card: { piece: "T", rot: "spawn", x: createColumn(3) },
            due: createTimestamp(1),
            fsrs: { card: createMockCardInput() },
            key: createCardId("T:spawn:3"),
          } satisfies SrsRecord,
        ],
      ]),
      params: { maxNewPerSession: 50 },
    } satisfies SrsDeck);

    const mockSelectCard = jest
      .spyOn(guidedMode, "selectCard")
      .mockReturnValue({
        piece: "T",
        rot: "spawn",
        x: createColumn(3),
      });

    // Call onPieceLocked
    guidedMode.onPieceLocked(
      gameState,
      finesseResult,
      lockedPiece,
      finalPosition,
    );

    // Verify console warnings were logged
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "🎯 Guided Mode: Suboptimal finesse detected!",
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith("Piece: T → 3, spawn");
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Your moves: [MoveLeft, MoveLeft, HardDrop]",
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Optimal moves: [MoveLeft, HardDrop]",
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith("Faults: Unnecessary move");

    mockGetDeck.mockRestore();
    mockSelectCard.mockRestore();
  });

  test("does not log warning when finesse is optimal", () => {
    const gameState = {
      currentMode: "guided",
      modeData: { deck: { items: new Map() } },
      stats: { attempts: 1, startedAtMs: createTimestamp(1000) },
    } as GameState;

    const finesseResult: FinesseResult = {
      kind: "optimal",
      optimalSequences: [["MoveLeft", "HardDrop"]],
      playerSequence: ["MoveLeft", "HardDrop"],
    };

    const lockedPiece: ActivePiece = {
      id: "T",
      rot: "spawn",
      x: createGridCoord(3),
      y: createGridCoord(0),
    };

    const finalPosition: ActivePiece = {
      id: "T",
      rot: "spawn",
      x: createGridCoord(3),
      y: createGridCoord(18),
    };

    // Mock the methods
    const mockGetDeck = jest.spyOn(guidedMode, "getDeck").mockReturnValue({
      id: createDeckId("test"),
      items: new Map([
        [
          createCardId("T:spawn:3"),
          {
            card: { piece: "T", rot: "spawn", x: createColumn(3) },
            due: createTimestamp(1),
            fsrs: { card: createMockCardInput() },
            key: createCardId("T:spawn:3"),
          } satisfies SrsRecord,
        ],
      ]),
      params: { maxNewPerSession: 50 },
    } satisfies SrsDeck);

    const mockSelectCard = jest
      .spyOn(guidedMode, "selectCard")
      .mockReturnValue({
        piece: "T",
        rot: "spawn",
        x: createColumn(3),
      });

    // Call onPieceLocked
    guidedMode.onPieceLocked(
      gameState,
      finesseResult,
      lockedPiece,
      finalPosition,
    );

    // Verify no console warnings were logged
    expect(consoleWarnSpy).not.toHaveBeenCalled();

    mockGetDeck.mockRestore();
    mockSelectCard.mockRestore();
  });

  test("logs warning even when piece is placed at wrong target", () => {
    const gameState = {
      currentMode: "guided",
      modeData: { deck: { items: new Map() } },
      stats: { attempts: 1, startedAtMs: createTimestamp(1000) },
    } as GameState;

    const finesseResult: FinesseResult = {
      faults: [{ description: "Wrong target placement", type: "wrong_target" }],
      kind: "faulty",
      optimalSequences: [["MoveLeft", "HardDrop"]],
      playerSequence: ["MoveRight", "HardDrop"], // Wrong direction
    };

    const lockedPiece: ActivePiece = {
      id: "T",
      rot: "spawn",
      x: createGridCoord(3),
      y: createGridCoord(0),
    };

    // Wrong final position (x=5 instead of expected x=3)
    const finalPosition: ActivePiece = {
      id: "T",
      rot: "spawn",
      x: createGridCoord(5), // Wrong target!
      y: createGridCoord(18),
    };

    // Mock the getDeck method
    const mockGetDeck = jest.spyOn(guidedMode, "getDeck").mockReturnValue({
      id: createDeckId("test"),
      items: new Map([
        [
          createCardId("T:spawn:3"),
          {
            card: { piece: "T", rot: "spawn", x: createColumn(3) },
            due: createTimestamp(1),
            fsrs: { card: createMockCardInput() },
            key: createCardId("T:spawn:3"),
          } satisfies SrsRecord,
        ],
      ]),
      params: { maxNewPerSession: 50 },
    } satisfies SrsDeck);

    const mockSelectCard = jest
      .spyOn(guidedMode, "selectCard")
      .mockReturnValue({
        piece: "T",
        rot: "spawn",
        x: createColumn(3), // Expected target
      });

    // Call onPieceLocked
    guidedMode.onPieceLocked(
      gameState,
      finesseResult,
      lockedPiece,
      finalPosition,
    );

    // Verify console warning was still logged despite wrong placement
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "🎯 Guided Mode: Suboptimal finesse detected!",
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith("Piece: T → 3, spawn");
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Your moves: [MoveRight, HardDrop]",
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Optimal moves: [MoveLeft, HardDrop]",
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Faults: Wrong target placement",
    );

    // Verify SRS was updated with "again" rating for wrong placement + faulty finesse
    expect(fsrsAdapter.rate).toHaveBeenCalledWith(
      expect.objectContaining({ key: "T:spawn:3" }),
      "again",
      expect.any(Number),
    );

    mockGetDeck.mockRestore();
    mockSelectCard.mockRestore();
  });
});
