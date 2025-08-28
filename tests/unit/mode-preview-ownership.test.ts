import { describe, it, expect, beforeAll } from "@jest/globals";

import { gameModeRegistry, type GameMode } from "../../src/modes";
import { getActiveRng } from "../../src/modes/spawn-service";
import { fromNow } from "../../src/types/timestamp";
import { reducerWithPipeline as reducer } from "../helpers/reducer-with-pipeline";

import type { PieceRandomGenerator } from "../../src/core/rng-interface";
import type { Action, GameState, PieceId } from "../../src/state/types";

class MockRng implements PieceRandomGenerator {
  private readonly piece: PieceId;
  constructor(piece: PieceId = "T") {
    this.piece = piece;
  }
  getNextPiece(): { piece: PieceId; newRng: PieceRandomGenerator } {
    return { newRng: this, piece: this.piece };
  }
  getNextPieces(count: number): {
    pieces: Array<PieceId>;
    newRng: PieceRandomGenerator;
  } {
    const pieces: Array<PieceId> = Array.from(
      { length: count },
      () => this.piece,
    );
    return { newRng: this, pieces };
  }
}

class MockPreviewMode implements GameMode {
  readonly name = "mockPreview";

  createRng(seed: string, _prev?: PieceRandomGenerator): PieceRandomGenerator {
    void seed;
    void _prev;
    return new MockRng("T");
  }

  getPreview(
    _state: GameState,
    rng: PieceRandomGenerator,
    count: number,
  ): { pieces: Array<PieceId>; newRng: PieceRandomGenerator } {
    void _state;
    return rng.getNextPieces(count);
  }

  onPieceLocked(): { modeData?: unknown } {
    return {};
  }
  shouldPromptNext(): boolean {
    return false;
  }
  getNextPrompt(): string | null {
    return null;
  }
  reset(): void {
    void 0;
  }
}

describe("Mode-owned RNG & preview (ReplacePreview)", () => {
  beforeAll(() => {
    // Register mock mode once for this test file
    gameModeRegistry.register(new MockPreviewMode());
  });

  it("sets RNG and preview via ReplacePreview on SetMode", () => {
    // Init baseline state
    const s0 = reducer(undefined, {
      seed: "seed",
      timestampMs: fromNow(),
      type: "Init",
    } as Action);

    // Switch mode (reducer just updates currentMode)
    const s1 = reducer(s0, { mode: "mockPreview", type: "SetMode" });

    const mode = gameModeRegistry.get("mockPreview");
    expect(mode).toBeTruthy();
    if (!mode) throw new Error("mockPreview mode not registered");

    // Simulate app.ts SetMode ownership: create RNG and replace preview
    const desired = Math.max(5, s1.gameplay.nextPieceCount ?? 5);
    const seededRng = getActiveRng(mode, "any-seed", s1.rng);
    const { newRng, pieces } =
      typeof mode.getPreview === "function"
        ? mode.getPreview(s1, seededRng, desired)
        : seededRng.getNextPieces(desired);

    const s2 = reducer(s1, {
      pieces,
      rng: newRng,
      type: "ReplacePreview",
    } as Action);

    expect(s2.nextQueue).toEqual(["T", "T", "T", "T", "T"]);
    // RNG is replaced as provided by mode
    expect(s2.rng).toBe(newRng);

    // Spawn should consume from queue and helper refills back to desired size
    const s3 = reducer(s2, { type: "Spawn" });
    expect(s3.active?.id).toBe("T");
    expect(s3.nextQueue.length).toBe(desired);
    expect(s3.nextQueue.every((p) => p === "T")).toBe(true);
  });
});
