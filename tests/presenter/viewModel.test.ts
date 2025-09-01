import { describe, expect, it } from "@jest/globals";

import { clearLines, dropToBottom } from "../../src/core/board";
import { PIECES } from "../../src/core/pieces";
import { createInitialState } from "../../src/engine/init";
import { mapGameStateToViewModel } from "../../src/presentation/phaser/presenter/viewModel";
import { buildTopOutState } from "../../src/state/types";
import { createGridCoord, createSeed } from "../../src/types/brands";
import { createTimestamp } from "../../src/types/timestamp";

describe("mapGameStateToViewModel (Phase 2)", () => {
  it("maps empty board to 20x10 grid of zeros", () => {
    const s = createInitialState(createSeed("seed"), createTimestamp(1));

    const vm = mapGameStateToViewModel(s);
    expect(vm.board.length).toBe(20);
    for (const row of vm.board) {
      expect(row.length).toBe(10);
      expect(row.every((v) => v === 0)).toBe(true);
    }
  });

  it("includes negative rows for spawn above top in active cells", () => {
    const s0 = createInitialState(createSeed("seed"), createTimestamp(2));
    const spawn = PIECES.T.spawnTopLeft; // [x,y], y likely negative
    const s = {
      ...s0,
      active: {
        id: "T" as const,
        rot: "spawn" as const,
        x: createGridCoord(spawn[0]),
        y: createGridCoord(spawn[1]),
      },
    } as const;

    const vm = mapGameStateToViewModel(s);
    expect(vm.active).toBeDefined();
    const rows = vm.active?.cells.map((c) => c.row as unknown as number) ?? [];
    // At least one cell should be above visible board (negative row)
    expect(rows.some((r) => r < 0)).toBe(true);
  });

  it("suppresses ghost when it overlaps active position", () => {
    const s0 = createInitialState(createSeed("seed"), createTimestamp(3));
    // Place an O piece at the bottom so ghost == active
    const spawn = PIECES.O.spawnTopLeft;
    const piece = {
      id: "O" as const,
      rot: "spawn" as const,
      x: createGridCoord(spawn[0]),
      y: createGridCoord(spawn[1]),
    };
    const bottom = dropToBottom(s0.board, piece);
    const s = { ...s0, active: bottom } as const;

    const vm = mapGameStateToViewModel(s);
    expect(vm.ghost).toBeUndefined();
    // Sanity: active present and within board height range
    expect(
      (vm.active?.cells ?? []).every((c) => (c.row as unknown as number) < 20),
    ).toBe(true);
  });

  it("sets topOut flag when state is topOut", () => {
    const s0 = createInitialState(createSeed("seed"), createTimestamp(4));
    const sTop = buildTopOutState(s0);
    const vm = mapGameStateToViewModel(sTop);
    expect(vm.topOut).toBe(true);
  });

  it("reflects cleared line compaction in board mapping", () => {
    const s0 = createInitialState(createSeed("seed"), createTimestamp(5));
    // Fill bottom row with non-zero values
    const cells = new Uint8Array(s0.board.cells);
    for (let x = 0; x < 10; x++) cells[19 * 10 + x] = 1;
    const s1 = { ...s0, board: { ...s0.board, cells } as typeof s0.board };
    // Clear the completed bottom line
    const s2 = { ...s1, board: clearLines(s1.board, [19]) };

    const vm = mapGameStateToViewModel(s2);
    // Bottom row should be all zeros after compaction
    const lastRow = vm.board[19];
    expect(Array.isArray(lastRow)).toBe(true);
    expect((lastRow ?? []).every((v) => v === 0)).toBe(true);
  });
});
