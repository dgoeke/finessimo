// Scenario cards for opener training system
// Chapter 2: Core scenarios functionality with TKI/PCO variants

import { createSeed } from "../types/brands";

import type { Intent } from "../policy/types";
import type { Seed } from "../types/brands";

// ScenarioCard defines a specific training scenario
export type ScenarioCard = Readonly<{
  id: string; // "PCO/std:easyA"
  opener: Intent; // "TKI" | "PCO" | "Neither"
  seed: Seed; // branded string for deterministic RNG
  startTicks?: number; // optional offset into the sequence
  notes?: ReadonlyArray<string>; // optional explanatory notes
  maxGarbage?: number; // max garbage lines on board
  minPreview?: number; // minimal preview length guard
}>;

// Registry of training scenarios - 6+ cards with TKI/PCO variants
export const SCENARIOS: ReadonlyArray<ScenarioCard> = [
  // TKI scenarios - easy difficulty
  {
    id: "TKI/base:easyA",
    maxGarbage: 0,
    minPreview: 5,
    notes: ["Basic TKI opener setup", "Focus on T-piece placement"],
    opener: "TKI",
    seed: createSeed("TKI_easy_A_v1"),
    startTicks: 0,
  },
  {
    id: "TKI/base:easyB",
    maxGarbage: 0,
    minPreview: 5,
    notes: ["Clean board TKI", "Good for beginners"],
    opener: "TKI",
    seed: createSeed("TKI_easy_B_v1"),
    startTicks: 0,
  },
  {
    id: "TKI/flatTop:midA",
    maxGarbage: 1,
    minPreview: 6,
    notes: ["TKI with flat top setup", "Mid-level difficulty"],
    opener: "TKI",
    seed: createSeed("TKI_mid_flatTop_v1"),
    startTicks: 0,
  },

  // PCO scenarios - easy difficulty
  {
    id: "PCO/std:easyA",
    maxGarbage: 0,
    minPreview: 5,
    notes: ["Standard PCO opener", "Clean Perfect Clear opportunity"],
    opener: "PCO",
    seed: createSeed("PCO_easy_A_v1"),
    startTicks: 0,
  },
  {
    id: "PCO/std:easyB",
    maxGarbage: 0,
    minPreview: 5,
    notes: ["Alternative PCO setup", "Different piece sequence"],
    opener: "PCO",
    seed: createSeed("PCO_easy_B_v1"),
    startTicks: 0,
  },
  {
    id: "PCO/alt:midA",
    maxGarbage: 1,
    minPreview: 6,
    notes: ["PCO with edge considerations", "Mid-level difficulty"],
    opener: "PCO",
    seed: createSeed("PCO_mid_alt_v1"),
    startTicks: 0,
  },

  // Additional scenarios for broader coverage
  {
    id: "TKI/stacking:midB",
    maxGarbage: 2,
    minPreview: 6,
    notes: ["TKI with stacking focus", "Practice efficient building"],
    opener: "TKI",
    seed: createSeed("TKI_mid_stack_v1"),
    startTicks: 0,
  },
  {
    id: "PCO/transition:hardA",
    maxGarbage: 2,
    minPreview: 7,
    notes: ["PCO to continuation", "Advanced transition practice"],
    opener: "PCO",
    seed: createSeed("PCO_hard_trans_v1"),
    startTicks: 0,
  },
] as const;

// Helper function to validate required string fields
function isValidStringField(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

// Helper function to validate optional numeric fields
function isValidOptionalNumber(value: unknown): boolean {
  return value === undefined || (typeof value === "number" && value >= 0);
}

// Helper function to validate opener field
function isValidOpener(opener: unknown): opener is Intent {
  return opener === "TKI" || opener === "PCO" || opener === "Neither";
}

// Type guard to validate scenario cards
export function isValidScenarioCard(card: unknown): card is ScenarioCard {
  if (card === null || card === undefined || typeof card !== "object") {
    return false;
  }

  const c = card as Record<string, unknown>;

  return (
    isValidStringField(c["id"]) &&
    isValidStringField(c["seed"]) &&
    isValidOpener(c["opener"]) &&
    isValidOptionalNumber(c["startTicks"]) &&
    isValidOptionalNumber(c["maxGarbage"]) &&
    isValidOptionalNumber(c["minPreview"]) &&
    (c["notes"] === undefined || Array.isArray(c["notes"]))
  );
}

// Helper to find scenario by ID
export function findScenarioById(id: string): ScenarioCard | undefined {
  return SCENARIOS.find((card) => card.id === id);
}

// Helper to get scenarios by opener type
export function getScenariosByOpener(
  opener: Intent,
): ReadonlyArray<ScenarioCard> {
  return SCENARIOS.filter((card) => card.opener === opener);
}

// Helper to get scenarios by difficulty (inferred from ID)
export function getScenariosByDifficulty(
  difficulty: "easy" | "mid" | "hard",
): ReadonlyArray<ScenarioCard> {
  return SCENARIOS.filter((card) => card.id.includes(difficulty));
}
