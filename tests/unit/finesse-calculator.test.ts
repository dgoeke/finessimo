import { createEmptyBoard, moveToWall } from "../../src/core/board";
import { PIECES } from "../../src/core/pieces";
import { getNextRotation, tryRotate } from "../../src/core/srs";
import {
  finesseCalculator,
  type Fault,
  extractFinesseActions,
} from "../../src/finesse/calculator";
import {
  type FinesseAction,
  type ActivePiece,
  type GameplayConfig,
  type Rot,
  type Action,
} from "../../src/state/types";
import { createDurationMs, createGridCoord } from "../../src/types/brands";
import { createTimestamp } from "../../src/types/timestamp";
import {
  MoveLeft,
  MoveRight,
  HoldMoveLeft,
  HoldMoveRight,
  HoldStartLeft,
  HoldStartRight,
  RotateCW,
  HardDrop,
} from "../helpers/actions";
import { createTestSpawnAction, assertDefined } from "../test-helpers";

const cfg: GameplayConfig = {
  finesseCancelMs: createDurationMs(50),
  holdEnabled: true,
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

describe("Finesse Calculator (BFS minimality)", () => {
  test("Spawn position with no movement is HardDrop only (1 input)", () => {
    const piece = spawnPiece("T");
    const seqs = finesseCalculator.calculateOptimal(
      piece,
      piece.x,
      "spawn",
      cfg,
    );
    const minLen = Math.min(...seqs.map((s) => s.length));
    expect(minLen).toBe(1);
    expect(seqs.some((s) => s.length === 1 && s[0] === "HardDrop")).toBe(true);
  });

  test("Hold-left to wall is 1 input (+ HardDrop)", () => {
    const piece = spawnPiece("T"); // spawn x = 3
    const targetX = 0;
    const targetRot: Rot = "spawn";
    const seqs = finesseCalculator.calculateOptimal(
      piece,
      targetX,
      targetRot,
      cfg,
    );
    expect(seqs.length).toBeGreaterThan(0);
    // Minimal should be exactly 2 inputs: LeftDAS + HardDrop
    const minLen = Math.min(...seqs.map((s) => s.length));
    expect(minLen).toBe(2);
    const one = seqs.find((s) => s.length === 2);
    expect(one).toBeDefined();
    if (!one) return;
    expect(one).toEqual(["DASLeft", "HardDrop"]);
  });

  test("Two-step left to column 1 is 2 inputs (+ HardDrop)", () => {
    const piece = spawnPiece("T"); // x=3
    const targetX = 1; // two steps left
    const targetRot: Rot = "spawn";
    const seqs = finesseCalculator.calculateOptimal(
      piece,
      targetX,
      targetRot,
      cfg,
    );
    expect(seqs.length).toBeGreaterThan(0);
    const minLen = Math.min(...seqs.map((s) => s.length));
    expect(minLen).toBe(3); // Left, Left, HardDrop
    const opt = seqs.find((s) => s.length === 3);
    expect(opt).toBeDefined();
    if (!opt) return;
    expect(opt[0]).toBe("MoveLeft");
    expect(opt[1]).toBe("MoveLeft");
    expect(opt[2]).toBe("HardDrop");
  });

  test("Rotate to right is 1 input (+ HardDrop)", () => {
    const piece = spawnPiece("T");
    const targetX = piece.x; // keep same column
    const targetRot: Rot = "right";
    const seqs = finesseCalculator.calculateOptimal(
      piece,
      targetX,
      targetRot,
      cfg,
    );
    const minLen = Math.min(...seqs.map((s) => s.length));
    expect(minLen).toBe(2); // RotateCW, HardDrop
    // Either CW or CCW could reach right depending on path, but CW is direct from spawn
    const found = seqs.find((s) => s.length === 2);
    expect(found).toBeDefined();
    if (!found) return;
    expect(found[1]).toBe("HardDrop");
    expect(["RotateCW", "RotateCCW"]).toContain(found[0]);
  });

  test("Rotate to left prefers CCW (1 input + HardDrop)", () => {
    const piece = spawnPiece("T");
    const targetX = piece.x;
    const targetRot: Rot = "left";
    const seqs = finesseCalculator.calculateOptimal(
      piece,
      targetX,
      targetRot,
      cfg,
    );
    const minLen = Math.min(...seqs.map((s) => s.length));
    expect(minLen).toBe(2); // RotateCCW, HardDrop
    const found = seqs.find((s) => s.length === 2);
    expect(found).toBeDefined();
    if (!found) return;
    expect(found[1]).toBe("HardDrop");
    expect(found[0]).toBe("RotateCCW");
  });

  test("Rotate to two state is 2 inputs (+ HardDrop)", () => {
    const piece = spawnPiece("T");
    const targetX = piece.x;
    const targetRot: Rot = "two";
    const seqs = finesseCalculator.calculateOptimal(
      piece,
      targetX,
      targetRot,
      cfg,
    );
    const minLen = Math.min(...seqs.map((s) => s.length));
    expect(minLen).toBe(3); // Two rotations needed to reach 'two' state, plus HardDrop
    const found = seqs.find((s) => s.length === 3);
    expect(found).toBeDefined();
    if (!found) return;
    expect(found[2]).toBe("HardDrop");
    // Could be CW+CW or CCW+CCW
    expect(["RotateCW", "RotateCCW"]).toContain(found[0]);
    expect(["RotateCW", "RotateCCW"]).toContain(found[1]);
  });

  test("Unreachable target returns no sequences (O cannot rotate)", () => {
    const piece = spawnPiece("O");
    const targetX = piece.x;
    const targetRot: Rot = "right"; // O rotation not allowed
    const seqs = finesseCalculator.calculateOptimal(
      piece,
      targetX,
      targetRot,
      cfg,
    );
    expect(seqs.length).toBe(0);
  });

  test("Unreachable due to x beyond wall returns no sequences", () => {
    const piece = spawnPiece("L");
    const targetX = 9; // invalid for L spawn orientation
    const targetRot: Rot = "spawn";
    const seqs = finesseCalculator.calculateOptimal(
      piece,
      targetX,
      targetRot,
      cfg,
    );
    expect(seqs.length).toBe(0);
  });

  test("analyze: exact minimal sequence is optimal with no faults", () => {
    const piece = spawnPiece("T");
    const targetX = 0;
    const targetRot: Rot = "spawn";
    const player: Array<FinesseAction> = ["DASLeft", "HardDrop"];
    const res = finesseCalculator.analyze(
      piece,
      targetX,
      targetRot,
      player,
      cfg,
    );
    expect(res.kind).toBe("optimal");
    expect(res.playerSequence).toEqual(["DASLeft", "HardDrop"]);
  });

  test("analyze: extra inputs flagged as extra_input", () => {
    const piece = spawnPiece("T");
    const targetX = 0;
    const targetRot: Rot = "spawn";
    // Extra unnecessary rotation
    const player: Array<FinesseAction> = ["RotateCW", "DASLeft", "HardDrop"];
    const res = finesseCalculator.analyze(
      piece,
      targetX,
      targetRot,
      player,
      cfg,
    );
    expect(res.kind).toBe("faulty");
    if (res.kind === "faulty") {
      expect(res.faults.some((f: Fault) => f.type === "extra_input")).toBe(
        true,
      );
    }
  });

  test("analyze: too short sequence flagged as suboptimal_path", () => {
    const piece = spawnPiece("T");
    const targetX = 0;
    const targetRot: Rot = "spawn";
    // Missing hard drop
    const player: Array<FinesseAction> = ["DASLeft"];
    const res = finesseCalculator.analyze(
      piece,
      targetX,
      targetRot,
      player,
      cfg,
    );
    expect(res.kind).toBe("faulty");
    if (res.kind === "faulty") {
      expect(res.faults.some((f: Fault) => f.type === "suboptimal_path")).toBe(
        true,
      );
    }
  });

  test("analyze: strict normalization only accepts valid finesse KeyActions", () => {
    const piece = spawnPiece("T");
    const targetX = 0;
    const targetRot: Rot = "spawn";
    const player: Array<FinesseAction> = ["DASLeft", "HardDrop"];
    const res = finesseCalculator.analyze(
      piece,
      targetX,
      targetRot,
      player,
      cfg,
    );
    expect(res.playerSequence).toEqual(["DASLeft", "HardDrop"]);
  });
  test("Hold-right to wall is 1 input (+ HardDrop)", () => {
    const piece = spawnPiece("L"); // x=3
    const targetX = 7; // rightmost valid x for spawn L
    const targetRot: Rot = "spawn";
    const seqs = finesseCalculator.calculateOptimal(
      piece,
      targetX,
      targetRot,
      cfg,
    );
    const minLen = Math.min(...seqs.map((s) => s.length));
    expect(minLen).toBe(2);
    const one = seqs.find((s) => s.length === 2);
    assertDefined(one, "Expected to find a sequence with length 2");
    expect(one).toEqual(["DASRight", "HardDrop"]);
  });

  const pieces: Array<keyof typeof PIECES> = [
    "I",
    "J",
    "L",
    "S",
    "Z",
    "T",
    "O",
  ];
  for (const pid of pieces) {
    test(`Hold-left to wall minimal for ${pid}`, () => {
      const piece = spawnPiece(pid);
      const board = createEmptyBoard();
      const left = moveToWall(board, piece, -1);
      const seqs = finesseCalculator.calculateOptimal(
        piece,
        left.x,
        piece.rot,
        cfg,
      );
      const minLen = Math.min(...seqs.map((s) => s.length));
      expect(minLen).toBe(2);
      const one = seqs.find((s) => s.length === 2);
      assertDefined(
        one,
        `Expected to find a sequence with length 2 for ${pid}`,
      );
      expect(one[0]).toBe("DASLeft");
      expect(one[1]).toBe("HardDrop");
    });
  }

  for (const pid of ["I", "O", "T"] as const) {
    test(`Hold-right to wall minimal for ${pid}`, () => {
      const piece = spawnPiece(pid);
      const board = createEmptyBoard();
      const right = moveToWall(board, piece, 1);
      const seqs = finesseCalculator.calculateOptimal(
        piece,
        right.x,
        piece.rot,
        cfg,
      );
      const minLen = Math.min(...seqs.map((s) => s.length));
      expect(minLen).toBe(2);
      const one = seqs.find((s) => s.length === 2);
      assertDefined(
        one,
        `Expected to find a sequence with length 2 for ${pid}`,
      );
      expect(one[0]).toBe("DASRight");
      expect(one[1]).toBe("HardDrop");
    });
  }

  test("I piece: rotate vertical then hold-right to wall = 3 inputs (+ HardDrop)", () => {
    const piece = spawnPiece("I");
    const board = createEmptyBoard();
    const rot = getNextRotation(piece.rot, "CW");
    const rotated = tryRotate(piece, rot, board);
    expect(rotated).toBeDefined();
    if (!rotated) return;
    const right = moveToWall(board, rotated, 1);
    const seqs = finesseCalculator.calculateOptimal(piece, right.x, rot, cfg);
    const minLen = Math.min(...seqs.map((s) => s.length));
    expect(minLen).toBe(3); // Rotate + RightDAS + HardDrop
  });
});

describe("extractFinesseActions", () => {
  const timestamp = createTimestamp(1000);

  test("converts TapMove actions correctly", () => {
    const actions: Array<Action> = [
      MoveLeft({ timestampMs: timestamp }),
      MoveRight({ timestampMs: timestamp }),
    ];
    const result = extractFinesseActions(actions);
    expect(result).toEqual(["MoveLeft", "MoveRight"]);
  });

  test("converts Rotate actions correctly", () => {
    const actions: Array<Action> = [RotateCW(), { dir: "CCW", type: "Rotate" }];
    const result = extractFinesseActions(actions);
    expect(result).toEqual(["RotateCW", "RotateCCW"]);
  });

  test("converts HardDrop actions correctly", () => {
    const actions: Array<Action> = [HardDrop(timestamp)];
    const result = extractFinesseActions(actions);
    expect(result).toEqual(["HardDrop"]);
  });

  test("maps each hold-run action to DAS action (no coalescing)", () => {
    // Simulate a typical hold-run: HoldStart → HoldMove → RepeatMove → RepeatMove
    const actions: Array<Action> = [
      { dir: -1, timestampMs: timestamp, type: "HoldStart" },
      { dir: -1, timestampMs: timestamp, type: "HoldMove" },
      { dir: -1, timestampMs: timestamp, type: "RepeatMove" },
      { dir: -1, timestampMs: timestamp, type: "RepeatMove" },
    ];
    const result = extractFinesseActions(actions);
    // Only HoldMove maps to DASLeft, HoldStart and RepeatMove return undefined
    expect(result).toEqual(["DASLeft"]);
  });

  test("maps each right DAS action individually (no coalescing)", () => {
    const actions: Array<Action> = [
      { dir: 1, timestampMs: timestamp, type: "HoldStart" },
      { dir: 1, timestampMs: timestamp, type: "HoldMove" },
      { dir: 1, timestampMs: timestamp, type: "RepeatMove" },
    ];
    const result = extractFinesseActions(actions);
    // Only HoldMove maps to DASRight, HoldStart and RepeatMove return undefined
    expect(result).toEqual(["DASRight"]);
  });

  test("maps all hold-run actions individually with rotation", () => {
    const actions: Array<Action> = [
      // First hold-run left
      { dir: -1, timestampMs: timestamp, type: "HoldStart" },
      { dir: -1, timestampMs: timestamp, type: "HoldMove" },
      { dir: -1, timestampMs: timestamp, type: "RepeatMove" },
      // Rotation in between
      { dir: "CW", type: "Rotate" },
      // Second hold-run right
      { dir: 1, timestampMs: timestamp, type: "HoldStart" },
      { dir: 1, timestampMs: timestamp, type: "HoldMove" },
      { dir: 1, timestampMs: timestamp, type: "RepeatMove" },
      { dir: 1, timestampMs: timestamp, type: "RepeatMove" },
    ];
    const result = extractFinesseActions(actions);
    // Only HoldMove maps to DAS, HoldStart and RepeatMove return undefined
    expect(result).toEqual(["DASLeft", "RotateCW", "DASRight"]);
  });

  test("handles mixed sequence with taps and holds", () => {
    const actions: Array<Action> = [
      { dir: -1, optimistic: false, timestampMs: timestamp, type: "TapMove" },
      { dir: -1, optimistic: false, timestampMs: timestamp, type: "TapMove" },
      { dir: "CW", type: "Rotate" },
      { dir: 1, timestampMs: timestamp, type: "HoldStart" },
      { dir: 1, timestampMs: timestamp, type: "HoldMove" },
      { dir: 1, timestampMs: timestamp, type: "RepeatMove" },
      { timestampMs: timestamp, type: "HardDrop" },
    ];
    const result = extractFinesseActions(actions);
    // Only HoldMove maps to DAS, HoldStart and RepeatMove return undefined
    expect(result).toEqual([
      "MoveLeft",
      "MoveLeft",
      "RotateCW",
      "DASRight",
      "HardDrop",
    ]);
  });

  test("ignores irrelevant action types", () => {
    const actions: Array<Action> = [
      { dir: -1, optimistic: false, timestampMs: timestamp, type: "TapMove" },
      { timestampMs: timestamp, type: "Tick" },
      createTestSpawnAction(),
      { dir: "CW", type: "Rotate" },
    ];
    const result = extractFinesseActions(actions);
    expect(result).toEqual(["MoveLeft", "RotateCW"]);
  });

  test("handles empty action list", () => {
    const actions: Array<Action> = [];
    const result = extractFinesseActions(actions);
    expect(result).toEqual([]);
  });

  test("handles direction switching within DAS sequence", () => {
    // This shouldn't happen in normal gameplay, but tests edge case
    const actions: Array<Action> = [
      { dir: -1, timestampMs: timestamp, type: "HoldStart" },
      { dir: -1, timestampMs: timestamp, type: "HoldMove" },
      { dir: 1, timestampMs: timestamp, type: "HoldStart" }, // Direction switch
      { dir: 1, timestampMs: timestamp, type: "HoldMove" },
      { dir: 1, timestampMs: timestamp, type: "RepeatMove" },
    ];
    const result = extractFinesseActions(actions);
    // Only HoldMove maps to DAS, HoldStart and RepeatMove return undefined
    expect(result).toEqual(["DASLeft", "DASRight"]);
  });

  test("maps long sequences of repeats individually (no coalescing)", () => {
    const actions: Array<Action> = [
      { dir: -1, timestampMs: timestamp, type: "HoldStart" },
      { dir: -1, timestampMs: timestamp, type: "HoldMove" },
      ...Array(10)
        .fill(0)
        .map(() => ({
          dir: -1 as const,
          timestampMs: timestamp,
          type: "RepeatMove" as const,
        })),
    ];
    const result = extractFinesseActions(actions);
    // Should be 1 DASLeft action (only HoldMove counts, HoldStart and RepeatMove return undefined)
    expect(result).toEqual(Array(1).fill("DASLeft"));
  });

  test("handles invalid direction TapMove (should be filtered out)", () => {
    const actions: Array<Action> = [
      { dir: -1, optimistic: false, timestampMs: timestamp, type: "TapMove" },
      // No invalid direction test since TypeScript prevents it
      { dir: 1, optimistic: false, timestampMs: timestamp, type: "TapMove" },
    ];
    const result = extractFinesseActions(actions);
    expect(result).toEqual(["MoveLeft", "MoveRight"]);
  });

  test("filters out optimistic TapMove when followed by HoldStart in same direction", () => {
    const actions: Array<Action> = [
      MoveLeft({ optimistic: true, timestampMs: timestamp }), // Optimistic move
      HoldStartLeft({ timestampMs: timestamp }), // Hold start - should filter out optimistic
      HoldMoveLeft({ timestampMs: createTimestamp(timestamp + 167) }), // Hold move
    ];
    const result = extractFinesseActions(actions);
    // Should only see DASLeft (optimistic TapMove filtered out)
    expect(result).toEqual(["DASLeft"]);
  });

  test("keeps TapMove when HoldStart is in different direction", () => {
    const actions: Array<Action> = [
      MoveLeft({ timestampMs: timestamp }), // Left tap (non-optimistic by default)
      HoldStartRight({ timestampMs: createTimestamp(timestamp + 100) }), // Right hold start
      HoldMoveRight({ timestampMs: createTimestamp(timestamp + 267) }), // Right hold move
    ];
    const result = extractFinesseActions(actions);
    // Should see both MoveLeft and DASRight
    expect(result).toEqual(["MoveLeft", "DASRight"]);
  });

  test("keeps TapMove when no following HoldStart", () => {
    const actions: Array<Action> = [
      MoveLeft({ timestampMs: timestamp }), // Just a tap, no hold
    ];
    const result = extractFinesseActions(actions);
    // Should see MoveLeft (no HoldStart to filter it out)
    expect(result).toEqual(["MoveLeft"]);
  });

  test("keeps non-optimistic TapMove even when followed by DAS in same direction", () => {
    const actions: Array<Action> = [
      MoveLeft({ timestampMs: timestamp }), // Real tap (not optimistic, default)
      HoldStartLeft({ timestampMs: createTimestamp(timestamp + 100) }), // Separate hold start
      HoldMoveLeft({ timestampMs: createTimestamp(timestamp + 267) }), // Hold move
    ];
    const result = extractFinesseActions(actions);
    // Should see both MoveLeft and DASLeft (tap + separate DAS)
    expect(result).toEqual(["MoveLeft", "DASLeft"]);
  });
});
