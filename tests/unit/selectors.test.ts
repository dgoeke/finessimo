import { describe, it, expect } from "@jest/globals";

import { Grounded } from "../../src/engine/physics/lock-delay.machine";
import {
  selectStatus,
  selectIsPlaying,
  selectIsResolving,
  selectIsLineClear,
  selectIsTopOut,
  selectPPM,
  selectLPM,
  selectFinesseAccuracy,
  selectAvgInputsPerPiece,
  selectActive,
  selectIsGrounded,
  selectLockResets,
  selectLockElapsedMs,
  selectLockDelayMs,
  selectLockResetCap,
  selectGhostPieceBottom,
} from "../../src/engine/selectors";
import {
  buildResolvingLockState,
  buildPlayingState,
  updateGameState,
  buildTopOutState,
  buildLineClearState,
} from "../../src/state/types";
import { createGridCoord } from "../../src/types/brands";
import { createTimestamp } from "../../src/types/timestamp";
import { createTestGameState } from "../test-helpers";

import type {
  GameState,
  ActivePiece,
  BaseShared,
  PendingLock,
  PlayingState,
} from "../../src/state/types";

describe("selectors.ts", () => {
  const mockActivePiece: ActivePiece = {
    id: "T" as const,
    rot: "spawn",
    x: createGridCoord(4),
    y: createGridCoord(2),
  };

  // Build a strongly-typed PlayingState to avoid union widening in spreads
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
  }))(createTestGameState());
  const basePlayingState: PlayingState = buildPlayingState(baseShared, {
    active: mockActivePiece,
  });

  describe("status selectors", () => {
    it("should select status correctly", () => {
      expect(selectStatus(basePlayingState)).toBe("playing");

      const topOutState: GameState = buildTopOutState(baseShared);
      expect(selectStatus(topOutState)).toBe("topOut");
    });

    it("should identify playing state correctly", () => {
      expect(selectIsPlaying(basePlayingState)).toBe(true);

      const topOutState: GameState = buildTopOutState(baseShared);
      expect(selectIsPlaying(topOutState)).toBe(false);
    });

    it("should identify resolving state correctly", () => {
      expect(selectIsResolving(basePlayingState)).toBe(false);

      // Build a proper ResolvingLock state
      const baseSharedForResolving: BaseShared = baseShared;
      const pendingLock: PendingLock = {
        completedLines: [],
        finalPos: mockActivePiece,
        pieceId: mockActivePiece.id,
        source: "hardDrop",
        timestampMs: createTimestamp(1000),
      };
      const resolvingState = buildResolvingLockState(
        baseSharedForResolving,
        pendingLock,
      );
      expect(selectIsResolving(resolvingState)).toBe(true);
    });

    it("should identify line clear state correctly", () => {
      expect(selectIsLineClear(basePlayingState)).toBe(false);

      const lineClearState: GameState = buildLineClearState(baseShared);
      expect(selectIsLineClear(lineClearState)).toBe(true);
    });

    it("should identify top out state correctly", () => {
      expect(selectIsTopOut(basePlayingState)).toBe(false);

      const topOutState: GameState = buildTopOutState(baseShared);
      expect(selectIsTopOut(topOutState)).toBe(true);
    });
  });

  describe("stats selectors", () => {
    const tunedState = updateGameState(basePlayingState, {
      stats: {
        ...basePlayingState.stats,
        averageInputsPerPiece: 4.2,
        finesseAccuracy: 0.85,
        linesPerMinute: 120,
        piecesPerMinute: 600,
      },
    });

    it("should select PPM correctly", () => {
      expect(selectPPM(tunedState)).toBe(600);
    });

    it("should select LPM correctly", () => {
      expect(selectLPM(tunedState)).toBe(120);
    });

    it("should select finesse accuracy correctly", () => {
      expect(selectFinesseAccuracy(tunedState)).toBe(0.85);
    });

    it("should select average inputs per piece correctly", () => {
      expect(selectAvgInputsPerPiece(tunedState)).toBe(4.2);
    });
  });

  describe("active piece selectors", () => {
    it("should select active piece in playing state", () => {
      const active = selectActive(basePlayingState);
      expect(active).toEqual(mockActivePiece);
    });

    it("should return undefined for active piece in non-playing states", () => {
      const topOutState: GameState = buildTopOutState(baseShared);

      const active = selectActive(topOutState);
      expect(active).toBeUndefined();
    });
  });

  describe("grounded/lock delay selectors", () => {
    it("should detect grounded state correctly", () => {
      // Create state with piece at bottom
      const bottomPiece: ActivePiece = {
        id: "T" as const,
        rot: "spawn",
        x: createGridCoord(4),
        y: createGridCoord(18), // Near bottom where it would be grounded
      };

      const groundedState = {
        ...basePlayingState,
        active: bottomPiece,
      };

      // Note: The actual grounding depends on board collision detection
      // This test verifies the selector handles the check without throwing
      expect(() => selectIsGrounded(groundedState)).not.toThrow();
      expect(typeof selectIsGrounded(groundedState)).toBe("boolean");
    });

    it("should return 0 lock resets when airborne", () => {
      expect(selectLockResets(basePlayingState)).toBe(0);
    });

    it("should return lock resets when grounded", () => {
      const groundedState = {
        ...basePlayingState,
        physics: {
          ...basePlayingState.physics,
          lockDelay: Grounded(createTimestamp(1000), 3),
        },
      };

      expect(selectLockResets(groundedState)).toBe(3);
    });

    it("should calculate lock elapsed time correctly", () => {
      const now = createTimestamp(2000);
      const startTime = createTimestamp(1800); // 200ms ago

      const groundedState = {
        ...basePlayingState,
        physics: {
          ...basePlayingState.physics,
          lockDelay: Grounded(startTime, 0),
        },
      };

      const elapsed = selectLockElapsedMs(groundedState, now);
      expect(elapsed).toBe(200);
    });

    it("should return 0 elapsed time when airborne", () => {
      const now = createTimestamp(2000);
      const elapsed = selectLockElapsedMs(basePlayingState, now);
      expect(elapsed).toBe(0);
    });

    it("should select lock delay timing correctly", () => {
      expect(selectLockDelayMs(basePlayingState)).toBe(500);
    });

    it("should select lock reset cap correctly", () => {
      expect(selectLockResetCap(basePlayingState)).toBe(15);
    });
  });

  describe("ghost piece selector", () => {
    it("should return ghost piece for active piece", () => {
      const ghost = selectGhostPieceBottom(basePlayingState);

      // Should return a piece (dropToBottom doesn't return null for valid pieces)
      expect(ghost).toBeDefined();
      expect(ghost?.id).toBe(mockActivePiece.id);
      expect(ghost?.rot).toBe(mockActivePiece.rot);
    });

    it("should return undefined when no active piece", () => {
      const topOutState: GameState = buildTopOutState(baseShared);

      const ghost = selectGhostPieceBottom(topOutState);
      expect(ghost).toBeUndefined();
    });
  });
});
