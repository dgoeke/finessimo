// High-level integration spanning control → engine step pipeline

import { step } from "@/engine";
import { createEmptyBoard } from "@/engine/core/board";
import { type GameState, type PieceId, type TickDelta } from "@/engine/types";
import { toQ } from "@/engine/utils/fixedpoint";

import {
  createAlmostFullBoard,
  createCommandSequence,
  createEngineScenario,
  createTestConfig,
  createTestGameState,
  createTestRng,
  createTestPiece,
  createTickSequence,
  fillBoardRow,
  findEvent,
  findEvents,
  getLastTickEvents,
  stepUntil,
  createTopOutBoard,
} from "../../test-helpers";

describe("Engine integration — common scenarios", () => {
  test("Spawn → move → rotate → soft drop → lock by timeout → clear lines → spawn next — events occur in canonical order on specific ticks", () => {
    // Configure fast gravity and short lock delay for a concise scenario
    const cfg = createTestConfig({
      gravity32: toQ(2.0),
      lockDelayTicks: 2 as TickDelta,
      softDrop32: toQ(4.0),
    });

    // Prepare board to clear the bottom row when an I-piece locks vertically at x=4
    const board = createAlmostFullBoard([19], 4);

    // Force the first spawn to be I, then arbitrary sequence
    const rng = createTestRng([
      "I",
      "T",
      "O",
      "S",
      "Z",
      "L",
      "J",
    ] as Array<PieceId>);
    const queueInit = rng.getNextPieces(cfg.previewCount);

    const initial = createTestGameState({
      board,
      cfg,
      piece: null, // force spawn path
      queue: queueInit.pieces,
      rng: queueInit.newRng,
    });

    // Declarative tick script for commands
    const script = createTickSequence(
      [], // 0: spawn
      ["MoveLeft"], // 1
      ["RotateCW"], // 2
      ["SoftDropOn"], // 3
    );

    // Simple provider indexing the script (defaults to no-op)
    const commands = (_: GameState, i: number) => script[i] ?? [];

    // Stop on the tick that performs lock+spawn
    const result = stepUntil(
      initial,
      commands,
      (events) =>
        findEvent(events, "Locked") !== undefined &&
        findEvent(events, "PieceSpawned") !== undefined,
      60,
    );

    const allEvents = result.events;

    // Initial spawn should be I on tick 0
    const spawns = findEvents(allEvents, "PieceSpawned");
    expect(spawns.length).toBeGreaterThanOrEqual(2); // initial + next spawn
    expect(spawns[0]?.pieceId).toBe("I");
    expect(spawns[0]?.tick).toBe(0);

    // Verify lock and clear occurred and final tick ordering is canonical
    const lastTickEvents = getLastTickEvents(allEvents);
    const locked = findEvent(lastTickEvents, "Locked");
    expect(locked?.source).toBe("ground");
    const cleared = findEvent(lastTickEvents, "LinesCleared");
    expect(cleared?.rows).toContain(19);

    // Event order Locked → LinesCleared → PieceSpawned on the last tick
    const kinds = lastTickEvents.map((e) => e.kind);
    const li = kinds.indexOf("Locked");
    const ci = kinds.indexOf("LinesCleared");
    const si = kinds.indexOf("PieceSpawned");
    expect(li).toBeGreaterThanOrEqual(0);
    expect(ci).toBeGreaterThan(li);
    expect(si).toBeGreaterThan(ci);
  });

  test("Hard drop T-spin single: rotation classification should be 'floor' once kickOffset is available; emits Locked{hardDrop} and LinesCleared[<row>]", () => {
    // Bottom row already full ensures a single line clear on lock
    const cfg = createTestConfig({
      gravity32: toQ(1.0),
      lockDelayTicks: 10 as TickDelta,
      softDrop32: toQ(4.0),
    });
    // Create a solid floor row at y=12 (forces upward kick on rotation nearby), and fill bottom row
    const floorBoard = fillBoardRow(createEmptyBoard(), 12, 1);
    const bottomFull = fillBoardRow(floorBoard, 19, 1);

    // Start with a controlled T-piece just above obstacles to ensure a floor kick on rotation
    let s = createTestGameState({
      board: bottomFull,
      cfg,
      piece: createTestPiece("T", 4, 11, "spawn"),
    });

    // Rotate CW: should require floor kick in this constrained scenario
    const rotTick = step(s, createCommandSequence("RotateCW"));
    s = rotTick.state;
    const rotated = findEvent(rotTick.events, "Rotated");
    expect(rotated).toBeDefined();
    expect(rotated?.kick).toBe("floor");

    // Hard drop to lock and clear bottom row
    const dropTick = step(s, createCommandSequence("HardDrop"));
    const locked = findEvent(dropTick.events, "Locked");
    expect(locked).toBeDefined();
    expect(locked?.source).toBe("hardDrop");
    const cleared = findEvent(dropTick.events, "LinesCleared");
    expect(cleared).toBeDefined();
    expect(cleared?.rows).toContain(19);
    // Verify intra-tick order for drop: Locked before LinesCleared before PieceSpawned
    {
      const kinds = dropTick.events.map((e) => e.kind);
      const li = kinds.indexOf("Locked");
      const ci = kinds.indexOf("LinesCleared");
      const si = kinds.indexOf("PieceSpawned");
      expect(li).toBeGreaterThanOrEqual(0);
      if (ci !== -1) expect(ci).toBeGreaterThan(li);
      if (si !== -1 && ci !== -1) expect(si).toBeGreaterThan(ci);
    }
  });

  test("Hold on first active piece: only allowed once per piece; subsequent Hold is ignored until next spawn", () => {
    // Predictable piece sequence
    const start = createEngineScenario(["T", "I", "O"]);
    let s = start;

    // Tick 0: spawn T
    let r = step(s, []);
    s = r.state;
    expect(findEvent(r.events, "PieceSpawned")?.pieceId).toBe("T");

    // Tick 1: Hold twice in the same tick — only first should emit
    r = step(s, createCommandSequence("Hold", "Hold"));
    s = r.state;
    const heldEventsTick1 = findEvents(r.events, "Held");
    expect(heldEventsTick1).toHaveLength(1);
    expect(heldEventsTick1[0]?.swapped).toBe(false); // empty hold → no swap

    // Same tick should also spawn next piece from queue
    const spawnAfterHold = findEvent(r.events, "PieceSpawned");
    expect(spawnAfterHold).toBeDefined();
    expect(spawnAfterHold?.pieceId).toBe("I");

    // Tick 2: Now hold again — this time it should swap with previously held T
    r = step(s, createCommandSequence("Hold"));
    const heldTick2 = findEvent(r.events, "Held");
    expect(heldTick2).toBeDefined();
    expect(heldTick2?.swapped).toBe(true);

    // And spawn the held T immediately
    const spawnHeld = findEvent(r.events, "PieceSpawned");
    expect(spawnHeld).toBeDefined();
    expect(spawnHeld?.pieceId).toBe("T");
  });

  test("Top-out path: fill the spawn area, step once, expect TopOut event and no active piece", () => {
    // Create board that blocks spawn in vanish+visible rows
    const board = createTopOutBoard(true);
    const cfg = createTestConfig({ rngSeed: 999 });

    // Set up state to force spawn path on next step
    const rng = createTestRng(["T", "I", "O"]);
    const q = rng.getNextPieces(cfg.previewCount);
    const s0 = createTestGameState({
      board,
      cfg,
      piece: null,
      queue: q.pieces,
      rng: q.newRng,
    });

    const r = step(s0, []);
    // Should emit TopOut and keep piece null
    const topOut = findEvent(r.events, "TopOut");
    expect(topOut).toBeDefined();
    expect(r.state.piece).toBeNull();
  });
});
