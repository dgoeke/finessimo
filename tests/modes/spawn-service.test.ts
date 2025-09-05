import { describe, it, expect, beforeEach, jest } from "@jest/globals";

import { createSevenBagRng } from "../../src/core/rng/seeded";
import {
  getActiveRng,
  getNextFromMode,
  getPreviewFromMode,
  planPreviewRefill,
} from "../../src/modes/spawn-service";
import { createTestGameState } from "../test-helpers";

import type { PieceRandomGenerator } from "../../src/core/rng/interface";
import type { FinesseResult } from "../../src/engine/finesse/calculator";
import type { GameMode, GameModeResult } from "../../src/modes/index";
import type { GameState, PieceId, ActivePiece } from "../../src/state/types";

describe("modes/spawn-service", () => {
  let baseState: GameState;
  let mockRng: PieceRandomGenerator;

  beforeEach(() => {
    baseState = createTestGameState();
    mockRng = createSevenBagRng("test-spawn-service");
  });

  describe("getActiveRng", () => {
    it("uses mode's createRng when available", () => {
      const customRng = createSevenBagRng("custom-mode");
      const mode: Partial<GameMode> = {
        createRng: jest
          .fn<
            (seed: string, prev?: PieceRandomGenerator) => PieceRandomGenerator
          >()
          .mockReturnValue(customRng),
        getNextPrompt: jest
          .fn<(gameState: GameState) => string | null>()
          .mockReturnValue("test prompt"),
        name: "test-mode",
        onPieceLocked: jest
          .fn<
            (
              gameState: GameState,
              finesseResult: FinesseResult,
              lockedPiece: ActivePiece,
              finalPosition: ActivePiece,
            ) => GameModeResult
          >()
          .mockReturnValue({ isComplete: false }),
        reset: jest.fn(),
        shouldPromptNext: jest
          .fn<(gameState: GameState) => boolean>()
          .mockReturnValue(false),
      };

      const result = getActiveRng(mode as GameMode, "test-seed", mockRng);

      expect(mode.createRng).toHaveBeenCalledWith("test-seed", mockRng);
      expect(result).toBe(customRng);
    });

    it("falls back to createSevenBagRng when mode is undefined", () => {
      const result = getActiveRng(undefined, "fallback-seed");

      expect(result).toBeDefined();
      expect(typeof result.getNextPiece).toBe("function");
      expect(typeof result.getNextPieces).toBe("function");
    });

    it("falls back to createSevenBagRng when mode has no createRng method", () => {
      const mode: Partial<GameMode> = {
        getNextPrompt: jest
          .fn<(gameState: GameState) => string | null>()
          .mockReturnValue(null),
        name: "no-rng-mode",
        onPieceLocked: jest
          .fn<
            (
              gameState: GameState,
              finesseResult: FinesseResult,
              lockedPiece: ActivePiece,
              finalPosition: ActivePiece,
            ) => GameModeResult
          >()
          .mockReturnValue({ isComplete: false }),
        reset: jest.fn(),
        shouldPromptNext: jest
          .fn<(gameState: GameState) => boolean>()
          .mockReturnValue(false),
        // No createRng method
      };

      const result = getActiveRng(mode as GameMode, "fallback-seed");

      expect(result).toBeDefined();
      expect(typeof result.getNextPiece).toBe("function");
    });

    it("handles mode with createRng that is not a function", () => {
      const mode = {
        createRng: "not-a-function" as unknown as GameMode["createRng"], // Intentionally wrong type
        getNextPrompt: jest
          .fn<(gameState: GameState) => string | null>()
          .mockReturnValue(null),
        name: "broken-rng-mode",
        onPieceLocked: jest
          .fn<
            (
              gameState: GameState,
              finesseResult: FinesseResult,
              lockedPiece: ActivePiece,
              finalPosition: ActivePiece,
            ) => GameModeResult
          >()
          .mockReturnValue({ isComplete: false }),
        reset: jest.fn(),
        shouldPromptNext: jest
          .fn<(gameState: GameState) => boolean>()
          .mockReturnValue(false),
      };

      const result = getActiveRng(mode as GameMode, "fallback-seed");

      expect(result).toBeDefined();
      expect(typeof result.getNextPiece).toBe("function");
    });

    it("passes previous RNG to mode's createRng", () => {
      const customRng = createSevenBagRng("custom");
      const mode: Partial<GameMode> = {
        createRng: jest
          .fn<
            (seed: string, prev?: PieceRandomGenerator) => PieceRandomGenerator
          >()
          .mockReturnValue(customRng),
        getNextPrompt: jest
          .fn<(gameState: GameState) => string | null>()
          .mockReturnValue("test prompt"),
        name: "test-mode",
        onPieceLocked: jest
          .fn<
            (
              gameState: GameState,
              finesseResult: FinesseResult,
              lockedPiece: ActivePiece,
              finalPosition: ActivePiece,
            ) => GameModeResult
          >()
          .mockReturnValue({ isComplete: false }),
        reset: jest.fn(),
        shouldPromptNext: jest
          .fn<(gameState: GameState) => boolean>()
          .mockReturnValue(false),
      };

      const prevRng = createSevenBagRng("previous");
      getActiveRng(mode as GameMode, "seed", prevRng);

      expect(mode.createRng).toHaveBeenCalledWith("seed", prevRng);
    });

    it("works with different seeds", () => {
      const seeds = ["seed1", "seed2", "test", "custom"];

      for (const seed of seeds) {
        const result = getActiveRng(undefined, seed);
        expect(result).toBeDefined();
      }
    });
  });

  describe("getNextFromMode", () => {
    it("uses mode's getNextPiece when available", () => {
      const mockResult = { newRng: mockRng, piece: "T" as PieceId };
      const mode: Partial<GameMode> = {
        getNextPiece: jest
          .fn<
            (
              state: GameState,
              rng: PieceRandomGenerator,
            ) => { piece: PieceId; newRng: PieceRandomGenerator }
          >()
          .mockReturnValue(mockResult),
        getNextPrompt: jest
          .fn<(gameState: GameState) => string | null>()
          .mockReturnValue(null),
        name: "test-mode",
        onPieceLocked: jest
          .fn<
            (
              gameState: GameState,
              finesseResult: FinesseResult,
              lockedPiece: ActivePiece,
              finalPosition: ActivePiece,
            ) => GameModeResult
          >()
          .mockReturnValue({ isComplete: false }),
        reset: jest.fn(),
        shouldPromptNext: jest
          .fn<(gameState: GameState) => boolean>()
          .mockReturnValue(false),
      };

      const state = { ...baseState, rng: mockRng };
      const result = getNextFromMode(state, mode as GameMode);

      expect(mode.getNextPiece).toHaveBeenCalledWith(state, mockRng);
      expect(result).toBe(mockResult);
    });

    it("falls back to state.rng.getNextPiece when mode is undefined", () => {
      const state = { ...baseState, rng: mockRng };
      const result = getNextFromMode(state, undefined);

      expect(result).toBeDefined();
      expect(result.piece).toBeDefined();
      expect(result.newRng).toBeDefined();
      expect(typeof result.piece).toBe("string");
    });

    it("falls back to state.rng.getNextPiece when mode has no getNextPiece method", () => {
      const mode: Partial<GameMode> = {
        getNextPrompt: jest
          .fn<(gameState: GameState) => string | null>()
          .mockReturnValue(null),
        name: "no-next-piece-mode",
        onPieceLocked: jest
          .fn<
            (
              gameState: GameState,
              finesseResult: FinesseResult,
              lockedPiece: ActivePiece,
              finalPosition: ActivePiece,
            ) => GameModeResult
          >()
          .mockReturnValue({ isComplete: false }),
        reset: jest.fn(),
        shouldPromptNext: jest
          .fn<(gameState: GameState) => boolean>()
          .mockReturnValue(false),
        // No getNextPiece method
      };

      const state = { ...baseState, rng: mockRng };
      const result = getNextFromMode(state, mode as GameMode);

      expect(result).toBeDefined();
      expect(result.piece).toBeDefined();
      expect(result.newRng).toBeDefined();
    });

    it("handles mode with getNextPiece that is not a function", () => {
      const mode = {
        getNextPiece: "not-a-function" as unknown as GameMode["getNextPiece"], // Intentionally wrong type
        getNextPrompt: jest
          .fn<(gameState: GameState) => string | null>()
          .mockReturnValue(null),
        name: "broken-next-piece-mode",
        onPieceLocked: jest
          .fn<
            (
              gameState: GameState,
              finesseResult: FinesseResult,
              lockedPiece: ActivePiece,
              finalPosition: ActivePiece,
            ) => GameModeResult
          >()
          .mockReturnValue({ isComplete: false }),
        reset: jest.fn(),
        shouldPromptNext: jest
          .fn<(gameState: GameState) => boolean>()
          .mockReturnValue(false),
      };

      const state = { ...baseState, rng: mockRng };
      const result = getNextFromMode(state, mode as GameMode);

      expect(result).toBeDefined();
      expect(result.piece).toBeDefined();
      expect(result.newRng).toBeDefined();
    });

    it("passes correct arguments to mode's getNextPiece", () => {
      const mode: Partial<GameMode> = {
        getNextPiece: jest
          .fn<
            (
              state: GameState,
              rng: PieceRandomGenerator,
            ) => { piece: PieceId; newRng: PieceRandomGenerator }
          >()
          .mockReturnValue({ newRng: mockRng, piece: "I" as PieceId }),
        getNextPrompt: jest
          .fn<(gameState: GameState) => string | null>()
          .mockReturnValue(null),
        name: "test-mode",
        onPieceLocked: jest
          .fn<
            (
              gameState: GameState,
              finesseResult: FinesseResult,
              lockedPiece: ActivePiece,
              finalPosition: ActivePiece,
            ) => GameModeResult
          >()
          .mockReturnValue({ isComplete: false }),
        reset: jest.fn(),
        shouldPromptNext: jest
          .fn<(gameState: GameState) => boolean>()
          .mockReturnValue(false),
      };

      const state = { ...baseState, rng: mockRng };
      getNextFromMode(state, mode as GameMode);

      expect(mode.getNextPiece).toHaveBeenCalledWith(state, state.rng);
    });

    it("returns valid piece IDs", () => {
      const validPieces: Array<PieceId> = ["I", "O", "T", "S", "Z", "J", "L"];

      const state = { ...baseState, rng: mockRng };
      const result = getNextFromMode(state, undefined);

      expect(validPieces).toContain(result.piece);
    });
  });

  describe("getPreviewFromMode", () => {
    it("uses mode's getPreview when available", () => {
      const mockResult = {
        newRng: mockRng,
        pieces: ["T", "I", "O"] as Array<PieceId>,
      };
      const mode: Partial<GameMode> = {
        getNextPrompt: jest
          .fn<(gameState: GameState) => string | null>()
          .mockReturnValue(null),
        getPreview: jest
          .fn<
            (
              state: GameState,
              rng: PieceRandomGenerator,
              count: number,
            ) => { pieces: Array<PieceId>; newRng: PieceRandomGenerator }
          >()
          .mockReturnValue(mockResult),
        name: "test-mode",
        onPieceLocked: jest
          .fn<
            (
              gameState: GameState,
              finesseResult: FinesseResult,
              lockedPiece: ActivePiece,
              finalPosition: ActivePiece,
            ) => GameModeResult
          >()
          .mockReturnValue({ isComplete: false }),
        reset: jest.fn(),
        shouldPromptNext: jest
          .fn<(gameState: GameState) => boolean>()
          .mockReturnValue(false),
      };

      const state = { ...baseState, rng: mockRng };
      const result = getPreviewFromMode(state, mode as GameMode, 3);

      expect(mode.getPreview).toHaveBeenCalledWith(state, mockRng, 3);
      expect(result).toBe(mockResult);
    });

    it("falls back to state.rng.getNextPieces when mode is undefined", () => {
      const state = { ...baseState, rng: mockRng };
      const result = getPreviewFromMode(state, undefined, 5);

      expect(result).toBeDefined();
      expect(result.pieces).toHaveLength(5);
      expect(result.newRng).toBeDefined();
    });

    it("falls back to state.rng.getNextPieces when mode has no getPreview method", () => {
      const mode: Partial<GameMode> = {
        getNextPrompt: jest
          .fn<(gameState: GameState) => string | null>()
          .mockReturnValue(null),
        name: "no-preview-mode",
        onPieceLocked: jest
          .fn<
            (
              gameState: GameState,
              finesseResult: FinesseResult,
              lockedPiece: ActivePiece,
              finalPosition: ActivePiece,
            ) => GameModeResult
          >()
          .mockReturnValue({ isComplete: false }),
        reset: jest.fn(),
        shouldPromptNext: jest
          .fn<(gameState: GameState) => boolean>()
          .mockReturnValue(false),
        // No getPreview method
      };

      const state = { ...baseState, rng: mockRng };
      const result = getPreviewFromMode(state, mode as GameMode, 4);

      expect(result).toBeDefined();
      expect(result.pieces).toHaveLength(4);
      expect(result.newRng).toBeDefined();
    });

    it("handles mode with getPreview that is not a function", () => {
      const mode = {
        getNextPrompt: jest
          .fn<(gameState: GameState) => string | null>()
          .mockReturnValue(null),
        getPreview: "not-a-function" as unknown as GameMode["getPreview"], // Intentionally wrong type
        name: "broken-preview-mode",
        onPieceLocked: jest
          .fn<
            (
              gameState: GameState,
              finesseResult: FinesseResult,
              lockedPiece: ActivePiece,
              finalPosition: ActivePiece,
            ) => GameModeResult
          >()
          .mockReturnValue({ isComplete: false }),
        reset: jest.fn(),
        shouldPromptNext: jest
          .fn<(gameState: GameState) => boolean>()
          .mockReturnValue(false),
      };

      const state = { ...baseState, rng: mockRng };
      const result = getPreviewFromMode(state, mode as GameMode, 2);

      expect(result).toBeDefined();
      expect(result.pieces).toHaveLength(2);
      expect(result.newRng).toBeDefined();
    });

    it("handles different preview counts", () => {
      const counts = [0, 1, 3, 5, 10];
      const state = { ...baseState, rng: mockRng };

      for (const count of counts) {
        const result = getPreviewFromMode(state, undefined, count);
        expect(result.pieces).toHaveLength(count);
      }
    });

    it("passes correct arguments to mode's getPreview", () => {
      const mode: Partial<GameMode> = {
        getNextPrompt: jest
          .fn<(gameState: GameState) => string | null>()
          .mockReturnValue(null),
        getPreview: jest
          .fn<
            (
              state: GameState,
              rng: PieceRandomGenerator,
              count: number,
            ) => { pieces: Array<PieceId>; newRng: PieceRandomGenerator }
          >()
          .mockReturnValue({ newRng: mockRng, pieces: [] }),
        name: "test-mode",
        onPieceLocked: jest
          .fn<
            (
              gameState: GameState,
              finesseResult: FinesseResult,
              lockedPiece: ActivePiece,
              finalPosition: ActivePiece,
            ) => GameModeResult
          >()
          .mockReturnValue({ isComplete: false }),
        reset: jest.fn(),
        shouldPromptNext: jest
          .fn<(gameState: GameState) => boolean>()
          .mockReturnValue(false),
      };

      const state = { ...baseState, rng: mockRng };
      getPreviewFromMode(state, mode as GameMode, 7);

      expect(mode.getPreview).toHaveBeenCalledWith(state, state.rng, 7);
    });

    it("returns valid piece arrays", () => {
      const validPieces: Array<PieceId> = ["I", "O", "T", "S", "Z", "J", "L"];
      const state = { ...baseState, rng: mockRng };
      const result = getPreviewFromMode(state, undefined, 10);

      for (const piece of result.pieces) {
        expect(validPieces).toContain(piece);
      }
    });
  });

  describe("planPreviewRefill", () => {
    it("returns null when no refill is needed", () => {
      const state = {
        ...baseState,
        nextQueue: ["T", "I", "O", "S", "Z"] as Array<PieceId>, // 5 pieces
      };

      const result = planPreviewRefill(state, undefined, 3);

      expect(result).toBeNull();
    });

    it("returns null when exactly at minimum count", () => {
      const state = {
        ...baseState,
        nextQueue: ["T", "I", "O"] as Array<PieceId>, // 3 pieces
      };

      const result = planPreviewRefill(state, undefined, 3);

      expect(result).toBeNull();
    });

    it("plans refill when queue is below minimum count", () => {
      const state = {
        ...baseState,
        nextQueue: ["T"] as Array<PieceId>, // 1 piece, need 4 more
        rng: mockRng,
      };

      const result = planPreviewRefill(state, undefined, 5);

      expect(result).not.toBeNull();
      expect(result?.pieces).toHaveLength(4); // Need 4 more pieces
      expect(result?.newRng).toBeDefined();
    });

    it("plans refill when queue is empty", () => {
      const state = {
        ...baseState,
        nextQueue: [] as Array<PieceId>, // Empty queue
        rng: mockRng,
      };

      const result = planPreviewRefill(state, undefined, 3);

      expect(result).not.toBeNull();
      expect(result?.pieces).toHaveLength(3); // Need all 3 pieces
      expect(result?.newRng).toBeDefined();
    });

    it("handles zero minimum count", () => {
      const state = {
        ...baseState,
        nextQueue: [] as Array<PieceId>,
      };

      const result = planPreviewRefill(state, undefined, 0);

      expect(result).toBeNull();
    });

    it("handles negative minimum count", () => {
      const state = {
        ...baseState,
        nextQueue: ["T", "I"] as Array<PieceId>,
      };

      const result = planPreviewRefill(state, undefined, -5);

      expect(result).toBeNull();
    });

    it("uses mode's getPreview when available", () => {
      const mockResult = {
        newRng: mockRng,
        pieces: ["J", "L"] as Array<PieceId>,
      };
      const mode: Partial<GameMode> = {
        getNextPrompt: jest
          .fn<(gameState: GameState) => string | null>()
          .mockReturnValue(null),
        getPreview: jest
          .fn<
            (
              state: GameState,
              rng: PieceRandomGenerator,
              count: number,
            ) => { pieces: Array<PieceId>; newRng: PieceRandomGenerator }
          >()
          .mockReturnValue(mockResult),
        name: "test-mode",
        onPieceLocked: jest
          .fn<
            (
              gameState: GameState,
              finesseResult: FinesseResult,
              lockedPiece: ActivePiece,
              finalPosition: ActivePiece,
            ) => GameModeResult
          >()
          .mockReturnValue({ isComplete: false }),
        reset: jest.fn(),
        shouldPromptNext: jest
          .fn<(gameState: GameState) => boolean>()
          .mockReturnValue(false),
      };

      const state = {
        ...baseState,
        nextQueue: ["T"] as Array<PieceId>, // 1 piece, need 2 more
        rng: mockRng,
      };

      const result = planPreviewRefill(state, mode as GameMode, 3);

      expect(mode.getPreview).toHaveBeenCalledWith(state, mockRng, 2);
      expect(result).toBe(mockResult);
    });

    it("calculates correct deficit for various scenarios", () => {
      const scenarios = [
        { current: 0, expectedDeficit: 5, min: 5 },
        { current: 2, expectedDeficit: 5, min: 7 },
        { current: 3, expectedDeficit: 0, min: 3 },
        { current: 5, expectedDeficit: 0, min: 3 },
        { current: 1, expectedDeficit: 9, min: 10 },
      ];

      for (const scenario of scenarios) {
        const queue = new Array(scenario.current).fill("T") as Array<PieceId>;
        const state = { ...baseState, nextQueue: queue, rng: mockRng };

        const result = planPreviewRefill(state, undefined, scenario.min);

        if (scenario.expectedDeficit === 0) {
          expect(result).toBeNull();
        } else {
          expect(result).not.toBeNull();
          expect(result?.pieces).toHaveLength(scenario.expectedDeficit);
        }
      }
    });

    it("preserves original state", () => {
      const originalQueue = ["T", "I"] as Array<PieceId>;
      const state = {
        ...baseState,
        nextQueue: originalQueue,
        rng: mockRng,
      };

      planPreviewRefill(state, undefined, 5);

      // Original state should be unchanged
      expect(state.nextQueue).toBe(originalQueue);
      expect(state.nextQueue).toEqual(["T", "I"]);
    });

    it("works with different queue lengths and minimum counts", () => {
      const testCases = [
        { minCount: 1, queueLength: 0 },
        { minCount: 7, queueLength: 0 },
        { minCount: 5, queueLength: 2 },
        { minCount: 8, queueLength: 3 },
        { minCount: 4, queueLength: 1 },
      ];

      for (const testCase of testCases) {
        const queue = new Array(testCase.queueLength).fill(
          "O",
        ) as Array<PieceId>;
        const state = { ...baseState, nextQueue: queue, rng: mockRng };

        const result = planPreviewRefill(state, undefined, testCase.minCount);
        const expectedDeficit = Math.max(
          0,
          testCase.minCount - testCase.queueLength,
        );

        if (expectedDeficit === 0) {
          expect(result).toBeNull();
        } else {
          expect(result?.pieces).toHaveLength(expectedDeficit);
        }
      }
    });
  });

  describe("integration scenarios", () => {
    it("works together for complete spawn service workflow", () => {
      // Create a custom mode with all RNG methods
      const customMode: Partial<GameMode> = {
        createRng: jest
          .fn<
            (seed: string, prev?: PieceRandomGenerator) => PieceRandomGenerator
          >()
          .mockReturnValue(mockRng),
        getNextPiece: jest
          .fn<
            (
              state: GameState,
              rng: PieceRandomGenerator,
            ) => { piece: PieceId; newRng: PieceRandomGenerator }
          >()
          .mockReturnValue({ newRng: mockRng, piece: "Z" as PieceId }),
        getNextPrompt: jest
          .fn<(gameState: GameState) => string | null>()
          .mockReturnValue(null),
        getPreview: jest
          .fn<
            (
              state: GameState,
              rng: PieceRandomGenerator,
              count: number,
            ) => { pieces: Array<PieceId>; newRng: PieceRandomGenerator }
          >()
          .mockReturnValue({
            newRng: mockRng,
            pieces: ["J", "L", "S"] as Array<PieceId>,
          }),
        name: "integrated-mode",
        onPieceLocked: jest
          .fn<
            (
              gameState: GameState,
              finesseResult: FinesseResult,
              lockedPiece: ActivePiece,
              finalPosition: ActivePiece,
            ) => GameModeResult
          >()
          .mockReturnValue({ isComplete: false }),
        reset: jest.fn(),
        shouldPromptNext: jest
          .fn<(gameState: GameState) => boolean>()
          .mockReturnValue(false),
      };

      // Get active RNG
      getActiveRng(customMode as GameMode, "integration-seed");
      expect(customMode.createRng).toHaveBeenCalledWith(
        "integration-seed",
        undefined,
      );

      // Get next piece
      const state = {
        ...baseState,
        nextQueue: ["T"] as Array<PieceId>,
        rng: mockRng,
      };
      const nextResult = getNextFromMode(state, customMode as GameMode);
      expect(customMode.getNextPiece).toHaveBeenCalledWith(state, mockRng);
      expect(nextResult.piece).toBe("Z");

      // Plan preview refill
      const refillResult = planPreviewRefill(state, customMode as GameMode, 5);
      expect(customMode.getPreview).toHaveBeenCalledWith(state, mockRng, 4); // Need 4 more pieces
      expect(refillResult?.pieces).toEqual(["J", "L", "S"]);
    });

    it("gracefully handles undefined mode throughout workflow", () => {
      // All functions should work without a mode
      const rng = getActiveRng(undefined, "no-mode-seed");
      expect(rng).toBeDefined();

      const state = { ...baseState, nextQueue: [] as Array<PieceId>, rng };

      const nextResult = getNextFromMode(state, undefined);
      expect(nextResult.piece).toBeDefined();

      const previewResult = getPreviewFromMode(state, undefined, 3);
      expect(previewResult.pieces).toHaveLength(3);

      const refillResult = planPreviewRefill(state, undefined, 2);
      expect(refillResult?.pieces).toHaveLength(2);
    });

    it("handles mixed mode capabilities", () => {
      // Mode with only some RNG methods
      const partialMode: Partial<GameMode> = {
        createRng: jest
          .fn<
            (seed: string, prev?: PieceRandomGenerator) => PieceRandomGenerator
          >()
          .mockReturnValue(mockRng),
        getNextPrompt: jest
          .fn<(gameState: GameState) => string | null>()
          .mockReturnValue(null),
        name: "partial-mode",
        // Has createRng but no getNextPiece or getPreview
        onPieceLocked: jest
          .fn<
            (
              gameState: GameState,
              finesseResult: FinesseResult,
              lockedPiece: ActivePiece,
              finalPosition: ActivePiece,
            ) => GameModeResult
          >()
          .mockReturnValue({ isComplete: false }),
        reset: jest.fn(),
        shouldPromptNext: jest
          .fn<(gameState: GameState) => boolean>()
          .mockReturnValue(false),
      };

      getActiveRng(partialMode as GameMode, "partial-seed");
      expect(partialMode.createRng).toHaveBeenCalled();

      const state = { ...baseState, rng: mockRng };

      // Should fall back to default for missing methods
      const nextResult = getNextFromMode(state, partialMode as GameMode);
      expect(nextResult).toBeDefined();

      const previewResult = getPreviewFromMode(
        state,
        partialMode as GameMode,
        3,
      );
      expect(previewResult.pieces).toHaveLength(3);
    });
  });
});
