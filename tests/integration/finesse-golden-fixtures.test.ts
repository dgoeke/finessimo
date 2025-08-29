import * as fs from "fs";
import * as path from "path";

import { PIECES } from "../../src/core/pieces";
import { finesseCalculator } from "../../src/finesse/calculator";
import { createDurationMs, createGridCoord } from "../../src/types/brands";

import type { ActivePiece, GameplayConfig, Rot } from "../../src/state/types";

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

type GoldenEntry = {
  piece: keyof typeof PIECES;
  targetX: number;
  targetRot: Rot;
  expectedLen: number;
  first?: string;
};

describe("Finesse golden fixtures", () => {
  const fixturesPath = path.join(
    __dirname,
    "..",
    "fixtures",
    "finesse_golden.json",
  );
  const raw = fs.readFileSync(fixturesPath, "utf-8");
  const cases = JSON.parse(raw) as Array<GoldenEntry>;

  for (const c of cases) {
    test(`${c.piece} -> x=${String(c.targetX)}, rot=${c.targetRot} expects ${String(c.expectedLen)}`, () => {
      const piece = spawnPiece(c.piece);
      const seqs = finesseCalculator.calculateOptimal(
        piece,
        c.targetX,
        c.targetRot,
        cfg,
      );
      if (c.expectedLen === 0) {
        expect(seqs.length).toBe(0);
        return;
      }
      expect(seqs.length).toBeGreaterThan(0);
      const minLen = Math.min(...seqs.map((s) => s.length));
      expect(minLen).toBe(c.expectedLen);
      // Ensure HardDrop present in minimal sequence
      const one = seqs.find((s) => s.length === c.expectedLen);
      expect(one).toBeDefined();
      if (!one) return;
      expect(one[one.length - 1]).toBe("HardDrop");
      if (c.first !== undefined && c.first !== "") {
        expect(one[0]).toBe(c.first);
      }
    });
  }
});
