import { describe, it, expect } from "@jest/globals";

import { selectGhostOverlay } from "../../src/engine/selectors/overlays";
import { createGridCoord, createDurationMs } from "../../src/types/brands";
import { createTestGameState } from "../test-helpers";

import type { ActivePiece } from "../../src/state/types";

function makeActivePiece(): ActivePiece {
  return {
    id: "T",
    rot: "spawn",
    x: createGridCoord(4),
    y: createGridCoord(-2),
  };
}

describe("selectGhostOverlay precedence", () => {
  it("defaults to enabled when neither modeData nor settings specify", () => {
    const state = createTestGameState(
      // No gameplay override; no modeData override
      {},
      { active: makeActivePiece() },
    );

    const overlay = selectGhostOverlay(state);
    expect(overlay).not.toBeNull();
    expect(overlay?.kind).toBe("ghost");
  });

  it("respects user setting when modeData is undefined (disabled)", () => {
    const state = createTestGameState(
      {
        gameplay: {
          finesseCancelMs: createDurationMs(50),
          ghostPieceEnabled: false,
          holdEnabled: true,
        },
      },
      { active: makeActivePiece() },
    );

    const overlay = selectGhostOverlay(state);
    expect(overlay).toBeNull();
  });

  it("modeData.ghostEnabled=true overrides disabled user setting", () => {
    const state = createTestGameState(
      {
        gameplay: {
          finesseCancelMs: createDurationMs(50),
          ghostPieceEnabled: false,
          holdEnabled: true,
        },
        modeData: { ghostEnabled: true },
      },
      { active: makeActivePiece() },
    );

    const overlay = selectGhostOverlay(state);
    expect(overlay).not.toBeNull();
    expect(overlay?.kind).toBe("ghost");
  });

  it("modeData.ghostEnabled=false suppresses ghost even if user setting enabled", () => {
    const state = createTestGameState(
      {
        gameplay: {
          finesseCancelMs: createDurationMs(50),
          ghostPieceEnabled: true,
          holdEnabled: true,
        },
        modeData: { ghostEnabled: false },
      },
      { active: makeActivePiece() },
    );

    const overlay = selectGhostOverlay(state);
    expect(overlay).toBeNull();
  });
});
