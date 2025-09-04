// Additional template variants for Chapter 2 of the opener training system
// Extends base templates using extendTemplate infrastructure

import { extendTemplate } from "./_compose";

import { BASE_TEMPLATES } from "./index";

import type { GameState } from "../../state/types";
import type { Template } from "../types";

// Utility functions for variant-specific logic

/**
 * Check if the field edges (columns 0-2 or 7-9) are relatively clean
 * Used by PCO edge variant to determine if edge placements are viable
 */
function areEdgesClean(state: GameState): boolean {
  const board = state.board;
  const leftEdgeThreshold = 3; // Max height in left edge (x=0-2)
  const rightEdgeThreshold = 3; // Max height in right edge (x=7-9)

  // Check left edge columns (0-2)
  for (let x = 0; x <= 2; x++) {
    for (
      let y = board.vanishRows;
      y < board.vanishRows + leftEdgeThreshold;
      y++
    ) {
      const idx = y * board.width + x;
      if (board.cells[idx] !== 0) {
        return false; // Left edge has height
      }
    }
  }

  // Check right edge columns (7-9)
  for (let x = 7; x <= 9; x++) {
    for (
      let y = board.vanishRows;
      y < board.vanishRows + rightEdgeThreshold;
      y++
    ) {
      const idx = y * board.width + x;
      if (board.cells[idx] !== 0) {
        return false; // Right edge has height
      }
    }
  }

  return true;
}

/**
 * Check if the field has a PC setup that's becoming difficult to maintain
 * Used by PCO transition variant to detect when to switch strategies
 */
function isPCBecomingUnviable(state: GameState): boolean {
  const board = state.board;
  let filledCells = 0;
  let maxHeight = 0;

  // Count filled cells and find max height in visible area
  for (let x = 0; x < board.width; x++) {
    for (let y = board.vanishRows; y < board.vanishRows + 4; y++) {
      const idx = y * board.width + x;
      if (board.cells[idx] !== 0) {
        filledCells++;
        maxHeight = Math.max(maxHeight, y - board.vanishRows + 1);
      }
    }
  }

  // PC becomes unviable if too many cells filled or height too uneven
  return filledCells > 20 || maxHeight > 3;
}

// Find base templates for extension
const pcoStandard = BASE_TEMPLATES.find((t) => t.id === "PCO/standard");
const tkiBase = BASE_TEMPLATES.find((t) => t.id === "TKI/base");

if (!pcoStandard || !tkiBase) {
  throw new Error("Required base templates not found for variants");
}

// PCO Edge Variant - prefers edge columns when edges are clean
const pcoEdge = extendTemplate(pcoStandard, {
  id: "PCO/edge",
  preconditions: (s: GameState) => {
    const edgesClean = areEdgesClean(s);
    return {
      feasible: true, // Base template handles main feasibility
      notes: edgesClean ? ["clean edges for edge play"] : ["edges have height"],
      scoreDelta: edgesClean ? 0.15 : -0.1, // Bonus for clean edges
    };
  },
});

// PCO Transition Variant - switches to safe stacking when PC becomes unviable
const pcoTransition = extendTemplate(pcoStandard, {
  id: "PCO/transition",
  preconditions: (s: GameState) => {
    const pcUnviable = isPCBecomingUnviable(s);
    return {
      feasible: true, // Always feasible as it can transition
      notes: pcUnviable
        ? ["PC unviable, transition to safe stacking"]
        : ["PC still viable"],
      scoreDelta: pcUnviable ? -0.2 : 0.1, // Penalty when transitioning, bonus when PC viable
    };
  },
});

// Export all variant templates
export const VARIANT_TEMPLATES: ReadonlyArray<Template> = [
  pcoEdge,
  pcoTransition,
] as const;
