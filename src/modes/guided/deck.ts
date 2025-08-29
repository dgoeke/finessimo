import { PIECES } from "../../core/pieces";
import { makeDeck } from "../../srs/fsrs-adapter";
import { createTimestamp, type Timestamp } from "../../types/timestamp";

import { createColumn, type Column, createCardId, type CardId } from "./types";

import type { GuidedCard, SrsDeck } from "../../srs/fsrs-adapter";
import type { PieceId, Rot } from "../../state/types";

// Rotation equivalence classes to avoid visual duplicates
export const ROTATION_CLASSES: Record<PieceId, ReadonlyArray<Rot>> = {
  I: ["spawn", "left"], // spawn≡two, left≡right (but different positions)
  J: ["spawn", "right", "two", "left"], // All unique
  L: ["spawn", "right", "two", "left"], // All unique
  O: ["spawn"], // All rotations identical
  S: ["spawn", "left"], // spawn≡two, left≡right (visual symmetry)
  T: ["spawn", "right", "two", "left"], // All unique
  Z: ["spawn", "left"], // spawn≡two, left≡right (visual symmetry)
};

export function validColumns(piece: PieceId, rot: Rot): ReadonlyArray<Column> {
  const shape = PIECES[piece];
  const cells = shape.cells[rot];

  // Compute bounding box of the piece
  let minDx = Number.POSITIVE_INFINITY;
  let maxDx = Number.NEGATIVE_INFINITY;
  for (const [dx] of cells) {
    if (dx < minDx) minDx = dx;
    if (dx > maxDx) maxDx = dx;
  }

  // Compute legal piece.x bounds so that all absolute cells (x + dx) are in [0,9]
  // piece.x must satisfy: 0 <= x + minDx and x + maxDx <= 9
  // This gives us: x >= -minDx and x <= 9 - maxDx
  const minStart = -minDx; // piece.x can be negative if needed for left wall placement
  const maxStart = 9 - maxDx; // rightmost cells can't exceed board width

  const result: Array<Column> = [];
  for (let x = minStart; x <= maxStart; x++) {
    result.push(createColumn(x));
  }
  return result;
}

export function generateCards(): ReadonlyArray<GuidedCard> {
  const pieces: ReadonlyArray<PieceId> = ["I", "O", "T", "S", "Z", "J", "L"];
  const cards: Array<GuidedCard> = [];

  for (const p of pieces) {
    // Use only representative rotations from each equivalence class
    const representativeRotations = ROTATION_CLASSES[p];

    for (const r of representativeRotations) {
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
