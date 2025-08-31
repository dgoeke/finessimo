import {
  makeDefaultDeck,
  validColumns,
  ROTATION_CLASSES,
} from "../modes/guided/deck";

import {
  deserialize,
  serialize,
  type PersistedGuidedV1,
  type SrsDeck,
} from "./fsrs-adapter";

import type { Timestamp } from "../types/timestamp";

function sanitizeDeck(deck: SrsDeck): SrsDeck {
  const filtered = new Map(deck.items);
  let removed = 0;
  for (const [key, rec] of deck.items) {
    // 1) Column must be legal for the piece+rot
    const columnAllowed = validColumns(rec.card.piece, rec.card.rot).some(
      (c) => (c as unknown as number) === (rec.card.x as unknown as number),
    );
    // 2) Rotation must be one of the representative rotations for this piece
    const allowedRots = ROTATION_CLASSES[rec.card.piece];
    const rotAllowed = allowedRots.includes(rec.card.rot);

    if (!columnAllowed || !rotAllowed) {
      filtered.delete(key);
      removed++;
    }
  }
  if (removed > 0) {
    // Recreate deck with filtered items
    return { ...deck, items: filtered };
  }
  return deck;
}

const STORAGE_KEY = "finessimo/guided/fsrs/v1" as const;

function isObject(u: unknown): u is Record<string, unknown> {
  return typeof u === "object" && u !== null;
}

function migrate(u: unknown): PersistedGuidedV1 | null {
  if (!isObject(u)) return null;
  const v = (u as { version?: unknown }).version;
  if (v === 1) return u as PersistedGuidedV1;
  return null;
}

export function loadGuidedDeck(now: Timestamp): SrsDeck {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null || raw === "") return makeDefaultDeck(now);
    const parsed = JSON.parse(raw) as unknown;
    const v1 = migrate(parsed);
    if (!v1) return makeDefaultDeck(now);
    const deck = deserialize(v1);
    return sanitizeDeck(deck);
  } catch {
    return makeDefaultDeck(now);
  }
}

export function saveGuidedDeck(deck: SrsDeck): void {
  try {
    const data = serialize(deck);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore storage errors
  }
}
