import fs from "node:fs";
import path from "node:path";

import { createActivePiece } from "../../src/core/spawning";
import { finesseCalculator } from "../../src/finesse/calculator";
import { generateCards } from "../../src/modes/guided/deck";
import { createDurationMs } from "../../src/types/brands";

import type { GameplayConfig } from "../../src/state/types";

describe("Guided finesse table generator", () => {
  it("writes guided_finesse_table.json and guided_finesse_table.csv under ./generated", () => {
    const cards = generateCards();

    const gameplayConfig: GameplayConfig = {
      finesseCancelMs: createDurationMs(50),
      holdEnabled: false,
    };

    type Row = {
      piece: string;
      x: number;
      rot: string;
      sequence: ReadonlyArray<string> | null;
    };

    const rows: Array<Row> = [];

    for (const card of cards) {
      const start = createActivePiece(card.piece);
      const sequence = finesseCalculator.calculateOptimal(
        start,
        card.x as number,
        card.rot,
        gameplayConfig,
      );

      rows.push({
        piece: card.piece,
        rot: card.rot,
        sequence,
        x: card.x as number,
      });
    }

    const outDir = path.join(process.cwd(), "generated");
    fs.mkdirSync(outDir, { recursive: true });

    // JSON output (unchanged shape aside from 'sequence')
    const jsonPath = path.join(outDir, "guided_finesse_table.json");
    fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2), "utf8");

    // CSV output (new)
    const csvPath = path.join(outDir, "guided_finesse_table.csv");
    fs.writeFileSync(csvPath, toCsv(rows), "utf8");

    expect(rows.length).toBeGreaterThan(0);
  });
});

/**
 * Convert rows to CSV. Columns:
 * piece,x,rot,sequences
 * `sequences` is JSON-stringified to preserve structure.
 */
function toCsv(
  rows: Array<{
    piece: string;
    x: number;
    rot: string;
    sequence: ReadonlyArray<string> | null;
  }>,
): string {
  const headers = ["piece", "x", "rot", "sequences"];
  const lines = [headers.join(",")];

  for (const row of rows) {
    const fields = [
      row.piece,
      String(row.x),
      row.rot,
      JSON.stringify(row.sequence),
    ].map(escapeCsvField);

    lines.push(fields.join(","));
  }

  // Use '\n' for cross-platform friendliness; most CSV readers accept it.
  return `${lines.join("\n")}\n`;
}

/**
 * RFC 4180-ish CSV escaping: wrap in double quotes if needed and
 * double any existing double quotes.
 */
function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
