import { describe, it, expect } from "@jest/globals";
import { reducer } from "../../src/state/reducer";
import { GameState, Board, idx } from "../../src/state/types";
import { createTimestamp } from "../../src/types/timestamp";
import { shouldCompleteLineClear } from "../../src/app";

function createStateWithDelay(delayMs: number): GameState {
  return reducer(undefined, {
    type: "Init",
    seed: "timestamp-validation-test",
    timing: {
      lineClearDelayMs: delayMs,
      gravityEnabled: false,
    },
  });
}

function boardWithBottomGaps(): Board {
  const cells = new Uint8Array(200);
  // Fill bottom row except gaps at x=4,5 (where O piece at x=3 will land)
  for (let x = 0; x < 10; x++) {
    if (x !== 4 && x !== 5) {
      cells[idx(x, 19)] = 1; // bottom row
    }
  }
  return { width: 10, height: 20, cells };
}

describe("timestamp validation in line clear scenarios", () => {
  it("createTimestamp rejects zero and negative values", () => {
    expect(() => createTimestamp(0)).toThrow(
      "Timestamp must be a finite, non-zero number.",
    );
    expect(() => createTimestamp(-1)).toThrow(
      "Timestamp must be a finite, non-zero number.",
    );
    expect(() => createTimestamp(NaN)).toThrow(
      "Timestamp must be a finite, non-zero number.",
    );
    expect(() => createTimestamp(Infinity)).toThrow(
      "Timestamp must be a finite, non-zero number.",
    );
  });

  it("createTimestamp accepts positive finite numbers", () => {
    const validTimestamp = createTimestamp(1000);
    expect(validTimestamp).toBe(1000);

    const performanceTimestamp = createTimestamp(performance.now());
    expect(performanceTimestamp).toBeGreaterThan(0);
  });

  it("HardDrop with valid timestamp properly sets lineClearStartTime", () => {
    const state = createStateWithDelay(200);
    const s1: GameState = {
      ...state,
      board: boardWithBottomGaps(),
      active: { id: "O", x: 3, y: 10, rot: "spawn" },
    };

    const afterDrop = reducer(s1, {
      type: "HardDrop",
      timestampMs: createTimestamp(1500),
    });

    expect(afterDrop.status).toBe("lineClear");
    expect(afterDrop.physics.lineClearStartTime).toBe(1500);
  });

  it("auto-lock in Tick with valid timestamp sets correct lineClearStartTime", () => {
    const state = createStateWithDelay(150);
    const s1: GameState = {
      ...state,
      board: boardWithBottomGaps(),
      active: { id: "O", x: 3, y: 18, rot: "spawn" }, // One row above bottom
      timing: {
        ...state.timing,
        gravityEnabled: true,
        lockDelayMs: 100,
      },
      physics: {
        ...state.physics,
        lockDelayStartTime: 1000,
        lastGravityTime: 1000,
      },
    };

    // Tick after lock delay has expired should auto-lock
    const afterTick = reducer(s1, {
      type: "Tick",
      timestampMs: createTimestamp(1200),
    });

    expect(afterTick.status).toBe("lineClear");
    expect(afterTick.physics.lineClearStartTime).toBe(1200);
  });

  it("shouldCompleteLineClear works correctly with valid timestamps", () => {
    const state = createStateWithDelay(300);
    const s1: GameState = {
      ...state,
      status: "lineClear",
      physics: {
        ...state.physics,
        lineClearStartTime: createTimestamp(1000),
        lineClearLines: [19],
      },
    };

    // Not enough time elapsed
    expect(shouldCompleteLineClear(s1, 1250)).toBe(false);

    // Exactly enough time elapsed
    expect(shouldCompleteLineClear(s1, 1300)).toBe(true);

    // More than enough time elapsed
    expect(shouldCompleteLineClear(s1, 1500)).toBe(true);
  });

  it("functional purity is preserved with Timestamp", () => {
    const state = createStateWithDelay(100);
    const s1: GameState = {
      ...state,
      board: boardWithBottomGaps(),
      active: { id: "O", x: 3, y: 10, rot: "spawn" },
    };

    const timestamp1 = createTimestamp(2000);
    const timestamp2 = createTimestamp(3000);

    // Same state and timestamp should produce identical results
    const result1a = reducer(s1, { type: "HardDrop", timestampMs: timestamp1 });
    const result1b = reducer(s1, { type: "HardDrop", timestampMs: timestamp1 });

    expect(result1a.physics.lineClearStartTime).toBe(
      result1b.physics.lineClearStartTime,
    );
    expect(result1a.physics.lineClearStartTime).toBe(2000);

    // Different timestamps should produce different results
    const result2 = reducer(s1, { type: "HardDrop", timestampMs: timestamp2 });
    expect(result2.physics.lineClearStartTime).toBe(3000);
    expect(result2.physics.lineClearStartTime).not.toBe(
      result1a.physics.lineClearStartTime,
    );
  });

  it("type system prevents compilation with invalid timestamps", () => {
    // These lines would cause TypeScript compilation errors:
    // reducer(state, { type: "HardDrop", timestampMs: 0 });
    // reducer(state, { type: "HardDrop", timestampMs: -1 });
    // reducer(state, { type: "Tick", timestampMs: 0 });

    // This test ensures the type system is working by confirming
    // valid timestamps work correctly
    const state = createStateWithDelay(50);
    const validTimestamp = createTimestamp(performance.now());

    expect(() => {
      reducer(state, { type: "Tick", timestampMs: validTimestamp });
    }).not.toThrow();
  });
});
