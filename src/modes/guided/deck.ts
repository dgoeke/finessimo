import { PIECES } from "../../core/pieces";
import { makeDeck } from "../../srs/fsrs-adapter";
import { createTimestamp, type Timestamp } from "../../types/timestamp";

import { createColumn, type Column, createCardId, type CardId } from "./types";

import type { GuidedCard, SrsDeck } from "../../srs/fsrs-adapter";
import type { PieceId, Rot } from "../../state/types";

export function validColumns(piece: PieceId, rot: Rot): ReadonlyArray<Column> {
  const shape = PIECES[piece];
  const cells = shape.cells[rot];
  // Compute min/max x offset just in case
  let minDx = Number.POSITIVE_INFINITY;
  let maxDx = Number.NEGATIVE_INFINITY;
  for (const [dx] of cells) {
    if (dx < minDx) minDx = dx;
    if (dx > maxDx) maxDx = dx;
  }
  // Compute legal piece.x bounds so that all absolute cells (x + dx) are in [0,9]
  // piece.x must satisfy: 0 <= x + minDx and x + maxDx <= 9
  // Since Column is clamped to [0,9], the effective bounds are [0, 9 - maxDx]
  const maxStart = 9 - maxDx; // inclusive upper bound
  const result: Array<Column> = [];
  for (let x = 0; x <= maxStart; x++) {
    result.push(createColumn(x));
  }
  return result;
}

export function generateCards(): ReadonlyArray<GuidedCard> {
  const pieces: ReadonlyArray<PieceId> = ["I", "O", "T", "S", "Z", "J", "L"];
  const rots: ReadonlyArray<Rot> = ["spawn", "right", "two", "left"];
  const cards: Array<GuidedCard> = [];
  for (const p of pieces) {
    for (const r of rots) {
      // Collapse O rotations to spawn
      if (p === "O" && r !== "spawn") continue;
      for (const x of validColumns(p, r)) {
        cards.push({ piece: p, rot: r, x });
      }
    }
  }
  return cards;
}

export function makeDefaultDeck(now: Timestamp = createTimestamp(0)): SrsDeck {
  const cards = generateCards();
  return makeDeck("guided-default", cards, now);
}

export function keyOf(p: GuidedCard): CardId {
  return createCardId(`${p.piece}:${p.rot}:${String(p.x as number)}`);
}
