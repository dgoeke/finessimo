import { createEmptyBoard } from "../../src/core/board";
import { PIECES } from "../../src/core/pieces";
import { createRng } from "../../src/core/rng";
import {
  finesseCalculator,
  extractFinesseActions,
} from "../../src/finesse/calculator";
import { reducer } from "../../src/state/reducer";
import {
  type FinesseAction,
  idx,
  type ActivePiece,
  type GameplayConfig,
  type GameState,
  type Rot,
  type Board,
  type Action,
} from "../../src/state/types";
import { createTimestamp } from "../../src/types/timestamp";

const cfg: GameplayConfig = { finesseCancelMs: 50 };

function spawnPiece(id: keyof typeof PIECES): ActivePiece {
  const topLeft = PIECES[id].spawnTopLeft;
  return { id, rot: "spawn", x: topLeft[0], y: topLeft[1] };
}

// Helper to create a board with specific cells filled
function createBoardWithCells(filledCells: Array<[number, number]>): Board {
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

    const filledCells: Array<[number, number]> = [
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
      active: spawnPiece("T"),
      board,
      canHold: true,
      currentMode: "freePlay",
      finesseFeedback: null,
      gameplay: { finesseCancelMs: 50 },
      hold: undefined,
      modeData: null,
      modePrompt: null,
      nextQueue: ["I", "O", "S"],
      physics: {
        isSoftDropping: false,
        lastGravityTime: 0,
        lineClearLines: [],
        lineClearStartTime: null,
        lockDelayStartTime: null,
      },
      processedInputLog: [],
      rng: createRng("12345"),
      stats: {
        accuracyPercentage: 0,
        attempts: 0,
        averageInputsPerPiece: 0,
        doubleLines: 0,
        faultsByType: {},
        finesseAccuracy: 0,
        incorrectPlacements: 0,
        linesCleared: 0,
        linesPerMinute: 0,
        longestSessionMs: 0,
        optimalInputs: 0,
        optimalPlacements: 0,
        piecesPerMinute: 0,
        piecesPlaced: 0,
        sessionLinesCleared: 0,
        sessionPiecesPlaced: 0,
        sessionStartMs: 0,
        singleLines: 0,
        startedAtMs: 0,
        tetrisLines: 0,
        timePlayedMs: 0,
        totalFaults: 0,
        totalInputs: 0,
        totalSessions: 0,
        tripleLines: 0,
      },
      status: "playing" as const,
      tick: 0,
      timing: {
        arrMs: 50,
        dasMs: 100,
        gravityEnabled: true,
        gravityMs: 1000,
        lineClearDelayMs: 0,
        lockDelayMs: 500,
        softDrop: 20 as const,
        tickHz: 60,
      },
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
      dir: 1,
      optimistic: false,
      timestampMs: createTimestamp(1000),
      type: "TapMove",
    });
    expect(currentState.active?.x).toBe(4);

    // Step 2: Rotate CCW (spawn → left)
    currentState = reducer(currentState, { dir: "CCW", type: "Rotate" });
    expect(currentState.active?.rot).toBe("left");

    // Step 3: Start soft drop to get piece down to the right level
    currentState = reducer(currentState, { on: true, type: "SoftDrop" });
    expect(currentState.physics.isSoftDropping).toBe(true);

    // Simulate several ticks to let the piece fall with soft drop
    // We need to get the piece past the overhang at row 17 while in "left" orientation
    for (let i = 0; i < 20; i++) {
      const tickTimestamp = createTimestamp(1000 + i * 100);
      const prevY = currentState.active?.y;
      currentState = reducer(currentState, {
        timestampMs: tickTimestamp,
        type: "Tick",
      });

      const newY = currentState.active?.y;

      // Continue until piece reaches around row 17-18 (past the overhang)
      if (newY === prevY) {
        break;
      }
      if (newY !== undefined && newY >= 17) {
        break;
      }
    }

    // Step 4: Turn off soft drop
    currentState = reducer(currentState, { on: false, type: "SoftDrop" });
    expect(currentState.physics.isSoftDropping).toBe(false);

    // Step 5: Second CCW rotation for T-spin setup (left → two)
    currentState = reducer(currentState, { dir: "CCW", type: "Rotate" });
    expect(currentState.active?.rot).toBe("two");

    // Step 6: Hard drop to lock the piece and trigger T-spin double
    currentState = reducer(currentState, {
      timestampMs: createTimestamp(2000),
      type: "HardDrop",
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
    const actions: Array<Action> = [
      { dir: -1, optimistic: false, timestampMs: timestamp, type: "TapMove" }, // Move left
      { on: true, type: "SoftDrop" }, // Start soft drop - should be included
      { timestampMs: timestamp, type: "Tick" }, // Game tick - should be filtered
      { on: false, type: "SoftDrop" }, // End soft drop - should be filtered
      { timestampMs: timestamp, type: "Lock" }, // Auto-lock from soft drop - should be filtered
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
    const playerInputs: Array<FinesseAction> = ["DASLeft"]; // Missing HardDrop

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

  test("finesse calculator bypasses feedback when soft drop is detected", () => {
    const piece = spawnPiece("T");
    const targetX = 4;
    const targetRot: Rot = "two";

    // Player sequence with soft drop - should bypass finesse analysis
    const playerInputsWithSoftDrop: Array<FinesseAction> = [
      "MoveRight",
      "RotateCCW",
      "SoftDrop",
      "RotateCCW",
      "HardDrop",
    ];

    const result = finesseCalculator.analyze(
      piece,
      targetX,
      targetRot,
      playerInputsWithSoftDrop,
      cfg,
    );

    // Should bypass analysis and return neutral feedback
    expect(result.isOptimal).toBe(true);
    expect(result.faults).toEqual([]);
    expect(result.optimalSequences).toEqual([]);
    expect(result.playerSequence).toEqual(playerInputsWithSoftDrop);
  });

  test("finesse calculator still provides feedback for sequences without soft drop", () => {
    const piece = spawnPiece("T");
    const targetX = 4;
    const targetRot: Rot = "two";

    // Player sequence without soft drop - should get normal finesse analysis
    const playerInputsWithoutSoftDrop: Array<FinesseAction> = [
      "MoveRight",
      "RotateCW",
      "RotateCW",
      "RotateCW", // Extra rotation - suboptimal
      "HardDrop",
    ];

    const result = finesseCalculator.analyze(
      piece,
      targetX,
      targetRot,
      playerInputsWithoutSoftDrop,
      cfg,
    );

    // Should provide normal analysis with faults for suboptimal play
    expect(result.isOptimal).toBe(false);
    expect(result.faults.length).toBeGreaterThan(0);
    expect(result.optimalSequences.length).toBeGreaterThan(0);
  });
});
