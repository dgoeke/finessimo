import {
  finesseCalculator,
  extractFinesseActions,
} from "../../src/finesse/calculator";
import { FinesseAction, idx } from "../../src/state/types";
import { PIECES } from "../../src/core/pieces";
import { createEmptyBoard } from "../../src/core/board";
import { reducer } from "../../src/state/reducer";
import { createRng } from "../../src/core/rng";
import type {
  ActivePiece,
  GameplayConfig,
  GameState,
  Rot,
  Board,
  Action,
} from "../../src/state/types";
import { createTimestamp } from "../../src/types/timestamp";

const cfg: GameplayConfig = { finesseCancelMs: 50 };

function spawnPiece(id: keyof typeof PIECES): ActivePiece {
  const topLeft = PIECES[id].spawnTopLeft;
  return { id, rot: "spawn", x: topLeft[0], y: topLeft[1] };
}

// Helper to create a board with specific cells filled
function createBoardWithCells(filledCells: [number, number][]): Board {
  const board = createEmptyBoard();
  const newCells = new Uint8Array(board.cells);

  for (const [x, y] of filledCells) {
    if (x >= 0 && x < board.width && y >= 0 && y < board.height) {
      newCells[idx(x, y)] = 1; // Use 1 for filled cell
    }
  }

  return {
    ...board,
    cells: newCells,
  };
}

describe("Finesse Calculator - Soft Drop Scenarios", () => {
  test("T-spin simulation with actual game mechanics", () => {
    // Board setup as specified:
    //       top |..........|  0-16 (all empty)
    //           |......xxxx|  17
    //           |xxxx...xxx|  18
    //    bottom |xxxxx.xxxx|  19
    //
    // Simulate user input: Move Right → CCW → Soft Drop → CCW → Hard Drop
    // Expected: T-spin double line clear (rows 18 and 19)

    const filledCells: [number, number][] = [
      [6, 17],
      [7, 17],
      [8, 17],
      [9, 17],
      [0, 18],
      [1, 18],
      [2, 18],
      [3, 18],
      [7, 18],
      [8, 18],
      [9, 18],
      [0, 19],
      [1, 19],
      [2, 19],
      [3, 19],
      [4, 19],
      [6, 19],
      [7, 19],
      [8, 19],
      [9, 19],
    ];

    const board = createBoardWithCells(filledCells);

    // Create initial game state with our board and T piece
    const initialState: GameState = {
      board,
      active: spawnPiece("T"),
      status: "playing" as const,
      tick: 0,
      processedInputLog: [],
      rng: createRng("12345"),
      hold: undefined,
      canHold: true,
      nextQueue: ["I", "O", "S"],
      timing: {
        gravityEnabled: true,
        gravityMs: 1000,
        lockDelayMs: 500,
        lineClearDelayMs: 0,
        softDrop: 20 as const,
        tickHz: 60,
        dasMs: 100,
        arrMs: 50,
      },
      gameplay: { finesseCancelMs: 50 },
      stats: {
        piecesPlaced: 0,
        sessionPiecesPlaced: 0,
        linesCleared: 0,
        sessionLinesCleared: 0,
        optimalPlacements: 0,
        incorrectPlacements: 0,
        attempts: 0,
        startedAtMs: 0,
        timePlayedMs: 0,
        accuracyPercentage: 0,
        finesseAccuracy: 0,
        averageInputsPerPiece: 0,
        sessionStartMs: 0,
        totalSessions: 0,
        longestSessionMs: 0,
        piecesPerMinute: 0,
        linesPerMinute: 0,
        totalInputs: 0,
        optimalInputs: 0,
        totalFaults: 0,
        faultsByType: {},
        singleLines: 0,
        doubleLines: 0,
        tripleLines: 0,
        tetrisLines: 0,
      },
      physics: {
        lastGravityTime: 0,
        isSoftDropping: false,
        lockDelayStartTime: null,
        lineClearStartTime: null,
        lineClearLines: [],
      },
      currentMode: "freePlay",
      finesseFeedback: null,
      modePrompt: null,
      modeData: null,
    };

    // Verify initial state setup
    expect(initialState.active?.id).toBe("T");
    expect(initialState.active?.rot).toBe("spawn");
    expect(initialState.board.cells[idx(5, 19)]).toBe(0); // Gap at x=5, y=19
    expect(initialState.board.cells[idx(4, 19)]).toBe(1); // Filled at x=4, y=19
    expect(initialState.board.cells[idx(6, 19)]).toBe(1); // Filled at x=6, y=19

    // Simulate the input sequence: Move Right → CCW → Soft Drop → CCW → Hard Drop
    let currentState: GameState = initialState;

    // Step 1: Move right to x=4 (T-spin position)
    currentState = reducer(currentState, {
      type: "TapMove",
      dir: 1,
      timestampMs: createTimestamp(1000),
    });
    expect(currentState.active?.x).toBe(4);

    // Step 2: Rotate CCW (spawn → left)
    currentState = reducer(currentState, { type: "Rotate", dir: "CCW" });
    expect(currentState.active?.rot).toBe("left");

    // Step 3: Start soft drop to get piece down to the right level
    currentState = reducer(currentState, { type: "SoftDrop", on: true });
    expect(currentState.physics.isSoftDropping).toBe(true);

    // Simulate several ticks to let the piece fall with soft drop
    // We need to get the piece past the overhang at row 17 while in "left" orientation
    for (let i = 0; i < 20; i++) {
      const tickTimestamp = createTimestamp(1000 + i * 100);
      const prevY = currentState.active?.y;
      currentState = reducer(currentState, {
        type: "Tick",
        timestampMs: tickTimestamp,
      });

      const newY = currentState.active?.y;

      // Continue until piece reaches around row 17-18 (past the overhang)
      if (newY === prevY) {
        break;
      }
      if (newY && newY >= 17) {
        break;
      }
    }

    // Step 4: Turn off soft drop
    currentState = reducer(currentState, { type: "SoftDrop", on: false });
    expect(currentState.physics.isSoftDropping).toBe(false);

    // Step 5: Second CCW rotation for T-spin setup (left → two)
    currentState = reducer(currentState, { type: "Rotate", dir: "CCW" });
    expect(currentState.active?.rot).toBe("two");

    // Step 6: Hard drop to lock the piece and trigger T-spin double
    currentState = reducer(currentState, {
      type: "HardDrop",
      timestampMs: createTimestamp(2000),
    });

    // Check if piece is locked (no active piece)
    expect(currentState.active).toBeUndefined();

    // We expect a T-spin double (2 lines cleared: rows 18 and 19)
    expect(currentState.stats.linesCleared).toBe(2);
    expect(currentState.stats.doubleLines).toBe(1);

    // Verify finesse analysis works but shows limitations
    const playerActions = currentState.processedInputLog;
    const finesseActions = extractFinesseActions(playerActions);
    const tPiece = spawnPiece("T");
    const optimalSequences = finesseCalculator.calculateOptimal(
      tPiece,
      4,
      "two",
      cfg,
    );

    expect(finesseActions).toEqual([
      "MoveRight",
      "RotateCCW",
      "SoftDrop",
      "RotateCCW",
      "HardDrop",
    ]);

    // The optimalSequence doesn't include softdrop and can't even work on our
    // filled board, because it assumes an empty board.
    expect(optimalSequences[0]).toEqual([
      "MoveRight",
      "RotateCW",
      "RotateCW",
      "HardDrop",
    ]);
  });

  test("extractFinesseActions correctly processes SoftDrop actions", () => {
    const timestamp = createTimestamp(1000);

    // Simulate a soft drop sequence that eventually locks
    const actions: Action[] = [
      { type: "TapMove", dir: -1, timestampMs: timestamp }, // Move left
      { type: "SoftDrop", on: true }, // Start soft drop - should be included
      { type: "Tick", timestampMs: timestamp }, // Game tick - should be filtered
      { type: "SoftDrop", on: false }, // End soft drop - should be filtered
      { type: "Lock", timestampMs: timestamp }, // Auto-lock from soft drop - should be filtered
    ];

    const result = extractFinesseActions(actions);

    // Should contain the move action and the SoftDrop "on" action, but not the "off" action
    expect(result).toEqual(["MoveLeft", "SoftDrop"]);
  });

  test("soft drop sequence without hard drop should be detected as suboptimal", () => {
    const piece = spawnPiece("T");
    const targetX = 0;
    const targetRot: Rot = "spawn";

    // Player sequence that moves left but doesn't include hard drop (simulating soft drop lock)
    const playerInputs: FinesseAction[] = ["DASLeft"]; // Missing HardDrop

    const result = finesseCalculator.analyze(
      piece,
      targetX,
      targetRot,
      playerInputs,
      cfg,
    );

    expect(result.isOptimal).toBe(false);
    expect(result.faults.some((f) => f.type === "suboptimal_path")).toBe(true);

    // The optimal sequence should include HardDrop
    expect(result.optimalSequences.length).toBeGreaterThan(0);
    expect(result.optimalSequences[0]).toEqual(["DASLeft", "HardDrop"]);
  });

  test("BFS explores all possible movement patterns including complex routes", () => {
    // Test that BFS can find routes that go down-left or down-right
    // This tests the core assumption that the finesse calculator should work
    // with empty board regardless of actual board state

    const piece = spawnPiece("J"); // J piece spawn at x=3
    const targetX = 7; // Far right
    const targetRot: Rot = "two"; // upside down

    const seqs = finesseCalculator.calculateOptimal(
      piece,
      targetX,
      targetRot,
      cfg,
    );

    expect(seqs.length).toBeGreaterThan(0);

    // Should be able to find multiple paths
    const minLen = Math.min(...seqs.map((s) => s.length));
    expect(minLen).toBeGreaterThanOrEqual(3); // Movement + rotations + hard drop

    // Should contain movements and rotations
    const flatActions = seqs.flat();
    expect(
      flatActions.some(
        (action) => action.includes("Right") || action === "DASRight",
      ),
    ).toBe(true);
    expect(flatActions.some((action) => action.includes("Rotate"))).toBe(true);
    expect(
      flatActions.every((action) =>
        [
          "MoveLeft",
          "MoveRight",
          "DASLeft",
          "DASRight",
          "RotateCW",
          "RotateCCW",
          "HardDrop",
        ].includes(action),
      ),
    ).toBe(true);
  });
});
