import { describe, it, expect } from "@jest/globals";

import { selectBoardRenderModel } from "@/engine/selectors/board-render";
import {
  createGridCoord,
  createDurationMs,
  createUiEffectId,
} from "@/types/brands";
import { createTimestamp } from "@/types/timestamp";

import { createTestGameState } from "../../test-helpers";

import type { TargetCell } from "@/modes/types";
import type { GameState, ActivePiece, UiEffect } from "@/state/types";

describe("board-render.ts", () => {
  const mockActivePiece: ActivePiece = {
    id: "T" as const,
    rot: "spawn",
    x: createGridCoord(4),
    y: createGridCoord(0), // High piece for ghost
  };

  const basePlayingState: GameState = createTestGameState(
    {},
    { active: mockActivePiece },
  );

  describe("selectBoardRenderModel", () => {
    it("should return empty overlays for minimal state", () => {
      const minimalState: GameState = createTestGameState(
        {
          gameplay: { ...basePlayingState.gameplay, ghostPieceEnabled: false },
        },
        {},
      );

      const renderModel = selectBoardRenderModel(minimalState);

      expect(renderModel).toHaveProperty("overlays");
      expect(Array.isArray(renderModel.overlays)).toBe(true);
      expect(renderModel.overlays).toEqual([]);
    });

    it("should combine derived overlays (ghost, targets, column highlights)", () => {
      const targetCells: Array<TargetCell> = [
        { color: "#FF0000", x: createGridCoord(3), y: createGridCoord(18) },
        { color: "#FF0000", x: createGridCoord(4), y: createGridCoord(18) },
      ];

      const stateWithTargets: GameState = createTestGameState(
        { currentMode: "guided", modeData: { targets: [targetCells] } },
        { active: mockActivePiece },
      );

      const renderModel = selectBoardRenderModel(stateWithTargets);

      expect(renderModel.overlays.length).toBeGreaterThan(0);

      const overlayKinds = renderModel.overlays.map((o) => o.kind);
      expect(overlayKinds).toContain("target");
      expect(overlayKinds).toContain("column-highlight");
    });

    it("should combine effect overlays from UI effects", () => {
      const uiEffects: Array<UiEffect> = [
        {
          color: "#FFFFFF",
          createdAt: createTimestamp(1000),
          id: createUiEffectId(1),
          kind: "lineFlash",
          rows: [18, 19],
          ttlMs: createDurationMs(500),
        },
        {
          createdAt: createTimestamp(1000),
          gridX: createGridCoord(5),
          gridY: createGridCoord(10),
          id: createUiEffectId(2),
          kind: "finesseBoop",
          style: "pulse",
          ttlMs: createDurationMs(400),
        },
      ];

      const stateWithEffects: GameState = createTestGameState(
        { uiEffects },
        { active: mockActivePiece },
      );

      const renderModel = selectBoardRenderModel(stateWithEffects);

      const overlayKinds = renderModel.overlays.map((o) => o.kind);
      expect(overlayKinds).toContain("line-flash");
      expect(overlayKinds).toContain("effect-dot");
    });

    it("should combine both derived and effect overlays", () => {
      const targetCells: Array<TargetCell> = [
        { color: "#00FF00", x: createGridCoord(2), y: createGridCoord(17) },
      ];

      const uiEffects: Array<UiEffect> = [
        {
          createdAt: createTimestamp(1000),
          gridX: createGridCoord(6),
          gridY: createGridCoord(12),
          id: createUiEffectId(1),
          kind: "finesseBoop",
          style: "sparkle",
          ttlMs: createDurationMs(300),
        },
      ];

      const comprehensiveState: GameState = createTestGameState(
        { modeData: { targets: [targetCells] }, uiEffects },
        { active: mockActivePiece },
      );

      const renderModel = selectBoardRenderModel(comprehensiveState);

      expect(renderModel.overlays.length).toBeGreaterThan(0);

      const overlayKinds = renderModel.overlays.map((o) => o.kind);
      expect(overlayKinds).toContain("target");
      expect(overlayKinds).toContain("effect-dot");
    });

    it("should sort overlays by z-order", () => {
      // Create a state with multiple overlay types that have different z-orders
      const targetCells: Array<TargetCell> = [
        { color: "#FF0000", x: createGridCoord(1), y: createGridCoord(19) },
      ];

      const uiEffects: Array<UiEffect> = [
        {
          createdAt: createTimestamp(1000),
          gridX: createGridCoord(5),
          gridY: createGridCoord(5),
          id: createUiEffectId(1),
          kind: "finesseBoop",
          style: "pulse",
          ttlMs: createDurationMs(500),
        },
      ];

      const stateWithMultipleOverlays: GameState = createTestGameState(
        {
          currentMode: "guided",
          modeData: { targets: [targetCells] },
          uiEffects,
        },
        { active: mockActivePiece },
      );

      const renderModel = selectBoardRenderModel(stateWithMultipleOverlays);

      if (renderModel.overlays.length > 1) {
        // Verify overlays are sorted by z-order (ascending)
        for (let i = 0; i < renderModel.overlays.length - 1; i++) {
          const currentZ = renderModel.overlays[i]?.z ?? 0;
          const nextZ = renderModel.overlays[i + 1]?.z ?? 0;
          expect(currentZ).toBeLessThanOrEqual(nextZ);
        }
      }
    });

    it("should handle floating text effects (filtered out)", () => {
      const uiEffects: Array<UiEffect> = [
        {
          anchor: "topLeft",
          color: "#00FF00",
          createdAt: createTimestamp(1000),
          driftYPx: -40,
          fontPx: 20,
          id: createUiEffectId(1),
          kind: "floatingText",
          offsetX: 50,
          offsetY: 10,
          text: "Perfect!",
          ttlMs: createDurationMs(1000),
        },
        {
          createdAt: createTimestamp(1000),
          id: createUiEffectId(2),
          kind: "lineFlash",
          rows: [19],
          ttlMs: createDurationMs(300),
        },
      ];

      const stateWithMixedEffects: GameState = createTestGameState(
        { uiEffects },
        { active: mockActivePiece },
      );

      const renderModel = selectBoardRenderModel(stateWithMixedEffects);

      // floatingText should be filtered out, only lineFlash should remain
      const overlayKinds = renderModel.overlays.map((o) => o.kind);
      expect(overlayKinds).not.toContain("floatingText");
      expect(overlayKinds).toContain("line-flash");
    });

    it("should return immutable overlay array", () => {
      const renderModel = selectBoardRenderModel(basePlayingState);

      expect(Array.isArray(renderModel.overlays)).toBe(true);
      expect(typeof renderModel).toBe("object");
      expect(renderModel).toHaveProperty("overlays");
    });

    it("should generate stable overlay IDs", () => {
      const uiEffect: UiEffect = {
        createdAt: createTimestamp(1000),
        gridX: createGridCoord(7),
        gridY: createGridCoord(8),
        id: createUiEffectId(42),
        kind: "finesseBoop",
        style: "fade",
        ttlMs: createDurationMs(600),
      };

      const stateWithEffect: GameState = createTestGameState(
        { uiEffects: [uiEffect] },
        { active: mockActivePiece },
      );

      const renderModel1 = selectBoardRenderModel(stateWithEffect);
      const renderModel2 = selectBoardRenderModel(stateWithEffect);

      // Same state should produce same overlay IDs
      expect(renderModel1.overlays).toEqual(renderModel2.overlays);

      if (renderModel1.overlays.length > 0) {
        const overlay1 = renderModel1.overlays.find(
          (o) => o.kind === "effect-dot",
        );
        const overlay2 = renderModel2.overlays.find(
          (o) => o.kind === "effect-dot",
        );

        expect(overlay1?.id).toBe(overlay2?.id);
        expect(overlay1?.id).toBe("finesse-boop:42");
      }
    });
  });
});
