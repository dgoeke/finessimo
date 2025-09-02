/* eslint-disable sonarjs/todo-tag */
import { describe, it, expect } from "@jest/globals";

import { isTopOut } from "../../src/core/spawning";
import { type Board, createBoardCells, idx } from "../../src/state/types";
import { createGridCoord } from "../../src/types/brands";

// Helper to create a test board
function createTestBoard(): Board {
  return {
    cells: createBoardCells(),
    height: 20,
    totalHeight: 23,
    vanishRows: 3,
    width: 10,
  };
}

describe("top-out detection", () => {
  it("should detect top-out when spawn position is blocked", () => {
    const board = createTestBoard();

    // Block spawn area for T piece to simulate a top-out condition
    const blockX = createGridCoord(4);
    const blockY = createGridCoord(-2);
    board.cells[idx(board, blockX, blockY)] = 1; // Block cell at (4,-2)

    expect(isTopOut(board, "T")).toBe(true);
  });

  it("should not top-out when spawn position is clear", () => {
    const board = createTestBoard();

    // Empty board should not cause top-out
    expect(isTopOut(board, "T")).toBe(false);
    expect(isTopOut(board, "I")).toBe(false);
    expect(isTopOut(board, "O")).toBe(false);
  });

  it("should handle different piece types consistently", () => {
    const board = createTestBoard();

    // Test that all piece types can spawn on empty board
    expect(isTopOut(board, "I")).toBe(false);
    expect(isTopOut(board, "O")).toBe(false);
    expect(isTopOut(board, "T")).toBe(false);
    expect(isTopOut(board, "S")).toBe(false);
    expect(isTopOut(board, "Z")).toBe(false);
    expect(isTopOut(board, "J")).toBe(false);
    expect(isTopOut(board, "L")).toBe(false);
  });

  // TODO: Add comprehensive vanish zone topout detection tests when spawn collision detection is re-implemented
  // These tests should comprehensively cover vanish zone topout scenarios:

  // TODO: Test vanish zone blockout - when spawn area in vanish zone is blocked
  it.todo("should detect blockout when vanish zone spawn area is occupied");

  // TODO: Test lockout - when piece spawns but immediately locks due to vanish zone collision
  it.todo("should detect lockout with vanish zone collision on spawn");

  // TODO: Test partial vanish zone collision - piece spawns partly in vanish zone
  it.todo("should handle partial vanish zone collisions during spawn");

  // TODO: Test vanish zone vs visible area topout distinction
  it.todo("should distinguish between vanish zone and visible area topout");

  // TODO: Test edge cases at vanish zone boundaries
  it.todo("should handle topout at vanish zone boundaries correctly");

  // TODO: Test different piece spawn positions relative to vanish zone
  it.todo("should handle all piece types with vanish zone topout scenarios");

  // TODO: Test complex scenarios - vanish zone full but visible area clear
  it.todo(
    "should detect topout when vanish zone is full but visible area is clear",
  );

  // TODO: Test interaction with line clearing and vanish zone state
  it.todo(
    "should handle topout detection after line clearing with vanish zone blocks",
  );
});
