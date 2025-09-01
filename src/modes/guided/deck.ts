import { PIECES } from "../../core/pieces";
import { createActivePiece } from "../../core/spawning";
import { finesseCalculator } from "../../finesse/calculator";
import { makeDeck } from "../../srs/fsrs-adapter";
import { createDurationMs } from "../../types/brands";
import { createTimestamp, type Timestamp } from "../../types/timestamp";

import { createColumn, type Column, createCardId, type CardId } from "./types";

import type { GuidedCard, SrsDeck } from "../../srs/fsrs-adapter";
import type { GameplayConfig, PieceId, Rot } from "../../state/types";

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

  return orderCardsByDifficulty(cards);
}

/**
 * Orders cards by difficulty using the algorithm specified:
 * 1. Group cards by piece
 * 2. Sort each group by optimal sequence length (easiest first)
 * 3. Round-robin across groups until all cards are selected
 */
function orderCardsByDifficulty(
  cards: ReadonlyArray<GuidedCard>,
): ReadonlyArray<GuidedCard> {
  // Step 1: Calculate optimal sequence length for each card
  const gameplayConfig: GameplayConfig = {
    finesseCancelMs: createDurationMs(50),
    holdEnabled: false,
  };

  type CardWithDifficulty = GuidedCard & { minSequenceLength: number };

  const cardsWithDifficulty: Array<CardWithDifficulty> = cards.map((card) => {
    const activePiece = createActivePiece(card.piece);
    const sequence = finesseCalculator.calculateOptimal(
      activePiece,
      card.x as number,
      card.rot,
      gameplayConfig,
    );

    // Calculate minimum sequence length (difficulty metric)
    const minSequenceLength = sequence
      ? sequence.length
      : Number.POSITIVE_INFINITY;

    return { ...card, minSequenceLength };
  });

  // Step 2: Group by piece and sort each group by difficulty
  const groupsByPiece = groupAndSortCardsByPiece(cardsWithDifficulty);

  // Step 3: Round-robin selection across groups
  return roundRobinSelectCards(groupsByPiece, cards.length);
}

/**
 * Groups cards by piece and sorts each group by difficulty (easiest first)
 */
function groupAndSortCardsByPiece(
  cardsWithDifficulty: Array<GuidedCard & { minSequenceLength: number }>,
): Map<PieceId, Array<GuidedCard & { minSequenceLength: number }>> {
  const groupsByPiece = new Map<
    PieceId,
    Array<GuidedCard & { minSequenceLength: number }>
  >();

  for (const card of cardsWithDifficulty) {
    const existingGroup = groupsByPiece.get(card.piece);
    if (existingGroup) {
      existingGroup.push(card);
    } else {
      groupsByPiece.set(card.piece, [card]);
    }
  }

  // Sort each group by difficulty (easiest first)
  for (const group of groupsByPiece.values()) {
    group.sort((a, b) => a.minSequenceLength - b.minSequenceLength);
  }

  return groupsByPiece;
}

/**
 * Performs round-robin selection across groups
 */
function roundRobinSelectCards(
  groupsByPiece: Map<
    PieceId,
    Array<GuidedCard & { minSequenceLength: number }>
  >,
  totalCards: number,
): Array<GuidedCard> {
  const result: Array<GuidedCard> = [];
  const groups = Array.from(groupsByPiece.values());
  const indices = new Array<number>(groups.length).fill(0);

  while (result.length < totalCards) {
    const addedThisRound = tryAddOneFromEachGroup(groups, indices, result);

    // Safety check to avoid infinite loop
    if (!addedThisRound) {
      break;
    }
  }

  return result;
}

/**
 * Attempts to add one card from each group in the current round
 */
function tryAddOneFromEachGroup(
  groups: Array<Array<GuidedCard & { minSequenceLength: number }>>,
  indices: Array<number>,
  result: Array<GuidedCard>,
): boolean {
  let addedThisRound = false;

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const index = indices[i];

    if (group && typeof index === "number" && index < group.length) {
      const cardWithDifficulty = group[index] as GuidedCard & {
        minSequenceLength: number;
      };
      // Drop the difficulty metric while preserving GuidedCard fields
      result.push({
        piece: cardWithDifficulty.piece,
        rot: cardWithDifficulty.rot,
        x: cardWithDifficulty.x,
      });
      indices[i] = index + 1;
      addedThisRound = true;
    }
  }

  return addedThisRound;
}

export function makeDefaultDeck(now: Timestamp = createTimestamp(0)): SrsDeck {
  const cards = generateCards();
  return makeDeck("guided-default", cards, now);
}

export function keyOf(p: GuidedCard): CardId {
  return createCardId(`${p.piece}:${p.rot}:${String(p.x as number)}`);
}
