// Policy types for opener training system
// Chapter 1: MVP types for TKI/PCO policy with hysteresis and hazard detection

import type { Rot, GameState, ModeGuidance, PieceId } from "../state/types";
import type { GridCoord } from "../types/brands";
import type { Timestamp } from "../types/timestamp";

// Opener intents - what strategy we're pursuing
export type Intent = "TKI" | "PCO" | "Neither";

// Placement represents where to put the current piece
export type Placement = Readonly<{
  x: GridCoord;
  rot: Rot;
  pieceId?: PieceId; // explicit piece type (inferred if not provided)
  useHold?: boolean; // true => move current to hold and use next
}>;

// Placement grouping for UI hints (empty in Chapter 1, prepared for Chapter 4)
export type PlacementGroup = Readonly<{
  rot: Rot;
  xs: ReadonlyArray<number>; // column numbers (read via GridCoord->number helper)
  primary: Placement;
  alts: ReadonlyArray<Placement>;
}>;

// Main policy output - what the player should do
export type Suggestion = Readonly<{
  intent: Intent;
  placement: Placement; // for current piece (after hold, if used)
  rationale: string; // ≤ 90 chars explanation
  confidence: number; // 0..1
  planId?: string; // chosen template id
  groups?: ReadonlyArray<PlacementGroup>; // empty in Chapter 1
  guidance?: ModeGuidance; // optional UI targeting (unused in Chapter 1)
}>;

// Step candidate - conditional move proposal within a template
export type StepCandidate = Readonly<{
  when: (s: GameState) => boolean;
  propose: (s: GameState) => ReadonlyArray<Placement>;
  utility: (p: Placement, s: GameState) => number; // higher is better
}>;

// Template - defines an opener strategy
export type Template = Readonly<{
  id: string; // e.g. "TKI/base", "PCO/standard"
  opener: Intent;
  preconditions: (s: GameState) => {
    feasible: boolean;
    notes: ReadonlyArray<string>;
    scoreDelta?: number; // bias for ranking
  };
  nextStep: (s: GameState) => ReadonlyArray<StepCandidate>;
  // Chapter 3 fields, stubbed here:
  branch?: (s: GameState) => ReadonlyArray<Template>;
  gracefulExit?: (s: GameState) => Template | null;
}>;

// Hazard detection - problems with current board state
export type Hazard = Readonly<{
  id: string; // e.g., "overhang-without-T", "split-needs-I"
  detect: (s: GameState) => boolean;
  penalty: number; // e.g., -0.8 to -2.0
  reason: string; // short UI-safe explanation
  appliesTo?: ReadonlyArray<Intent>; // which intents this affects
}>;

// Context for hysteresis and plan stability
export type PolicyContext = Readonly<{
  lastPlanId: string | null;
  lastBestScore: number | null;
  lastSecondScore: number | null;
  planAge: number; // increments if plan unchanged
  lastUpdate: Timestamp | null; // reserved (optional time-decay)
}>;

// Complete policy output with updated context
export type PolicyOutput = Readonly<{
  suggestion: Suggestion;
  nextCtx: PolicyContext;
}>;
