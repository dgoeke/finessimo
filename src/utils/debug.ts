// Lightweight, opt-in debug logging utilities for browser + tests

// Topics can be enabled via:
// - localStorage key "finessimo/debug" with values: "true", "1", "on", or a comma list of topics
//   e.g. localStorage.setItem('finessimo/debug','guided,finesse,occupancy')
// - window.__FINESSIMO_DEBUG__ = { on: true } or { guided: true, finesse: true }

type DebugConfig = { on?: boolean } & Record<string, boolean | undefined>;

function isObject(u: unknown): u is Record<string, unknown> {
  return typeof u === "object" && u !== null;
}

function readWindowDebug(): DebugConfig | null {
  try {
    if (typeof window === "undefined") return null;
    const w = window as unknown as {
      __FINESSIMO_DEBUG__?: unknown;
      FINESSIMO_DEBUG?: unknown; // legacy alias without underscores
    };
    const primary = w.__FINESSIMO_DEBUG__;
    const legacy = w.FINESSIMO_DEBUG;
    let obj: unknown = null;
    if (isObject(primary)) {
      obj = primary;
    } else if (isObject(legacy)) {
      obj = legacy;
    }
    if (obj === null) return null;
    const rec = obj as Record<string, unknown>;
    const cfg: DebugConfig = { on: (rec as { on?: unknown }).on === true };
    const known = [
      "guided",
      "finesse",
      "occupancy",
      "selection",
      "srs",
    ] as const;
    for (const k of known) {
      cfg[k] = rec[k] === true;
    }
    return cfg;
  } catch {
    return null;
  }
}

function readStorageTopics(): ReadonlyArray<string> {
  try {
    const raw = localStorage.getItem("finessimo/debug");
    if (raw === null) return [];
    const v = raw.trim().toLowerCase();
    if (v === "1" || v === "true" || v === "on") return ["*"];
    const parts = v
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return parts;
  } catch {
    return [];
  }
}

export function isDebugEnabled(topic?: string): boolean {
  const winCfg = readWindowDebug();
  if (winCfg !== null && winCfg.on === true) return true;
  if (
    topic !== undefined &&
    winCfg !== null &&
    (winCfg as Record<string, boolean | undefined>)[topic] === true
  ) {
    return true;
  }
  const topics = readStorageTopics();
  if (topics.length === 0) return false;
  if (topics.includes("*")) return true;
  if (topic !== undefined) return topics.includes(topic);
  return true;
}

export function debugLog(topic: string, message: string, data?: unknown): void {
  if (!isDebugEnabled(topic)) return;
  try {
    if (data !== undefined) {
      console.warn(`[DBG:${topic}] ${message}`, data);
    } else {
      console.warn(`[DBG:${topic}] ${message}`);
    }
  } catch {
    /* ignore */
  }
}

export function debugTable(topic: string, label: string, rows: unknown): void {
  if (!isDebugEnabled(topic)) return;
  try {
    console.warn(`[DBG:${topic}] ${label}`, rows);
  } catch {
    /* ignore */
  }
}
