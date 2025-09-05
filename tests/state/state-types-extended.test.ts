import { describe, it, expect } from "@jest/globals";

import { Airborne, Grounded } from "@/engine/physics/lock-delay.machine";
import {
  isPlaying,
  isResolvingLock,
  isLineClear,
  isTopOut,
  assertNever,
  isLockDelayAirborne,
  isLockDelayGrounded,
  getLockDelayStartTime,
  isValidLockDelayState,
  assertValidLockDelayState,
  hasActivePiece,
  assertHasActivePiece,
  updateGameState,
  buildPlayingState,
  buildResolvingLockState,
  buildLineClearState,
  buildTopOutState,
} from "@/state/types";
import { createGridCoord } from "@/types/brands";
import { createTimestamp } from "@/types/timestamp";

import { createTestGameState } from "../test-helpers";

import type {
  GameState,
  ActivePiece,
  LockDelayState,
  PhysicsState,
  PendingLock,
  BaseShared,
} from "@/state/types";

describe("state/types.ts - Extended Coverage", () => {
  const mockActivePiece: ActivePiece = {
    id: "T" as const,
    rot: "spawn",
    x: createGridCoord(4),
    y: createGridCoord(2),
  };

  const baseShared: BaseShared = ((s: GameState): BaseShared => ({
    board: s.board,
    boardDecorations: s.boardDecorations,
    canHold: s.canHold,
    currentMode: s.currentMode,
    finesseFeedback: s.finesseFeedback,
    gameplay: s.gameplay,
    guidance: s.guidance,
    hold: s.hold,
    modeData: s.modeData,
    modePrompt: s.modePrompt,
    nextQueue: s.nextQueue,
    physics: s.physics,
    processedInputLog: s.processedInputLog,
    rng: s.rng,
    stats: s.stats,
    tick: s.tick,
    timing: s.timing,
    uiEffects: s.uiEffects,
  }))(createTestGameState({}, { active: mockActivePiece }));

  describe("State type guards", () => {
    it("should correctly identify playing state", () => {
      const playingState = buildPlayingState(baseShared, {
        active: mockActivePiece,
      });
      expect(isPlaying(playingState)).toBe(true);

      const topOutState = buildTopOutState(baseShared);
      expect(isPlaying(topOutState)).toBe(false);
    });

    it("should correctly identify resolvingLock state", () => {
      const pendingLock: PendingLock = {
        completedLines: [],
        finalPos: mockActivePiece,
        pieceId: mockActivePiece.id,
        source: "hardDrop",
        timestampMs: createTimestamp(1000),
      };
      const resolvingState = buildResolvingLockState(baseShared, pendingLock);
      expect(isResolvingLock(resolvingState)).toBe(true);

      const playingState = buildPlayingState(baseShared, {
        active: mockActivePiece,
      });
      expect(isResolvingLock(playingState)).toBe(false);
    });

    it("should correctly identify lineClear state", () => {
      const lineClearState = buildLineClearState(baseShared);
      expect(isLineClear(lineClearState)).toBe(true);

      const playingState = buildPlayingState(baseShared, {
        active: mockActivePiece,
      });
      expect(isLineClear(playingState)).toBe(false);
    });

    it("should correctly identify topOut state", () => {
      const topOutState = buildTopOutState(baseShared);
      expect(isTopOut(topOutState)).toBe(true);

      const playingState = buildPlayingState(baseShared, {
        active: mockActivePiece,
      });
      expect(isTopOut(playingState)).toBe(false);
    });
  });

  describe("assertNever utility", () => {
    it("should throw error with descriptive message", () => {
      const invalidValue = "invalid" as never;
      expect(() => assertNever(invalidValue)).toThrow(
        "Unexpected value: invalid",
      );
    });

    it("should handle objects in error message", () => {
      const invalidObject = { test: "value" } as never;
      expect(() => assertNever(invalidObject)).toThrow(
        "Unexpected value: [object Object]",
      );
    });
  });

  describe("Lock delay state guards", () => {
    it("should correctly identify airborne lock delay state", () => {
      const airborneState = Airborne();
      expect(isLockDelayAirborne(airborneState)).toBe(true);

      const groundedState = Grounded(createTimestamp(1000));
      expect(isLockDelayAirborne(groundedState)).toBe(false);
    });

    it("should correctly identify grounded lock delay state", () => {
      const groundedState = Grounded(createTimestamp(1000));
      expect(isLockDelayGrounded(groundedState)).toBe(true);

      const airborneState = Airborne();
      expect(isLockDelayGrounded(airborneState)).toBe(false);
    });

    it("should get lock delay start time correctly", () => {
      const startTime = createTimestamp(1000);
      const groundedState = Grounded(startTime);
      expect(getLockDelayStartTime(groundedState)).toBe(startTime);

      const airborneState = Airborne();
      expect(getLockDelayStartTime(airborneState)).toBeNull();
    });
  });

  describe("Lock delay state validation", () => {
    it("should validate valid physics state", () => {
      const validPhysics: PhysicsState = {
        activePieceSpawnedAt: createTimestamp(1000),
        isSoftDropping: false,
        lastGravityTime: createTimestamp(1000),
        lineClearLines: [],
        lineClearStartTime: null,
        lockDelay: Airborne(),
      };

      expect(isValidLockDelayState(validPhysics)).toBe(true);
      expect(() => assertValidLockDelayState(validPhysics)).not.toThrow();
    });

    it("should validate grounded physics state", () => {
      const groundedPhysics: PhysicsState = {
        activePieceSpawnedAt: createTimestamp(1000),
        isSoftDropping: false,
        lastGravityTime: createTimestamp(1000),
        lineClearLines: [],
        lineClearStartTime: null,
        lockDelay: Grounded(createTimestamp(1500), 2),
      };

      expect(isValidLockDelayState(groundedPhysics)).toBe(true);
      expect(() => assertValidLockDelayState(groundedPhysics)).not.toThrow();
    });

    it("should throw on invalid lock delay state with context", () => {
      const invalidPhysics = {
        activePieceSpawnedAt: createTimestamp(1000),
        isSoftDropping: false,
        lastGravityTime: createTimestamp(1000),
        lineClearLines: [],
        lineClearStartTime: null,
        lockDelay: { resets: -1, tag: "Invalid" } as unknown as LockDelayState,
      };

      expect(isValidLockDelayState(invalidPhysics)).toBe(false);
      expect(() =>
        assertValidLockDelayState(invalidPhysics, "test context"),
      ).toThrow("Invalid lock delay state in test context");
    });

    it("should throw on invalid lock delay state without context", () => {
      const invalidPhysics = {
        activePieceSpawnedAt: createTimestamp(1000),
        isSoftDropping: false,
        lastGravityTime: createTimestamp(1000),
        lineClearLines: [],
        lineClearStartTime: null,
        lockDelay: { tag: "Invalid" } as unknown as LockDelayState,
      };

      expect(() => assertValidLockDelayState(invalidPhysics)).toThrow(
        "Invalid lock delay state:",
      );
    });
  });

  describe("Active piece validation", () => {
    it("should detect when active piece exists", () => {
      const stateWithActive = buildPlayingState(baseShared, {
        active: mockActivePiece,
      });
      expect(hasActivePiece(stateWithActive)).toBe(true);
    });

    it("should detect when active piece is missing", () => {
      const stateWithoutActive = buildPlayingState(baseShared, {
        active: undefined,
      });
      expect(hasActivePiece(stateWithoutActive)).toBe(false);
    });

    it("should assert active piece exists", () => {
      const stateWithActive = buildPlayingState(baseShared, {
        active: mockActivePiece,
      });
      expect(() => assertHasActivePiece(stateWithActive)).not.toThrow();
    });

    it("should throw when asserting active piece on state without active piece", () => {
      const stateWithoutActive = buildPlayingState(baseShared, {
        active: undefined,
      });
      expect(() => assertHasActivePiece(stateWithoutActive)).toThrow(
        "Active piece required",
      );
    });

    it("should throw with context when asserting active piece", () => {
      const stateWithoutActive = buildPlayingState(baseShared, {
        active: undefined,
      });
      expect(() =>
        assertHasActivePiece(stateWithoutActive, "movement action"),
      ).toThrow("Active piece required for movement action");
    });
  });

  describe("updateGameState generic function", () => {
    it("should update playing state preserving type", () => {
      const initialState = buildPlayingState(baseShared, {
        active: mockActivePiece,
      });
      const updatedState = updateGameState(initialState, {
        tick: initialState.tick + 1,
      });

      expect(updatedState.status).toBe("playing");
      expect(updatedState.tick).toBe(initialState.tick + 1);
      expect(updatedState.active).toEqual(mockActivePiece);
      expect(updatedState).toBe(updatedState);
    });

    it("should update resolvingLock state preserving type", () => {
      const pendingLock: PendingLock = {
        completedLines: [],
        finalPos: mockActivePiece,
        pieceId: mockActivePiece.id,
        source: "hardDrop",
        timestampMs: createTimestamp(1000),
      };
      const initialState = buildResolvingLockState(baseShared, pendingLock);
      const updatedState = updateGameState(initialState, {
        tick: initialState.tick + 1,
      });

      expect(updatedState.status).toBe("resolvingLock");
      expect(updatedState.tick).toBe(initialState.tick + 1);
      expect(updatedState.pendingLock).toEqual(pendingLock);
    });

    it("should update lineClear state preserving type", () => {
      const initialState = buildLineClearState(baseShared);
      const updatedState = updateGameState(initialState, {
        tick: initialState.tick + 1,
      });

      expect(updatedState.status).toBe("lineClear");
      expect(updatedState.tick).toBe(initialState.tick + 1);
    });

    it("should update topOut state preserving type", () => {
      const initialState = buildTopOutState(baseShared);
      const updatedState = updateGameState(initialState, {
        tick: initialState.tick + 1,
      });

      expect(updatedState.status).toBe("topOut");
      expect(updatedState.tick).toBe(initialState.tick + 1);
    });

    it("should handle exhaustive switch with assertNever", () => {
      // Create an invalid state that would trigger assertNever
      const invalidState = {
        ...baseShared,
        active: undefined,
        pendingLock: null,
        status: "invalid" as never,
      } as GameState;

      expect(() => updateGameState(invalidState, { tick: 1 })).toThrow(
        "Unexpected value:",
      );
    });
  });

  describe("State builders edge cases", () => {
    it("should build playing state with undefined active piece", () => {
      const state = buildPlayingState(baseShared, {});
      expect(state.status).toBe("playing");
      expect(state.active).toBeUndefined();
      expect(state.pendingLock).toBeNull();
    });

    it("should build resolving lock state with all properties", () => {
      const pendingLock: PendingLock = {
        completedLines: [],
        finalPos: {
          id: "I",
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(0),
        },
        pieceId: "I",
        source: "hardDrop",
        timestampMs: createTimestamp(2000),
      };
      const state = buildResolvingLockState(baseShared, pendingLock);
      expect(state.status).toBe("resolvingLock");
      expect(state.pendingLock).toEqual(pendingLock);
      expect(state.active).toBeUndefined();
    });

    it("should build line clear state with proper defaults", () => {
      const state = buildLineClearState(baseShared);
      expect(state.status).toBe("lineClear");
      expect(state.active).toBeUndefined();
      expect(state.pendingLock).toBeNull();
    });

    it("should build top out state with proper defaults", () => {
      const state = buildTopOutState(baseShared);
      expect(state.status).toBe("topOut");
      expect(state.active).toBeUndefined();
      expect(state.pendingLock).toBeNull();
    });
  });

  describe("Complex state transitions", () => {
    it("should preserve all shared properties during updates", () => {
      const initialStats = baseShared.stats;

      const stateWithStats = buildPlayingState(baseShared, {
        active: mockActivePiece,
      });

      const updatedState = updateGameState(stateWithStats, {
        tick: stateWithStats.tick + 10,
      });

      expect(updatedState.stats).toEqual(initialStats);
      expect(updatedState.board).toBe(baseShared.board);
      expect(updatedState.timing).toEqual(baseShared.timing);
    });
  });
});
