import { createEmptyBoard } from "../../src/core/board";
import { PIECES } from "../../src/core/pieces";
import { createSevenBagRng } from "../../src/core/rng";
import { Airborne } from "../../src/engine/physics/lock-delay.machine";
import {
  finesseCalculator,
  extractFinesseActions,
  extractFinesseActionsFromProcessed,
} from "../../src/finesse/calculator";
import {
  type FinesseAction,
  idx,
  type ActivePiece,
  type GameplayConfig,
  type GameState,
  type Rot,
  type Board,
  type Action,
  type ProcessedAction,
  createBoardCells,
  buildPlayingState,
} from "../../src/state/types";
import {
  createDurationMs,
  createGridCoord,
  createSeed,
} from "../../src/types/brands";
import { createTimestamp } from "../../src/types/timestamp";
import { reducerWithPipeline as reducer } from "../helpers/reducer-with-pipeline";
import {
  createTestPhysicsState,
  createTestRotateAction,
  createTestSoftDropAction,
} from "../test-helpers";

const cfg: GameplayConfig = {
  finesseCancelMs: createDurationMs(50),
  holdEnabled: true,
  openingCoachingEnabled: false,
};

function spawnPiece(id: keyof typeof PIECES): ActivePiece {
  const topLeft = PIECES[id].spawnTopLeft;
  return {
    id,
    rot: "spawn",
    x: createGridCoord(topLeft[0]),
    y: createGridCoord(topLeft[1]),
  };
}

// Helper to create a board with specific cells filled
function createBoardWithCells(filledCells: Array<[number, number]>): Board {
  const board = createEmptyBoard();
  const newCells = createBoardCells();

  // Copy existing cells
  for (let i = 0; i < board.cells.length; i++) {
    newCells[i] = board.cells[i] ?? 0;
  }

  for (const [x, y] of filledCells) {
    if (x >= 0 && x < board.width && y >= 0 && y < board.height) {
      newCells[idx(board, createGridCoord(x), createGridCoord(y))] = 1; // Use 1 for filled cell
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
    const initialState: GameState = buildPlayingState(
      {
        board,
        boardDecorations: null,
        canHold: true,
        currentMode: "freePlay",
        finesseFeedback: null,
        gameplay: {
          finesseCancelMs: createDurationMs(50),
          holdEnabled: true,
          openingCoachingEnabled: false,
        },
        guidance: null,
        hold: undefined,
        modeData: null,
        modePrompt: null,
        nextQueue: ["I", "O", "S"],
        physics: createTestPhysicsState({
          isSoftDropping: false,
          lastGravityTime: createTimestamp(1),
          lineClearLines: [],
          lineClearStartTime: null,
          lockDelay: Airborne(),
        }),
        processedInputLog: [],
        rng: createSevenBagRng(createSeed("12345")),
        stats: {
          accuracyPercentage: 0,
          attempts: 0,
          averageInputsPerPiece: 0,
          doubleLines: 0,
          faultsByType: {},
          finesseAccuracy: createGridCoord(0),
          incorrectPlacements: 0,
          linesCleared: 0,
          linesPerMinute: 0,
          longestSessionMs: createDurationMs(0),
          optimalInputs: 0,
          optimalPlacements: 0,
          piecesPerMinute: 0,
          piecesPlaced: 0,
          sessionLinesCleared: 0,
          sessionPiecesPlaced: 0,
          sessionStartMs: createTimestamp(0.1),
          singleLines: 0,
          startedAtMs: createTimestamp(0.1),
          tetrisLines: 0,
          timePlayedMs: createDurationMs(0),
          totalFaults: 0,
          totalInputs: 0,
          totalSessions: 0,
          tripleLines: 0,
        },
        tick: 0,
        timing: {
          arrMs: createDurationMs(50),
          dasMs: createDurationMs(100),
          gravityEnabled: true,
          gravityMs: createDurationMs(1000),
          lineClearDelayMs: createDurationMs(0),
          lockDelayMaxResets: 15,
          lockDelayMs: createDurationMs(500),
          softDrop: 20 as const,
          tickHz: 60,
        },
        uiEffects: [],
      },
      {
        active: spawnPiece("T"),
      },
    );

    // Verify initial state setup
    expect(initialState.active?.id).toBe("T");
    expect(initialState.active?.rot).toBe("spawn");
    expect(
      initialState.board.cells[
        idx(initialState.board, createGridCoord(5), createGridCoord(19))
      ],
    ).toBe(0); // Gap at x=5, y=19
    expect(
      initialState.board.cells[
        idx(initialState.board, createGridCoord(4), createGridCoord(19))
      ],
    ).toBe(1); // Filled at x=4, y=19
    expect(
      initialState.board.cells[
        idx(initialState.board, createGridCoord(6), createGridCoord(19))
      ],
    ).toBe(1); // Filled at x=6, y=19

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
    currentState = reducer(currentState, createTestRotateAction("CCW"));
    expect(currentState.active?.rot).toBe("left");

    // Step 3: Start soft drop to get piece down to the right level
    currentState = reducer(currentState, createTestSoftDropAction(true));
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
    currentState = reducer(currentState, createTestSoftDropAction(false));
    expect(currentState.physics.isSoftDropping).toBe(false);

    // Step 5: Second CCW rotation for T-spin setup (left → two)
    currentState = reducer(currentState, createTestRotateAction("CCW"));
    expect(currentState.active?.rot).toBe("two");

    // Build expected processedInputLog based on the manual actions performed
    // This simulates what the app layer would have recorded
    const playerActions: Array<ProcessedAction> = [
      { dir: 1, kind: "TapMove", t: createTimestamp(1000) }, // Move Right
      { dir: "CCW", kind: "Rotate", t: createTimestamp(1100) }, // First CCW rotation
      { kind: "SoftDrop", on: true, t: createTimestamp(1200) }, // Soft drop on
      { kind: "SoftDrop", on: false, t: createTimestamp(1800) }, // Soft drop off
      { dir: "CCW", kind: "Rotate", t: createTimestamp(1900) }, // Second CCW rotation
      { kind: "HardDrop", t: createTimestamp(2000) }, // Hard drop
    ];

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
    const finesseActions = extractFinesseActionsFromProcessed(playerActions);
    const tPiece = spawnPiece("T");
    const optimalSequence = finesseCalculator.calculateOptimal(
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
    expect(optimalSequence).toEqual([
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
      createTestSoftDropAction(true), // Start soft drop - should be included
      { timestampMs: timestamp, type: "Tick" }, // Game tick - should be filtered
      createTestSoftDropAction(false), // End soft drop - should be filtered
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

    expect(result.kind).toBe("faulty");
    if (result.kind === "faulty") {
      expect(result.faults.some((f) => f.type === "suboptimal_path")).toBe(
        true,
      );
    }

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

    const seq = finesseCalculator.calculateOptimal(
      piece,
      targetX,
      targetRot,
      cfg,
    );
    expect(seq).toBeDefined();
    if (!seq) return;
    expect(seq.length).toBeGreaterThanOrEqual(3); // Movement + rotations + hard drop
    expect(
      seq.some((action) => action.includes("Right") || action === "DASRight"),
    ).toBe(true);
    expect(seq.some((action) => action.includes("Rotate"))).toBe(true);
    expect(
      seq.every((action) =>
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
    expect(result.kind).toBe("optimal");
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
    expect(result.kind).toBe("faulty");
    if (result.kind === "faulty") {
      expect(result.faults.length).toBeGreaterThan(0);
    }
    expect(result.optimalSequences.length).toBeGreaterThan(0);
  });
});
