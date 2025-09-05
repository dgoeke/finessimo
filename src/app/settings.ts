// Settings persistence: load/save + (private) serialization helpers
// Concerned only with LocalStorage shape and conversion to/from UI-facing GameSettings

import { durationMsAsNumber } from "../types/brands";

import type { KeyBindings } from "../input/keyboard/bindings";
import type { GameState } from "../state/types";
import type { GameSettings } from "../ui/types/settings";

const STORAGE_KEY = "finessimo" as const;

type SerializedTiming = Partial<{
  tickHz: 60;
  dasMs: number;
  arrMs: number;
  softDrop: number | "infinite";
  lockDelayMs: number;
  lockDelayMaxResets: number;
  lineClearDelayMs: number;
  gravityEnabled: boolean;
  gravityMs: number;
}>;

type SerializedGameplay = Partial<{
  finesseCancelMs: number;
  ghostPieceEnabled: boolean;
  guidedColumnHighlightEnabled: boolean;
  nextPieceCount: number;
  holdEnabled: boolean;
  finesseFeedbackEnabled: boolean;
  finesseBoopEnabled: boolean;
  retryOnFinesseError: boolean;
}>;

type PersistedStore = Partial<{
  timing: SerializedTiming;
  gameplay: SerializedGameplay;
  mode: string;
  keyBindings: KeyBindings;
}>;

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function isNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function isBoolean(x: unknown): x is boolean {
  return typeof x === "boolean";
}

function isString(x: unknown): x is string {
  return typeof x === "string";
}

function coerceMode(u: unknown): "freePlay" | "guided" | undefined {
  if (!isString(u)) return undefined;
  if (u === "freePlay" || u === "guided") return u;
  if (u === "freeplay") return "freePlay"; // tolerate legacy casing
  return undefined;
}

function getExistingStoreOrEmpty(): PersistedStore & Record<string, unknown> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed)
      ? (parsed as PersistedStore & Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

// Flatten from persisted store (nested or flat) to UI-facing GameSettings partial
export function loadSettings(): Partial<GameSettings> {
  try {
    const store = getExistingStoreOrEmpty();
    const nested = extractFromNested(store);
    if (Object.keys(nested).length > 0) return nested;
    return extractFromFlat(store as Record<string, unknown>);
  } catch {
    return {};
  }
}

function extractFromNested(store: PersistedStore): Partial<GameSettings> {
  const out: Partial<GameSettings> = {};
  const t = isRecord(store.timing)
    ? (store.timing as Record<string, unknown>)
    : {};
  const g = isRecord(store.gameplay)
    ? (store.gameplay as Record<string, unknown>)
    : {};
  extractTimingNested(t, out);
  extractGameplayNested(g, out);
  const mode = coerceMode(store.mode);
  if (mode !== undefined) out.mode = mode;
  return out;
}

function extractTimingNested(
  t: Record<string, unknown>,
  out: Partial<GameSettings>,
): void {
  for (const k of [
    "dasMs",
    "arrMs",
    "lockDelayMs",
    "lineClearDelayMs",
    "gravityMs",
  ] as const) {
    const v = t[k];
    if (isNumber(v)) (out as Record<string, unknown>)[k] = v;
  }
  for (const k of ["gravityEnabled"] as const) {
    const v = t[k];
    if (isBoolean(v)) (out as Record<string, unknown>)[k] = v;
  }
  const sd = t["softDrop"];
  if (sd === "infinite" || isNumber(sd)) out.softDrop = sd;
}

function extractGameplayNested(
  g: Record<string, unknown>,
  out: Partial<GameSettings>,
): void {
  for (const k of ["finesseCancelMs", "nextPieceCount"] as const) {
    const v = g[k];
    if (isNumber(v)) (out as Record<string, unknown>)[k] = v;
  }
  for (const k of [
    "ghostPieceEnabled",
    "guidedColumnHighlightEnabled",
    "finesseFeedbackEnabled",
    "finesseBoopEnabled",
    "retryOnFinesseError",
  ] as const) {
    const v = g[k];
    if (isBoolean(v)) (out as Record<string, unknown>)[k] = v;
  }
}

function extractFromFlat(
  store: Record<string, unknown>,
): Partial<GameSettings> {
  const out: Partial<GameSettings> = {};
  for (const k of [
    "dasMs",
    "arrMs",
    "lockDelayMs",
    "lineClearDelayMs",
    "gravityMs",
  ] as const) {
    const v = store[k];
    if (isNumber(v)) (out as Record<string, unknown>)[k] = v;
  }
  for (const k of ["gravityEnabled"] as const) {
    const v = store[k];
    if (isBoolean(v)) (out as Record<string, unknown>)[k] = v;
  }
  const sd = store["softDrop"];
  if (sd === "infinite" || isNumber(sd)) out.softDrop = sd;

  for (const k of ["finesseCancelMs", "nextPieceCount"] as const) {
    const v = store[k];
    if (isNumber(v)) (out as Record<string, unknown>)[k] = v;
  }
  for (const k of [
    "ghostPieceEnabled",
    "guidedColumnHighlightEnabled",
    "finesseFeedbackEnabled",
    "finesseBoopEnabled",
    "retryOnFinesseError",
  ] as const) {
    const v = store[k];
    if (isBoolean(v)) (out as Record<string, unknown>)[k] = v;
  }

  const flatMode = coerceMode(store["mode"]);
  if (flatMode !== undefined) out.mode = flatMode;
  return out;
}

// Private: serialize snapshot from GameState for storage
function serializeSettingsFromState(
  state: GameState,
  keyBindings: KeyBindings,
): PersistedStore {
  const t = state.timing;
  const g = state.gameplay;
  // Keep nested shape for backward compatibility with existing store
  const timing: SerializedTiming = {
    arrMs: durationMsAsNumber(t.arrMs),
    dasMs: durationMsAsNumber(t.dasMs),
    gravityEnabled: t.gravityEnabled,
    gravityMs: durationMsAsNumber(t.gravityMs),
    lineClearDelayMs: durationMsAsNumber(t.lineClearDelayMs),
    lockDelayMaxResets: t.lockDelayMaxResets,
    lockDelayMs: durationMsAsNumber(t.lockDelayMs),
    softDrop: t.softDrop,
    tickHz: t.tickHz,
  };
  const gameplay: SerializedGameplay = {
    finesseCancelMs: durationMsAsNumber(g.finesseCancelMs),
    holdEnabled: g.holdEnabled,
  };
  if (g.ghostPieceEnabled !== undefined)
    gameplay.ghostPieceEnabled = g.ghostPieceEnabled;
  if (g.guidedColumnHighlightEnabled !== undefined)
    gameplay.guidedColumnHighlightEnabled = g.guidedColumnHighlightEnabled;
  if (g.nextPieceCount !== undefined)
    gameplay.nextPieceCount = g.nextPieceCount;
  if (g.finesseFeedbackEnabled !== undefined)
    gameplay.finesseFeedbackEnabled = g.finesseFeedbackEnabled;
  if (g.finesseBoopEnabled !== undefined)
    gameplay.finesseBoopEnabled = g.finesseBoopEnabled;
  if (g.retryOnFinesseError !== undefined)
    gameplay.retryOnFinesseError = g.retryOnFinesseError;

  return {
    gameplay,
    keyBindings,
    mode: state.currentMode,
    timing,
  };
}

// Merge and save current settings snapshot
export function saveSettings(state: GameState, keyBindings: KeyBindings): void {
  try {
    const store = getExistingStoreOrEmpty();
    const snapshot = serializeSettingsFromState(state, keyBindings);

    // Shallow replace primitives & deep merge nested timing/gameplay
    const next: Record<string, unknown> = { ...store };
    next["mode"] = snapshot.mode;
    next["keyBindings"] = snapshot.keyBindings;
    next["timing"] = { ...(store.timing ?? {}), ...(snapshot.timing ?? {}) };
    next["gameplay"] = {
      ...(store.gameplay ?? {}),
      ...(snapshot.gameplay ?? {}),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors in persistence layer
  }
}
