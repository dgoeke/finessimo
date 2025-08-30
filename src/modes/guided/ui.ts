import { dropToBottom } from "../../core/board";
import { PIECES } from "../../core/pieces";
import { pickNextDue } from "../../srs/fsrs-adapter";
import { createGridCoord, gridCoordAsNumber } from "../../types/brands";
import { createTimestamp } from "../../types/timestamp";

import { makeDefaultDeck } from "./deck";

import type { GuidedCard, SrsDeck } from "../../srs/fsrs-adapter";
import type { GameState } from "../../state/types";
import type { ModeUiAdapter, ExtendedModeData, TargetCell } from "../types";

/**
 * Guided mode data structure as defined in guided.ts
 */
type GuidedSrsData = Readonly<{
  deck: SrsDeck;
  gradingConfig: {
    easyThresholdMs: number;
    goodThresholdMs: number;
  };
}>;

/**
 * Pure function to get the SRS deck from game state.
 * Mirrors the getDeck method from GuidedMode class.
 */
function getDeck(state: GameState): SrsDeck {
  const data = state.modeData as GuidedSrsData | undefined;
  if (data?.deck) return data.deck;
  return makeDefaultDeck(createTimestamp(1));
}

/**
 * Pure function to select the current guided card from game state.
 * Mirrors the selectCard method from GuidedMode class.
 */
function selectCard(state: GameState): GuidedCard | null {
  const deck = getDeck(state);
  const nowCount = Math.max(1, state.stats.attempts);
  const now = createTimestamp(nowCount);
  const rec = pickNextDue(deck, now);
  return rec?.card ?? null;
}

/**
 * Guided mode UI adapter implementation.
 *
 * Converts the existing getBoardDecorations logic into declarative
 * target data that can be consumed by UI selectors. This moves the
 * UI logic from imperative method calls to data-driven state population.
 */
export const guidedUi: ModeUiAdapter = {
  /**
   * Compute target cells for the current guided challenge.
   *
   * This replaces the logic from GuidedMode.getBoardDecorations(),
   * converting it from BoardDecorations to standardized target data.
   */
  computeDerivedUi(state: GameState): Partial<ExtendedModeData> | null {
    // Only provide targets during active gameplay
    if (state.status !== "playing") {
      return null;
    }

    // Get the current guided card (piece + target position)
    const card = selectCard(state);
    if (!card) {
      return null;
    }

    // Build an abstract active piece at the target x/rot above the board
    const startY = createGridCoord(-2);
    const startX = createGridCoord(card.x as number);
    const piece = {
      id: card.piece,
      rot: card.rot,
      x: startX,
      y: startY,
    } as const;

    // Calculate final position after dropping to bottom
    const finalPos = dropToBottom(state.board, piece);

    // Extract piece shape cells for the target rotation
    const shape = PIECES[piece.id];
    const cells = shape.cells[piece.rot];

    // Convert relative piece cells to absolute target coordinates
    const targetCells: Array<TargetCell> = [];
    for (const [dx, dy] of cells) {
      const absoluteX = createGridCoord(gridCoordAsNumber(finalPos.x) + dx);
      const absoluteY = createGridCoord(gridCoordAsNumber(finalPos.y) + dy);

      // Only include cells within visible board bounds
      if (
        gridCoordAsNumber(absoluteX) >= 0 &&
        gridCoordAsNumber(absoluteX) < state.board.width &&
        gridCoordAsNumber(absoluteY) >= 0 &&
        gridCoordAsNumber(absoluteY) < state.board.height
      ) {
        targetCells.push({
          color: shape.color,
          x: absoluteX,
          y: absoluteY,
        });
      }
    }

    // Return target pattern as single array (one target placement)
    return {
      targets: [targetCells],
    };
  },
} as const;
