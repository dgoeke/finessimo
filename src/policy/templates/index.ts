// Base templates for opener policy system
// Chapter 1: Minimal TKI, PCO, and Neither templates

import { canPlacePiece, dropToBottom } from "../../core/board";
import { createGridCoord, gridCoordAsNumber } from "../../types/brands";

import { extendTemplate } from "./_compose";
import { tkiUtility, pcoUtility, safeUtility } from "./opener_utils";

import type { GameState, ActivePiece, Rot, PieceId } from "../../state/types";
import type { Template, StepCandidate, Placement } from "../types";

// Simple memoization for template preconditions
const preconditionCache = new Map<
  string,
  {
    feasible: boolean;
    notes: ReadonlyArray<string>;
    scoreDelta?: number;
  }
>();

function memoizePreconditions(
  fn: (s: GameState) => {
    feasible: boolean;
    notes: ReadonlyArray<string>;
    scoreDelta?: number;
  },
  templateId: string,
): (s: GameState) => {
  feasible: boolean;
  notes: ReadonlyArray<string>;
  scoreDelta?: number;
} {
  return (s: GameState) => {
    // Create cache key from game state essentials that affect preconditions
    const activeId = s.active?.id ?? "none";
    const hold = s.hold ?? "none";
    const queueKey = s.nextQueue.slice(0, 3).join(""); // Early pieces matter for preconditions
    const boardFlat = isFieldFlat(s) ? "flat" : "uneven";
    const key = `${templateId}_${activeId}_${hold}_${queueKey}_${boardFlat}`;

    if (preconditionCache.has(key)) {
      const cached = preconditionCache.get(key);
      if (cached !== undefined) {
        return cached;
      }
    }

    const result = fn(s);
    preconditionCache.set(key, result);
    return result;
  };
}

// Utility functions for template logic

function hasEarlyI(nextQueue: ReadonlyArray<PieceId>): boolean {
  // Check if I piece is available in the next 3 pieces
  return nextQueue.slice(0, 3).includes("I");
}

function isFieldFlat(state: GameState): boolean {
  // Simple flatness check: no cells in top 2 visible rows (y=0,1)
  const board = state.board;
  for (let x = 0; x < board.width; x++) {
    for (let y = 0; y < 2; y++) {
      const idx = (y + board.vanishRows) * board.width + x;
      if (board.cells[idx] !== 0) {
        return false;
      }
    }
  }
  return true;
}

function hasAvailableI(state: GameState): boolean {
  // Check if I is in hold or early preview, or if active piece is I
  return (
    state.hold === "I" || hasEarlyI(state.nextQueue) || state.active?.id === "I"
  );
}

// Helper to create placement key for deduplication
function createPlacementKey(placement: Placement): string {
  const useHoldStr = (placement.useHold ?? false).toString();
  return `${gridCoordAsNumber(placement.x).toString()},${placement.rot},${useHoldStr}`;
}

// Helper to test single position and add if valid
function addValidPlacement(
  placements: Array<Placement>,
  seen: Set<string>,
  board: GameState["board"],
  testPiece: ActivePiece,
): void {
  const dropped = dropToBottom(board, testPiece);
  if (canPlacePiece(board, dropped)) {
    const placement: Placement = {
      rot: dropped.rot,
      x: dropped.x,
    };

    const key = createPlacementKey(placement);
    if (!seen.has(key)) {
      seen.add(key);
      placements.push(placement);
    }
  }
}

// Simplified placement generation with reduced complexity (internal, unmemoized)
function generateLegalPlacementsInternal(
  state: GameState,
  pieceId: PieceId,
  includeHold = false,
): ReadonlyArray<Placement> {
  const placements: Array<Placement> = [];
  const seen = new Set<string>();
  const rotations: Array<Rot> = ["spawn", "right", "two", "left"];

  // Test all positions and rotations
  for (const rot of rotations) {
    for (let x = 0; x < 10; x++) {
      const testPiece: ActivePiece = {
        id: pieceId,
        rot,
        x: createGridCoord(x),
        y: createGridCoord(0),
      };

      addValidPlacement(placements, seen, state.board, testPiece);
    }
  }

  // Add hold variants if requested and different piece available
  if (includeHold && state.active && state.canHold) {
    // Create a simplified state for hold placement generation
    const holdPlacements = generateLegalPlacementsInternal(
      state,
      state.active.id,
      false,
    );

    holdPlacements.forEach((placement) => {
      const holdPlacement: Placement = { ...placement, useHold: true };
      const key = createPlacementKey(holdPlacement);

      if (!seen.has(key)) {
        seen.add(key);
        placements.push(holdPlacement);
      }
    });
  }

  return placements;
}

// Placement generation cache
const placementCache = new Map<string, ReadonlyArray<Placement>>();

/**
 * Clear template-specific caches
 */
export function clearTemplateCache(): void {
  preconditionCache.clear();
  placementCache.clear();
}

// Memoized placement generation
function generateLegalPlacements(
  state: GameState,
  pieceId: PieceId,
  includeHold = false,
): ReadonlyArray<Placement> {
  // Create cache key from board state and piece info
  const boardKey = state.board.cells.join("");
  const activeId = state.active?.id ?? "none";
  const canHoldStr = state.canHold ? "1" : "0";
  const holdKey = includeHold ? `_hold_${activeId}_${canHoldStr}` : "";
  const key = `placements_${pieceId}_${boardKey}${holdKey}`;

  if (placementCache.has(key)) {
    const cached = placementCache.get(key);
    if (cached !== undefined) {
      return cached;
    }
  }

  const result = generateLegalPlacementsInternal(state, pieceId, includeHold);
  placementCache.set(key, result);
  return result;
}

// Step candidates with template-specific utilities
const tkiStepCandidate: StepCandidate = {
  propose: (s: GameState): ReadonlyArray<Placement> => {
    return s.active ? generateLegalPlacements(s, s.active.id, true) : [];
  },
  utility: tkiUtility,
  when: (s: GameState): boolean => s.active !== undefined,
};

const pcoStepCandidate: StepCandidate = {
  propose: (s: GameState): ReadonlyArray<Placement> => {
    return s.active ? generateLegalPlacements(s, s.active.id, true) : [];
  },
  utility: pcoUtility,
  when: (s: GameState): boolean => s.active !== undefined,
};

// Safe step candidate that doesn't use hold and prefers center positions
const safeStepCandidate: StepCandidate = {
  propose: (s: GameState): ReadonlyArray<Placement> => {
    if (!s.active) return [];
    // Generate placements without hold for safe strategy
    return generateLegalPlacements(s, s.active.id, false).map((p) => ({
      ...p,
      useHold: false, // Explicitly no hold
    }));
  },
  utility: safeUtility,
  when: (s: GameState): boolean => s.active !== undefined,
};

// Base templates - minimal set for Chapter 1

// TKI base template
const tkiBase: Template = {
  id: "TKI/base",
  nextStep: (s: GameState): ReadonlyArray<StepCandidate> => {
    // Return empty array if no active piece
    return s.active ? [tkiStepCandidate] : [];
  },
  opener: "TKI",
  preconditions: memoizePreconditions(
    (
      s: GameState,
    ): {
      feasible: boolean;
      notes: ReadonlyArray<string>;
      scoreDelta?: number;
    } => {
      const hasI = hasAvailableI(s);
      const notes: Array<string> = [];

      if (hasI && s.active?.id === "I") {
        notes.push("I is active piece");
      } else if (hasI && hasEarlyI(s.nextQueue)) {
        notes.push("I in early preview");
      } else if (hasI && s.hold === "I") {
        notes.push("I in hold");
      } else {
        notes.push("No I piece available for TKI");
      }

      return {
        feasible: hasI,
        notes,
        scoreDelta: hasI ? 0.3 : -0.5, // Bonus when feasible, penalty when not
      };
    },
    "TKI/base",
  ),
};

// TKI variant that prefers flat fields (demonstrates extendTemplate)
const tkiFlatTop = extendTemplate(tkiBase, {
  id: "TKI/flatTop",
  preconditions: (s: GameState) => {
    const isFlat = isFieldFlat(s);
    return {
      feasible: true, // Base template handles main feasibility
      notes: isFlat ? ["flat field optimal"] : ["field has height"],
      scoreDelta: isFlat ? 0.2 : 0, // Bonus for flat field
    };
  },
});

export const BASE_TEMPLATES: ReadonlyArray<Template> = [
  tkiBase,
  tkiFlatTop,

  // PCO (Perfect Clear Opener) - flat field variant
  {
    id: "PCO/standard",
    nextStep: (s: GameState): ReadonlyArray<StepCandidate> => {
      return s.active ? [pcoStepCandidate] : [];
    },
    opener: "PCO",
    preconditions: memoizePreconditions(
      (
        s: GameState,
      ): {
        feasible: boolean;
        notes: ReadonlyArray<string>;
        scoreDelta?: number;
      } => {
        const isFlat = isFieldFlat(s);
        const hasI = hasAvailableI(s);
        const notes: Array<string> = [];

        if (isFlat) {
          notes.push("flat field");
        } else {
          notes.push("Field not flat for PCO");
        }

        // PCO needs both flat field AND I piece available
        const isFeasible = isFlat && hasI;

        return {
          feasible: isFeasible,
          notes,
          scoreDelta: isFeasible ? 0.2 : -0.3, // Bonus when feasible, penalty when not
        };
      },
      "PCO/standard",
    ),
  },

  // Neither - neutral/fallback strategy
  {
    id: "Neither/safe",
    nextStep: (s: GameState): ReadonlyArray<StepCandidate> => {
      return s.active ? [safeStepCandidate] : [];
    },
    opener: "Neither",
    preconditions: memoizePreconditions(
      (
        _s: GameState,
      ): {
        feasible: boolean;
        notes: ReadonlyArray<string>;
        scoreDelta?: number;
      } => {
        return {
          feasible: true, // Always feasible as fallback
          notes: ["safe stacking"],
          scoreDelta: 0, // No bonus or penalty
        };
      },
      "Neither/safe",
    ),
  },
] as const;
