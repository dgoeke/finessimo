// Shared settings type used by the app and tests
// Moved from the deprecated settings-modal component

import type { KeyBindings } from "../../input/keyboard";

export type GameSettings = {
  // Timing settings
  dasMs: number;
  arrMs: number;
  softDrop?: number | "infinite";
  lockDelayMs: number;
  lineClearDelayMs: number;

  // Gameplay settings
  gravityEnabled: boolean;
  gravityMs: number;
  finesseCancelMs: number;
  ghostPieceEnabled: boolean;
  guidedColumnHighlightEnabled: boolean;
  nextPieceCount: number;

  // Finesse settings
  finesseFeedbackEnabled: boolean;
  finesseBoopEnabled: boolean;
  retryOnFinesseError: boolean;

  // Opening coaching settings
  openingCoachingEnabled: boolean;

  // Controls
  keyBindings?: KeyBindings;
  // Minimal playtest toggle
  mode?: "freePlay" | "guided";
};

// UI tab identifiers for settings panel
export type TabId = "stats" | "settings";
