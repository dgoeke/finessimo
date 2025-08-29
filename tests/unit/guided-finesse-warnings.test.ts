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
import { reducer } from "../../src/state/reducer";
import { createGridCoord } from "../../src/types/brands";
import { createTimestamp } from "../../src/types/timestamp";
import { createTestInitAction } from "../test-helpers";

import type { FinesseResult } from "../../src/finesse/calculator";
import type { SrsRecord, SrsDeck } from "../../src/srs/fsrs-adapter";
import type { ActivePiece } from "../../src/state/types";

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

  test("does not log warning when finesse is faulty", () => {
    // Create a proper game state using the reducer
    const gameState = reducer(
      undefined,
      createTestInitAction({ mode: "guided" }),
    );

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

    // No warnings are logged in current behavior
    expect(consoleWarnSpy).not.toHaveBeenCalled();

    // But FSRS should record the attempt as "again"
    expect(fsrsAdapter.rate).toHaveBeenCalledWith(
      expect.objectContaining({ key: "T:spawn:3" }),
      "again",
      expect.any(Number),
    );

    mockGetDeck.mockRestore();
    mockSelectCard.mockRestore();
  });

  test("does not log warning when finesse is optimal", () => {
    let gameState = reducer(
      undefined,
      createTestInitAction({ mode: "guided" }),
    );

    // Add some processed input so hasPlayerInput = true
    gameState = {
      ...gameState,
      processedInputLog: [
        {
          dir: -1,
          kind: "TapMove",
          t: gameState.stats.startedAtMs,
        },
      ],
    };

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

  test("does not log warning when piece is placed at wrong target", () => {
    const gameState = reducer(
      undefined,
      createTestInitAction({ mode: "guided" }),
    );

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

    // No warnings are logged in current behavior
    expect(consoleWarnSpy).not.toHaveBeenCalled();

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
