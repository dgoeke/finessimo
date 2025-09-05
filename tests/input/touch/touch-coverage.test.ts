import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";

import { createSevenBagRng } from "@/core/rng/seeded";
import { Airborne } from "@/engine/physics/lock-delay.machine";
import { TouchInputHandler } from "@/input/touch/handler";
import {
  type GameState,
  createBoardCells,
  type ActivePiece,
} from "@/state/types";
import { createDurationMs, createSeed, createGridCoord } from "@/types/brands";
import { createTimestamp, fromNow } from "@/types/timestamp";

import { createTestPhysicsState } from "../../test-helpers";

// Mock DOM APIs for touch support
Object.defineProperty(window, "ontouchstart", {
  value: {},
  writable: true,
});

// Mock document.elementFromPoint
Object.defineProperty(document, "elementFromPoint", {
  value: jest.fn(() => {
    const mockElement = document.createElement("div");
    mockElement.setAttribute("data-action", "RotateCW");
    return mockElement;
  }),
  writable: true,
});

// Mock getBoardFrame function
jest.mock("../../../src/ui/utils/dom", () => ({
  getBoardFrame: jest.fn(() => {
    const mockFrame = document.createElement("div");
    mockFrame.className = "board-frame";
    document.body.appendChild(mockFrame);
    return mockFrame;
  }),
}));

const createMockGameState = (overrides: Partial<GameState> = {}): GameState =>
  ({
    active: {
      id: "T",
      rot: "spawn",
      x: createGridCoord(4),
      y: createGridCoord(0),
    } as ActivePiece,
    board: {
      cells: createBoardCells(),
      height: 20,
      totalHeight: 23,
      vanishRows: 3,
      width: 10,
    },
    canHold: true,
    currentMode: "freePlay",
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

// Helper to create mock touch events
const createTouchEvent = (
  type: "touchstart" | "touchmove" | "touchend",
  touches: Array<{ clientX: number; clientY: number; identifier: number }>,
  element?: Element,
): TouchEvent => {
  // Create a proper TouchList-like object
  const touchList = Object.assign(touches, {
    item: (index: number) => touches[index] ?? null,
  });

  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", {
    value: touchList,
    writable: false,
  });
  Object.defineProperty(event, "changedTouches", {
    value: touchList,
    writable: false,
  });
  Object.defineProperty(event, "target", {
    value: element ?? null,
    writable: false,
  });

  return event as TouchEvent;
};

describe("TouchInputHandler - Coverage Tests", () => {
  let handler: TouchInputHandler;
  let mockDispatch: jest.Mock;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '<div class="board-frame"></div>';

    handler = new TouchInputHandler();
    mockDispatch = jest.fn();
    handler.init(mockDispatch);
  });

  afterEach(() => {
    handler.stop();
    document.body.innerHTML = "";
    jest.restoreAllMocks();
  });

  describe("basic functionality", () => {
    test("creates touch controls when touch is supported", () => {
      Object.defineProperty(window, "ontouchstart", {
        value: {},
        writable: true,
      });

      handler.start();

      const overlay = document.querySelector("#touch-controls");
      expect(overlay).toBeTruthy();
    });

    test("handles touch events without throwing", () => {
      const gameState = createMockGameState();
      handler.update(gameState, fromNow());
      handler.start();

      const touchZone = document.querySelector('[data-action="RotateCW"]');
      if (touchZone !== null) {
        const touchEvent = createTouchEvent(
          "touchstart",
          [{ clientX: 100, clientY: 100, identifier: 0 }],
          touchZone,
        );

        expect(() => {
          touchZone.dispatchEvent(touchEvent);
        }).not.toThrow();
      }
    });

    test("handles different game states", () => {
      const gameState = createMockGameState({ active: undefined });

      expect(() => {
        handler.update(gameState, fromNow());
      }).not.toThrow();
    });

    test("handles non-playing status", () => {
      const gameState = createMockGameState({ status: "topOut" });

      expect(() => {
        handler.update(gameState, fromNow());
      }).not.toThrow();
    });

    test("handles initialization and cleanup", () => {
      expect(() => {
        handler.start();
        handler.stop();
      }).not.toThrow();
    });
  });
});
