import { type GameState } from "../../src/state/types";
import { reducerWithPipeline as reducer } from "../helpers/reducer-with-pipeline";
import { assertActivePiece } from "../test-helpers";

describe("Reducer success paths: Rotate and Hold", () => {
  let base: GameState;

  beforeEach(() => {
    base = reducer(undefined, { seed: "test", type: "Init" });
  });

  it("applies a successful Rotate and updates active piece", () => {
    const withPiece: GameState = {
      ...base,
      active: { id: "T", rot: "spawn", x: 4, y: 2 },
    };

    const rotated = reducer(withPiece, { dir: "CW", type: "Rotate" });
    expect(rotated).not.toBe(withPiece);
    expect(rotated.active).toBeDefined();
    assertActivePiece(rotated);
    expect(rotated.active.rot).toBe("right");
  });

  it("Hold stores current piece id and spawns next piece when allowed", () => {
    const withPiece: GameState = {
      ...base,
      active: { id: "S", rot: "spawn", x: 4, y: 2 },
      canHold: true,
    };

    const held = reducer(withPiece, { type: "Hold" });
    expect(held).not.toBe(withPiece);
    expect(held.active).toBeDefined(); // New system spawns next piece
    assertActivePiece(held);
    expect(held.active.id).toBe(withPiece.nextQueue[0]); // Should be first piece from queue
    expect(held.hold).toBe("S");
    expect(held.canHold).toBe(false);
  });
});
