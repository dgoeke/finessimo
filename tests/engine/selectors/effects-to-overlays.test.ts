import { describe, it, expect } from "@jest/globals";

import { selectEffectOverlays } from "../../../src/engine/selectors/effects-to-overlays";
import {
  createGridCoord,
  createDurationMs,
  createUiEffectId,
} from "../../../src/types/brands";
import { createTimestamp } from "../../../src/types/timestamp";
import { createTestGameState } from "../../test-helpers";

import type { GameState, UiEffect } from "../../../src/state/types";

describe("effects-to-overlays.ts", () => {
  const baseGameState: GameState = createTestGameState(
    {},
    {
      active: {
        id: "T" as const,
        rot: "spawn",
        x: createGridCoord(4),
        y: createGridCoord(2),
      },
    },
  );

  describe("selectEffectOverlays", () => {
    it("should return empty array when no UI effects", () => {
      const overlays = selectEffectOverlays(baseGameState);
      expect(overlays).toEqual([]);
    });

    it("should convert floatingText effect to null (handled separately)", () => {
      const floatingTextEffect: UiEffect = {
        anchor: "topLeft",
        color: "#00FF00",
        createdAt: createTimestamp(1000),
        driftYPx: -30,
        fontPx: 16,
        id: createUiEffectId(1),
        kind: "floatingText",
        offsetX: 50,
        offsetY: 10,
        text: "+100",
        ttlMs: createDurationMs(1000),
      };

      const stateWithEffect: GameState = {
        ...baseGameState,
        uiEffects: [floatingTextEffect],
      };

      const overlays = selectEffectOverlays(stateWithEffect);
      expect(overlays).toEqual([]);
    });

    it("should convert lineFlash effect to LineFlashOverlay", () => {
      const lineFlashEffect: UiEffect = {
        createdAt: createTimestamp(1000),
        id: createUiEffectId(1),
        kind: "lineFlash",
        rows: [18, 19],
        ttlMs: createDurationMs(500),
      };

      const stateWithEffect: GameState = {
        ...baseGameState,
        uiEffects: [lineFlashEffect],
      };

      const overlays = selectEffectOverlays(stateWithEffect);
      expect(overlays).toHaveLength(1);

      const overlay = overlays[0];
      expect(overlay).toBeDefined();
      expect(overlay?.kind).toBe("line-flash");

      if (overlay?.kind === "line-flash") {
        expect(overlay.id).toBe("line-flash:1");
        expect(overlay.rows).toEqual([18, 19]);
        expect(overlay.z).toBe(4); // Z.effect
      }
    });

    it("should convert lineFlash effect with optional properties", () => {
      const lineFlashEffect: UiEffect = {
        color: "#FF0000",
        createdAt: createTimestamp(1000),
        id: createUiEffectId(2),
        intensity: 0.8,
        kind: "lineFlash",
        rows: [17],
        ttlMs: createDurationMs(300),
      };

      const stateWithEffect: GameState = {
        ...baseGameState,
        uiEffects: [lineFlashEffect],
      };

      const overlays = selectEffectOverlays(stateWithEffect);
      expect(overlays).toHaveLength(1);

      const overlay = overlays[0];
      if (overlay?.kind === "line-flash") {
        expect(overlay.id).toBe("line-flash:2");
        expect(overlay.rows).toEqual([17]);
        expect(overlay.color).toBe("#FF0000");
        expect(overlay.intensity).toBe(0.8);
      }
    });

    it("should convert finesseBoop effect to EffectDotOverlay", () => {
      const finesseBoopEffect: UiEffect = {
        createdAt: createTimestamp(1000),
        gridX: createGridCoord(7),
        gridY: createGridCoord(15),
        id: createUiEffectId(3),
        kind: "finesseBoop",
        style: "pulse",
        ttlMs: createDurationMs(800),
      };

      const stateWithEffect: GameState = {
        ...baseGameState,
        uiEffects: [finesseBoopEffect],
      };

      const overlays = selectEffectOverlays(stateWithEffect);
      expect(overlays).toHaveLength(1);

      const overlay = overlays[0];
      expect(overlay?.kind).toBe("effect-dot");

      if (overlay?.kind === "effect-dot") {
        expect(overlay.id).toBe("finesse-boop:3");
        expect(overlay.at).toEqual([createGridCoord(7), createGridCoord(15)]);
        expect(overlay.style).toBe("pulse");
        expect(overlay.z).toBe(4); // Z.effect
      }
    });

    it("should convert finesseBoop effect with optional properties", () => {
      const finesseBoopEffect: UiEffect = {
        color: "#FFFF00",
        createdAt: createTimestamp(1000),
        gridX: createGridCoord(3),
        gridY: createGridCoord(8),
        id: createUiEffectId(4),
        kind: "finesseBoop",
        size: 1.5,
        style: "sparkle",
        ttlMs: createDurationMs(600),
      };

      const stateWithEffect: GameState = {
        ...baseGameState,
        uiEffects: [finesseBoopEffect],
      };

      const overlays = selectEffectOverlays(stateWithEffect);
      expect(overlays).toHaveLength(1);

      const overlay = overlays[0];
      if (overlay?.kind === "effect-dot") {
        expect(overlay.id).toBe("finesse-boop:4");
        expect(overlay.at).toEqual([createGridCoord(3), createGridCoord(8)]);
        expect(overlay.style).toBe("sparkle");
        expect(overlay.color).toBe("#FFFF00");
        expect(overlay.size).toBe(1.5);
      }
    });

    it("should handle multiple effects of different types", () => {
      const effects: Array<UiEffect> = [
        {
          anchor: "topRight",
          color: "#00FF00",
          createdAt: createTimestamp(1000),
          driftYPx: -40,
          fontPx: 20,
          id: createUiEffectId(1),
          kind: "floatingText",
          offsetX: -10,
          offsetY: 50,
          text: "Perfect!",
          ttlMs: createDurationMs(1000),
        },
        {
          createdAt: createTimestamp(1000),
          id: createUiEffectId(2),
          kind: "lineFlash",
          rows: [19],
          ttlMs: createDurationMs(500),
        },
        {
          createdAt: createTimestamp(1000),
          gridX: createGridCoord(4),
          gridY: createGridCoord(12),
          id: createUiEffectId(3),
          kind: "finesseBoop",
          style: "fade",
          ttlMs: createDurationMs(400),
        },
      ];

      const stateWithEffects: GameState = {
        ...baseGameState,
        uiEffects: effects,
      };

      const overlays = selectEffectOverlays(stateWithEffects);

      // floatingText should be filtered out (returns null)
      // lineFlash and finesseBoop should be converted
      expect(overlays).toHaveLength(2);

      const overlayKinds = overlays.map((o) => o.kind);
      expect(overlayKinds).toContain("line-flash");
      expect(overlayKinds).toContain("effect-dot");
    });

    it("should generate unique IDs for effects", () => {
      const effects: Array<UiEffect> = [
        {
          createdAt: createTimestamp(1000),
          id: createUiEffectId(100),
          kind: "lineFlash",
          rows: [18],
          ttlMs: createDurationMs(500),
        },
        {
          createdAt: createTimestamp(1000),
          gridX: createGridCoord(5),
          gridY: createGridCoord(5),
          id: createUiEffectId(200),
          kind: "finesseBoop",
          style: "pulse",
          ttlMs: createDurationMs(400),
        },
      ];

      const stateWithEffects: GameState = {
        ...baseGameState,
        uiEffects: effects,
      };

      const overlays = selectEffectOverlays(stateWithEffects);
      expect(overlays).toHaveLength(2);

      const ids = overlays.map((o) => o.id);
      expect(ids).toContain("line-flash:100");
      expect(ids).toContain("finesse-boop:200");

      // IDs should be unique
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
