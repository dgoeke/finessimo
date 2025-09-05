import { type GameState } from "../../src/state/types";
import { createSeed, createGridCoord } from "../../src/types/brands";
import { fromNow } from "../../src/types/timestamp";
import { reducerWithPipeline as reducer } from "../helpers/reducer-with-pipeline";
import {
  assertActivePiece,
  createTestGameState,
  createTestRotateAction,
} from "../test-helpers";

describe("Reducer success paths: Rotate and Hold", () => {
  let base: GameState;

  beforeEach(() => {
    base = reducer(undefined, {
      seed: createSeed("test"),
      timestampMs: fromNow(),
      type: "Init",
    });
  });

  it("applies a successful Rotate and updates active piece", () => {
    const withPiece: GameState = createTestGameState(base, {
      active: {
        id: "T",
        rot: "spawn",
        x: createGridCoord(4),
        y: createGridCoord(2),
      },
    });

    const rotated = reducer(withPiece, createTestRotateAction("CW"));
    expect(rotated).not.toBe(withPiece);
    expect(rotated.active).toBeDefined();
    assertActivePiece(rotated);
    expect(rotated.active.rot).toBe("right");
  });

  it("Hold stores current piece id and spawns next piece when allowed", () => {
    const withPiece: GameState = createTestGameState(
      {
        ...base,
        canHold: true,
      },
      {
        active: {
          id: "S",
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(2),
        },
      },
    );

    const held = reducer(withPiece, { type: "Hold" });
    expect(held).not.toBe(withPiece);
    expect(held.active).toBeDefined(); // New system spawns next piece
    assertActivePiece(held);
    expect(held.active.id).toBe(withPiece.nextQueue[0]); // Should be first piece from queue
    expect(held.hold).toBe("S");
    expect(held.canHold).toBe(false);
  });
});
