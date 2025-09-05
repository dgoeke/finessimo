// Template variants with branching functionality for Chapter 3
// Extends base templates using extendTemplate infrastructure with branch/gracefulExit support

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

/**
 * Check if field conditions favor flat-top TKI approach
 * Used by TKI base template to determine when to branch to flat variant
 */
function hasFlattopConditions(state: GameState): boolean {
  const board = state.board;
  // Check if top rows are relatively clean for flat-top setup
  let heightVariance = 0;
  const columnHeights: Array<number> = [];

  // Calculate column heights in top area
  for (let x = 0; x < board.width; x++) {
    let height = 0;
    for (let y = board.vanishRows; y < board.vanishRows + 4; y++) {
      const idx = y * board.width + x;
      if (board.cells[idx] !== 0) {
        height = y - board.vanishRows + 1;
      }
    }
    columnHeights.push(height);
  }

  // Calculate variance in column heights
  const avgHeight =
    columnHeights.reduce((sum, h) => sum + h, 0) / columnHeights.length;
  heightVariance = columnHeights.reduce(
    (sum, h) => sum + Math.abs(h - avgHeight),
    0,
  );

  // Favor flat-top when height variance is low
  return heightVariance <= 2.0;
}

/**
 * Check if the field has developed stacking patterns
 * Used by TKI stacking variant to determine viability
 */
function hasStackingPattern(state: GameState): boolean {
  const board = state.board;
  // Look for concentrated height in center columns (3-6)
  let centerHeight = 0;
  let edgeHeight = 0;

  for (let x = 0; x < board.width; x++) {
    let columnHeight = 0;
    for (let y = board.vanishRows; y < board.vanishRows + 6; y++) {
      const idx = y * board.width + x;
      if (board.cells[idx] !== 0) {
        columnHeight = y - board.vanishRows + 1;
      }
    }

    if (x >= 3 && x <= 6) {
      centerHeight += columnHeight;
    } else {
      edgeHeight += columnHeight;
    }
  }

  // Stacking pattern exists when center is significantly higher than edges
  return centerHeight > edgeHeight + 3;
}

// Find base templates for extension
const pcoStandard = BASE_TEMPLATES.find((t) => t.id === "PCO/standard");
const tkiBase = BASE_TEMPLATES.find((t) => t.id === "TKI/base");
const tkiFlatTop = BASE_TEMPLATES.find((t) => t.id === "TKI/flatTop");
const neitherSafe = BASE_TEMPLATES.find((t) => t.id === "Neither/safe");

if (!pcoStandard || !tkiBase || !tkiFlatTop || !neitherSafe) {
  throw new Error("Required base templates not found for variants");
}

// PCO Edge Variant - prefers edge columns when edges are clean
const pcoEdge = extendTemplate(pcoStandard, {
  gracefulExit: (_s: GameState) => neitherSafe,
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
  gracefulExit: (_s: GameState) => neitherSafe,
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

// Enhanced PCO Standard with branching logic
const pcoStandardEnhanced = extendTemplate(pcoStandard, {
  branch: (s: GameState) => {
    const branches: Array<Template> = [];

    // Branch to edge variant if edges are clean
    if (areEdgesClean(s)) {
      branches.push(pcoEdge);
    }

    // Branch to transition variant if PC is becoming unviable
    if (isPCBecomingUnviable(s)) {
      branches.push(pcoTransition);
    }

    return branches;
  },
  gracefulExit: (_s: GameState) => neitherSafe,
  id: "PCO/standard",
});

// Enhanced TKI Base with branching to flat-top variant
const tkiBaseEnhanced = extendTemplate(tkiBase, {
  branch: (s: GameState) => {
    const branches: Array<Template> = [];

    // Branch to flat-top when conditions favor it
    if (hasFlattopConditions(s)) {
      branches.push(tkiFlatTop);
    }

    return branches;
  },
  gracefulExit: (_s: GameState) => neitherSafe,
  id: "TKI/base",
});

// Enhanced TKI FlatTop with branching back to base
const tkiFlatTopEnhanced = extendTemplate(tkiFlatTop, {
  branch: (s: GameState) => {
    const branches: Array<Template> = [];

    // Branch back to base when flat conditions become unviable
    if (!hasFlattopConditions(s)) {
      branches.push(tkiBase);
    }

    return branches;
  },
  gracefulExit: (_s: GameState) => neitherSafe,
  id: "TKI/flatTop",
});

// New TKI Stacking Variant - focuses on building center columns
const tkiStacking = extendTemplate(tkiBase, {
  branch: (s: GameState) => {
    const branches: Array<Template> = [];

    // Branch to base TKI if stacking pattern breaks down
    if (!hasStackingPattern(s)) {
      branches.push(tkiBase);
    }

    return branches;
  },
  gracefulExit: (_s: GameState) => neitherSafe,
  id: "TKI/stacking",
  preconditions: (s: GameState) => {
    const hasStacking = hasStackingPattern(s);
    return {
      feasible: true, // Base template handles main feasibility
      notes: hasStacking
        ? ["good stacking pattern for center build"]
        : ["no clear stacking pattern"],
      scoreDelta: hasStacking ? 0.2 : -0.05, // Bonus for good stacking
    };
  },
});

// New PCO Rush Variant - faster PC attempts with less strict requirements
const pcoRush = extendTemplate(pcoStandard, {
  branch: (s: GameState) => {
    const branches: Array<Template> = [];

    // Branch to transition when rush becomes unviable
    if (isPCBecomingUnviable(s)) {
      branches.push(pcoTransition);
    }

    return branches;
  },
  gracefulExit: (_s: GameState) => neitherSafe,
  id: "PCO/rush",
  preconditions: (s: GameState) => {
    // More lenient than standard PCO - allows slightly messy field
    const board = s.board;
    let filledCells = 0;

    // Count filled cells in top area
    for (let x = 0; x < board.width; x++) {
      for (let y = board.vanishRows; y < board.vanishRows + 3; y++) {
        const idx = y * board.width + x;
        if (board.cells[idx] !== 0) {
          filledCells++;
        }
      }
    }

    // Rush variant is viable with more filled cells than standard
    const isViable = filledCells <= 15; // More lenient than standard

    return {
      feasible: true, // Base template handles main feasibility
      notes: isViable
        ? ["field viable for rush PC attempt"]
        : ["field too messy for rush PC"],
      scoreDelta: isViable ? 0.1 : -0.15,
    };
  },
});

// Export all variant templates with branching functionality
export const VARIANT_TEMPLATES: ReadonlyArray<Template> = [
  pcoEdge,
  pcoTransition,
  pcoStandardEnhanced,
  tkiBaseEnhanced,
  tkiFlatTopEnhanced,
  tkiStacking,
  pcoRush,
] as const;
