import { describe, it, expect } from "@jest/globals";

import {
  selectGhostOverlay,
  selectTargetOverlays,
  selectColumnHighlightOverlay,
  selectDerivedOverlays,
} from "../../../src/engine/selectors/overlays";
import { buildTopOutState } from "../../../src/state/types";
import { createGridCoord } from "../../../src/types/brands";
// no timestamp helpers needed in this test
import { createTestGameState } from "../../test-helpers";

import type { ExtendedModeData, TargetCell } from "../../../src/modes/types";
import type {
  GameState,
  ActivePiece,
  BaseShared,
} from "../../../src/state/types";

describe("overlays.ts", () => {
  const mockActivePiece: ActivePiece = {
    id: "T" as const,
    rot: "spawn",
    x: createGridCoord(4),
    y: createGridCoord(2),
  };

  const basePlayingState: GameState = createTestGameState(
    {},
    { active: mockActivePiece },
  );
  const toBaseShared = (s: GameState): BaseShared => ({
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
  });

  describe("selectGhostOverlay", () => {
    it("should return null for non-playing states", () => {
      const topOutState: GameState = buildTopOutState(
        toBaseShared(basePlayingState),
      );

      const ghost = selectGhostOverlay(topOutState);
      expect(ghost).toBeNull();
    });

    it("should return null when ghost is disabled", () => {
      const stateWithGhostDisabled: GameState = createTestGameState(
        {
          gameplay: { ...basePlayingState.gameplay, ghostPieceEnabled: false },
        },
        { active: mockActivePiece },
      );

      const ghost = selectGhostOverlay(stateWithGhostDisabled);
      expect(ghost).toBeNull();
    });

    it("should return null when no active piece", () => {
      const stateWithoutActive: GameState = createTestGameState({}, {});

      const ghost = selectGhostOverlay(stateWithoutActive);
      expect(ghost).toBeNull();
    });

    it("should return ghost overlay when conditions are met", () => {
      // Use a piece that will definitely not be at the bottom
      const highPiece: ActivePiece = {
        id: "T" as const,
        rot: "spawn",
        x: createGridCoord(4),
        y: createGridCoord(0), // Top of the board
      };

      const stateWithHighPiece: GameState = createTestGameState(
        {},
        { active: highPiece },
      );

      const ghost = selectGhostOverlay(stateWithHighPiece);
      expect(ghost).not.toBeNull();

      if (ghost) {
        expect(ghost.kind).toBe("ghost");
        expect(ghost.pieceId).toBe("T");
        expect(ghost.z).toBe(2); // Z.ghost
        expect(ghost.cells).toHaveLength(4);
        expect(typeof ghost.id).toBe("string");
        expect(ghost.id).toContain("ghost:");
      }
    });
  });

  describe("selectTargetOverlays", () => {
    it("should return empty array when no targets or decorations", () => {
      const targets = selectTargetOverlays(basePlayingState);
      expect(targets).toEqual([]);
    });

    it("should extract targets from modeData.targets", () => {
      const targetCells: Array<TargetCell> = [
        { color: "#FF0000", x: createGridCoord(3), y: createGridCoord(18) },
        { color: "#FF0000", x: createGridCoord(4), y: createGridCoord(18) },
      ];

      const modeData: ExtendedModeData = {
        targets: [targetCells],
      };

      const stateWithTargets: GameState = createTestGameState(
        { modeData },
        { active: mockActivePiece },
      );

      const targets = selectTargetOverlays(stateWithTargets);
      expect(targets).toHaveLength(1);

      const target = targets[0];
      expect(target?.kind).toBe("target");
      expect(target?.color).toBe("#FF0000");
      expect(target?.style).toBe("outline");
      expect(target?.z).toBe(3); // Z.target
      expect(target?.cells).toHaveLength(2);
    });

    it("should fall back to board decorations when no modeData targets", () => {
      const stateWithDecorations: GameState = createTestGameState(
        {
          boardDecorations: [
            {
              alpha: 0.5,
              cells: [
                { x: createGridCoord(6), y: createGridCoord(17) },
                { x: createGridCoord(7), y: createGridCoord(17) },
              ],
              color: "#FFFF00",
              type: "cellHighlight",
            },
          ],
        },
        { active: mockActivePiece },
      );

      const targets = selectTargetOverlays(stateWithDecorations);
      expect(targets).toHaveLength(1);

      const target = targets[0];
      expect(target?.kind).toBe("target");
      expect(target?.color).toBe("#FFFF00");
      expect(target?.alpha).toBe(0.5);
      expect(target?.cells).toHaveLength(2);
    });
  });

  describe("selectColumnHighlightOverlay", () => {
    it("should return null for non-guided modes", () => {
      const overlay = selectColumnHighlightOverlay(basePlayingState);
      expect(overlay).toBeNull();
    });

    it("should return column highlight for active piece in guided mode", () => {
      const guidedState: GameState = createTestGameState(
        { currentMode: "guided" },
        { active: mockActivePiece },
      );

      const overlay = selectColumnHighlightOverlay(guidedState);
      expect(overlay).not.toBeNull();

      if (overlay) {
        expect(overlay.kind).toBe("column-highlight");
        expect(overlay.color).toBe("#FFFFFF");
        expect(overlay.intensity).toBe(0.08);
        expect(overlay.z).toBe(0.5); // Z.columnHighlight
        expect(Array.isArray(overlay.columns)).toBe(true);
        expect(overlay.columns.length).toBeGreaterThan(0);
      }
    });

    it("should return null when column highlight is disabled", () => {
      const guidedStateWithDisabledHighlight: GameState = createTestGameState(
        {
          currentMode: "guided",
          gameplay: {
            ...basePlayingState.gameplay,
            guidedColumnHighlightEnabled: false,
          },
        },
        { active: mockActivePiece },
      );

      const overlay = selectColumnHighlightOverlay(
        guidedStateWithDisabledHighlight,
      );
      expect(overlay).toBeNull();
    });
  });

  describe("selectDerivedOverlays", () => {
    it("should combine all overlay types", () => {
      const stateForOverlays: GameState = createTestGameState(
        { currentMode: "guided" },
        {
          active: {
            id: "I" as const,
            rot: "spawn",
            x: createGridCoord(4),
            y: createGridCoord(0), // High piece for ghost
          },
        },
      );

      const targetCells: Array<TargetCell> = [
        { color: "#FF0000", x: createGridCoord(0), y: createGridCoord(19) },
      ];

      const stateWithAll: GameState = {
        ...stateForOverlays,
        modeData: { targets: [targetCells] },
      };

      const overlays = selectDerivedOverlays(stateWithAll);

      expect(overlays.length).toBeGreaterThan(0);

      const kinds = overlays.map((o) => o.kind);
      expect(kinds).toContain("column-highlight");
      expect(kinds).toContain("target");
    });

    it("should return empty array when no overlays are applicable", () => {
      const minimalState: GameState = createTestGameState(
        {
          gameplay: { ...basePlayingState.gameplay, ghostPieceEnabled: false },
        },
        {},
      );

      const overlays = selectDerivedOverlays(minimalState);
      expect(overlays).toEqual([]);
    });
  });
});
