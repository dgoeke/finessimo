// src/modes/guided/cards.ts
import type { ActivePiece, FinesseAction } from "../../state/types";
import type { Timestamp } from "../../types/timestamp";

export type GuidedCardVM = Readonly<{
  attemptId: number; // stable key for DOM
  piece: ActivePiece["id"];
  targetPiece: ActivePiece; // bottomed position for the mini-board render
  optimalSequences: ReadonlyArray<ReadonlyArray<FinesseAction>>;
  playerSequence: ReadonlyArray<FinesseAction>; // live while active, final on lock
  rating?: "again" | "hard" | "good" | "easy";
  spawnedAt: Timestamp; // when the active piece spawned
}>;

export type GuidedStackData = Readonly<{
  cards: ReadonlyArray<GuidedCardVM>;
  activeCard?: GuidedCardVM;
}>;

export function isGuidedStackData(u: unknown): u is GuidedStackData {
  if (u === null || typeof u !== "object") return false;
  const o = u as Record<string, unknown>;
  return Array.isArray(o["cards"]);
}

export function startActiveCard(
  data: GuidedStackData | undefined,
  card: Omit<GuidedCardVM, "playerSequence" | "rating">,
): GuidedStackData {
  return {
    activeCard: { ...card, playerSequence: [] },
    // keep at most 2 finalized cards when a new active card appears
    cards: (data?.cards ?? []).slice(0, 2),
  };
}

export function updateActivePlayerSequence(
  data: GuidedStackData | undefined,
  seq: ReadonlyArray<FinesseAction>,
): GuidedStackData {
  const active = data?.activeCard;
  if (!active) return { cards: data?.cards ?? [] };
  return { ...data, activeCard: { ...active, playerSequence: seq } };
}

export function finalizeActiveCard(
  data: GuidedStackData | undefined,
  rating: NonNullable<GuidedCardVM["rating"]>,
  finalSeq: ReadonlyArray<FinesseAction>,
): GuidedStackData {
  const active = data?.activeCard;
  const prev = data?.cards ?? [];
  if (!active) return { cards: prev.slice(0, 3) };
  const finalized: GuidedCardVM = {
    ...active,
    playerSequence: finalSeq,
    rating,
  };
  return { cards: [finalized, ...prev].slice(0, 3) };
}
