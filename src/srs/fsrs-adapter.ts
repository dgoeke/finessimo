import {
  FSRS,
  Rating as FsrsRating,
  generatorParameters,
  createEmptyCard,
  type Card as FsrsCard,
  type CardInput,
  TypeConvert,
} from "ts-fsrs";
// TypeConvert is included in the import above

import {
  type CardId,
  type DeckId,
  createCardId,
  createDeckId,
  type Column,
} from "../modes/guided/types";
import { createTimestamp, type Timestamp } from "../types/timestamp";

import type { PieceId, Rot } from "../state/types";

// Adapter types deliberately narrow and branded. This module currently
// implements a deterministic, simplified scheduling compatible with FSRS-style
// usage. It is designed to be replaced with the official 'ts-fsrs' integration
// without changing the public surface.

const ratingMap = {
  again: FsrsRating.Again,
  easy: FsrsRating.Easy,
  good: FsrsRating.Good,
  hard: FsrsRating.Hard,
} satisfies Record<Rating, FsrsRating>;

export type GuidedCard = Readonly<{
  piece: PieceId;
  rot: Rot;
  x: Column;
}>;

export type FsrsSnapshot = Readonly<{ card: CardInput }>;

export type SrsRecord = Readonly<{
  key: CardId;
  card: GuidedCard;
  fsrs: FsrsSnapshot;
  due: Timestamp; // monotonic counter used as timestamp units
}>;

export type SrsDeck = Readonly<{
  id: DeckId;
  items: ReadonlyMap<CardId, SrsRecord>;
  params: Readonly<{ maxNewPerSession: number }>;
}>;

export type Rating = "again" | "hard" | "good" | "easy";

export function canonicalId(card: GuidedCard): CardId {
  return createCardId(`${card.piece}:${card.rot}:${String(card.x as number)}`);
}

function toSnapshot(card: FsrsCard): FsrsSnapshot {
  const clone = JSON.parse(JSON.stringify(card)) as CardInput;
  return { card: clone } as const;
}
function fromSnapshot(s: FsrsSnapshot): FsrsCard {
  return TypeConvert.card(s.card);
}

function createScheduler(): FSRS {
  const params = generatorParameters({ enable_fuzz: false });
  return new FSRS(params);
}

export function initRecord(card: GuidedCard, now: Timestamp): SrsRecord {
  const key = canonicalId(card);
  const fsrsCard = createEmptyCard(new Date(now as number));
  const fsrs = toSnapshot(fsrsCard);
  return {
    card,
    due: createTimestamp(fsrsCard.due.getTime()),
    fsrs,
    key,
  } as const;
}

export function rate(
  rec: SrsRecord,
  rating: Rating,
  now: Timestamp,
): SrsRecord {
  const scheduler = createScheduler();
  const current = fromSnapshot(rec.fsrs);
  const grade = ratingMap[rating];
  const rl = scheduler.next(current, new Date(now as number), grade);
  const nextCard = rl.card;
  const newDue = createTimestamp(nextCard.due.getTime());
  return { ...rec, due: newDue, fsrs: toSnapshot(nextCard) };
}

export function isDue(rec: SrsRecord, now: Timestamp): boolean {
  return (rec.due as number) <= (now as number);
}

export function makeDeck(
  id: string,
  items: ReadonlyArray<GuidedCard>,
  now: Timestamp,
  params: Readonly<{ maxNewPerSession: number }> = { maxNewPerSession: 50 },
): SrsDeck {
  const map = new Map<CardId, SrsRecord>();
  for (let i = 0; i < items.length; i++) {
    const card = items[i];
    if (!card) continue;
    // Assign slightly increasing timestamps to preserve the ordering from items array
    // This ensures cards are presented in the intended difficulty order
    const cardTimestamp = createTimestamp((now as number) + i);
    const rec = initRecord(card, cardTimestamp);
    map.set(rec.key, rec);
  }
  return {
    id: createDeckId(id),
    items: map,
    params,
  } as const;
}

export function updateDeckRecord(deck: SrsDeck, rec: SrsRecord): SrsDeck {
  const map = new Map(deck.items);
  map.set(rec.key, rec);
  return { ...deck, items: map };
}

export function pickNextDue(deck: SrsDeck, now: Timestamp): SrsRecord | null {
  let best: SrsRecord | null = null;
  let bestKey = "";
  for (const [key, rec] of deck.items) {
    if (best === null) {
      best = rec;
      bestKey = key as string;
      continue;
    }
    const recDue = rec.due as number;
    const bestDue = best.due as number;
    const recIsDue = recDue <= (now as number);
    const bestIsDue = bestDue <= (now as number);

    let replace = false;
    if (recIsDue !== bestIsDue) {
      replace = recIsDue;
    } else if (recDue !== bestDue) {
      replace = recDue < bestDue;
    } else {
      replace = (key as string) < bestKey;
    }

    if (replace) {
      best = rec;
      bestKey = key as string;
    }
  }
  return best;
}

// Persistence helpers (JSON-friendly)
export type PersistedGuidedV1 = Readonly<{
  version: 1;
  deck: {
    id: string;
    params: { maxNewPerSession: number };
    items: Record<
      string,
      { card: GuidedCard; fsrs: FsrsSnapshot; due: number }
    >;
  };
}>;

export function serialize(deck: SrsDeck): PersistedGuidedV1 {
  const items: Record<
    string,
    { card: GuidedCard; fsrs: FsrsSnapshot; due: number }
  > = {};
  for (const [key, rec] of deck.items) {
    items[key as string] = {
      card: rec.card,
      due: rec.due as number,
      fsrs: rec.fsrs,
    };
  }
  return {
    deck: { id: deck.id as string, items, params: deck.params },
    version: 1,
  } as const;
}

export function deserialize(p: PersistedGuidedV1): SrsDeck {
  const map = new Map<CardId, SrsRecord>();
  for (const [key, item] of Object.entries(p.deck.items)) {
    const rec: SrsRecord = {
      card: item.card,
      due: createTimestamp(item.due),
      fsrs: item.fsrs,
      key: createCardId(key),
    } as const;
    map.set(rec.key, rec);
  }
  return {
    id: createDeckId(p.deck.id),
    items: map,
    params: p.deck.params,
  } as const;
}
