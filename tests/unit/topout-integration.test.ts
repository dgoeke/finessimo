import { describe, it, expect } from "@jest/globals";

import { reducer } from "../../src/state/reducer";
import {
  buildPlayingState,
  createBoardCells,
  idx,
} from "../../src/state/types";
import { createGridCoord } from "../../src/types/brands";
import { createTimestamp } from "../../src/types/timestamp";
import { createTestGameState } from "../test-helpers";

describe("topout integration", () => {
  it("should transition to topOut on spawn collision", () => {
    const initialState = createTestGameState();
    const timestamp = createTimestamp(1000);

    // Block T piece spawn area at (4, -1)
    const newCells = createBoardCells();
    for (let i = 0; i < initialState.board.cells.length; i++) {
      newCells[i] = initialState.board.cells[i] ?? 0;
    }
    newCells[idx(initialState.board, createGridCoord(4), createGridCoord(-1))] =
      1;

    const blockedState = buildPlayingState(
      {
        ...initialState,
        board: { ...initialState.board, cells: newCells },
      },
      {
        active: undefined, // No active piece to trigger spawn
      },
    );

    // Try to spawn T piece
    const result = reducer(blockedState, {
      piece: "T",
      timestampMs: timestamp,
      type: "Spawn",
    });

    expect(result.status).toBe("topOut");
  });

  it("should transition to topOut on hold collision", () => {
    const initialState = createTestGameState();

    // Set up state with T piece active and O piece in hold
    const stateWithHold = buildPlayingState(
      {
        ...initialState,
        canHold: true,
        hold: "O",
      },
      {
        active: {
          id: "T",
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(0),
        },
      },
    );

    // Block O piece spawn area
    const newCells = createBoardCells();
    for (let i = 0; i < stateWithHold.board.cells.length; i++) {
      newCells[i] = stateWithHold.board.cells[i] ?? 0;
    }
    // O piece spawns at (3, -2) with cells at [[1,0], [2,0], [1,1], [2,1]]
    // So absolute positions are (4,-2), (5,-2), (4,-1), (5,-1)
    newCells[
      idx(stateWithHold.board, createGridCoord(4), createGridCoord(-2))
    ] = 1;
    newCells[
      idx(stateWithHold.board, createGridCoord(5), createGridCoord(-2))
    ] = 1;
    newCells[
      idx(stateWithHold.board, createGridCoord(4), createGridCoord(-1))
    ] = 1;
    newCells[
      idx(stateWithHold.board, createGridCoord(5), createGridCoord(-1))
    ] = 1;

    const blockedState = buildPlayingState(
      {
        ...stateWithHold,
        board: { ...stateWithHold.board, cells: newCells },
      },
      {
        active: stateWithHold.active, // Preserve the active piece
      },
    );

    // Try to hold
    const result = reducer(blockedState, {
      type: "Hold",
    });

    expect(result.status).toBe("topOut");
  });

  it("should transition to topOut when garbage pushes blocks into vanish zone", () => {
    const initialState = createTestGameState();

    // Place a block at top of visible area
    const newCells = createBoardCells();
    for (let i = 0; i < initialState.board.cells.length; i++) {
      newCells[i] = initialState.board.cells[i] ?? 0;
    }
    newCells[idx(initialState.board, createGridCoord(0), createGridCoord(0))] =
      1;

    const stateWithBlock = buildPlayingState({
      ...initialState,
      board: { ...initialState.board, cells: newCells },
    });

    // Add garbage row (will push existing block into vanish zone)
    const garbageRow = [1, 1, 1, 1, 1, 1, 1, 1, 1, 0] as const; // gap at position 9

    const result = reducer(stateWithBlock, {
      row: garbageRow,
      type: "CreateGarbageRow",
    });

    expect(result.status).toBe("topOut");
  });
});
