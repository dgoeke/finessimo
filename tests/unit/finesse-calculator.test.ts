import { finesseCalculator } from "../../src/finesse/calculator";
import { PIECES } from "../../src/core/pieces";
import { createEmptyBoard, moveToWall } from "../../src/core/board";
import { getNextRotation, tryRotate } from "../../src/core/srs";
import type {
  ActivePiece,
  GameplayConfig,
  Rot,
  KeyAction,
} from "../../src/state/types";
import { assertDefined } from "../test-helpers";

const cfg: GameplayConfig = { finesseCancelMs: 50 };

function spawnPiece(id: keyof typeof PIECES): ActivePiece {
  const topLeft = PIECES[id].spawnTopLeft;
  return { id, rot: "spawn", x: topLeft[0], y: topLeft[1] };
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
    // Minimal should be exactly 2 inputs: LeftDown + HardDrop
    const minLen = Math.min(...seqs.map((s) => s.length));
    expect(minLen).toBe(2);
    const one = seqs.find((s) => s.length === 2);
    expect(one).toBeDefined();
    if (!one) return;
    expect(one).toEqual(["LeftDown", "HardDrop"]);
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
    expect(opt[0]).toBe("LeftDown");
    expect(opt[1]).toBe("LeftDown");
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
    const player: KeyAction[] = ["LeftDown", "HardDrop"];
    const res = finesseCalculator.analyze(
      piece,
      targetX,
      targetRot,
      player,
      cfg,
    );
    expect(res.isOptimal).toBe(true);
    expect(res.faults.length).toBe(0);
    expect(res.playerSequence).toEqual(["LeftDown", "HardDrop"]);
  });

  test("analyze: extra inputs flagged as extra_input", () => {
    const piece = spawnPiece("T");
    const targetX = 0;
    const targetRot: Rot = "spawn";
    // Extra unnecessary rotation
    const player: KeyAction[] = ["RotateCW", "LeftDown", "HardDrop"];
    const res = finesseCalculator.analyze(
      piece,
      targetX,
      targetRot,
      player,
      cfg,
    );
    expect(res.isOptimal).toBe(false);
    expect(res.faults.some((f) => f.type === "extra_input")).toBe(true);
  });

  test("analyze: too short sequence flagged as suboptimal_path", () => {
    const piece = spawnPiece("T");
    const targetX = 0;
    const targetRot: Rot = "spawn";
    // Missing hard drop
    const player: KeyAction[] = ["LeftDown"];
    const res = finesseCalculator.analyze(
      piece,
      targetX,
      targetRot,
      player,
      cfg,
    );
    expect(res.isOptimal).toBe(false);
    expect(res.faults.some((f) => f.type === "suboptimal_path")).toBe(true);
  });

  test("analyze: normalization filters release events", () => {
    const piece = spawnPiece("T");
    const targetX = 0;
    const targetRot: Rot = "spawn";
    const player: KeyAction[] = [
      "LeftDown",
      "LeftUp",
      "RightUp",
      "SoftDropUp",
      "HardDrop",
    ];
    const res = finesseCalculator.analyze(
      piece,
      targetX,
      targetRot,
      player,
      cfg,
    );
    expect(res.playerSequence).toEqual(["LeftDown", "HardDrop"]);
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
    expect(one).toEqual(["RightDown", "HardDrop"]);
  });

  const pieces: (keyof typeof PIECES)[] = ["I", "J", "L", "S", "Z", "T", "O"];
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
      expect(one[0]).toBe("LeftDown");
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
      expect(one[0]).toBe("RightDown");
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
    expect(minLen).toBe(3); // Rotate + RightDown + HardDrop
  });
});
