import { dropToBottom, createEmptyBoard } from "../core/board";
import { PIECES } from "../core/pieces";
import { type FinesseResult } from "../finesse/calculator";
import { getActionIcon } from "../finesse/constants";
import {
  type GuidedCard,
  type SrsDeck,
  type Rating,
  pickNextDue,
  rate,
  updateDeckRecord,
} from "../srs/fsrs-adapter";
import { canonicalId } from "../srs/fsrs-adapter";
import { loadGuidedDeck, saveGuidedDeck } from "../srs/storage";
import {
  type GameState,
  type PieceId,
  type Rot,
  type ActivePiece,
  type ModeGuidance,
  type Action,
  type BoardDecorations,
  type Board,
} from "../state/types";
import {
  createGridCoord,
  gridCoordAsNumber,
  createDurationMs,
  createUiEffectId,
} from "../types/brands";
import { createTimestamp, fromNow } from "../types/timestamp";

import { makeDefaultDeck } from "./guided/deck";

import { type GameMode, type GameModeResult } from "./index";

type GuidedGradingConfig = Readonly<{
  easyThresholdMs: number; // < 1000ms for easy grade
  goodThresholdMs: number; // < 2000ms for good grade (>= 2000ms gets hard)
}>;

type GuidedSrsData = Readonly<{
  deck: SrsDeck;
  gradingConfig: GuidedGradingConfig;
}>;

type RatingFeedback = {
  text: string;
  color: string;
  ttlMs: number;
};

const ratingToFeedback = {
  again: {
    color: "#ef4444",
    text: "miss",
    ttlMs: 5000,
  },
  easy: {
    color: "#60a5fa",
    text: "great!",
    ttlMs: 1200,
  },
  good: {
    color: "#10b981",
    text: "good",
    ttlMs: 1200,
  },
  hard: {
    color: "#f59e0b",
    text: "okay",
    ttlMs: 1200,
  },
} satisfies Record<Rating, RatingFeedback>;

export class GuidedMode implements GameMode {
  readonly name = "guided";

  // Disable hold and ghost piece in guided mode for focused training
  initialConfig(): {
    gameplay: { holdEnabled: boolean; ghostPieceEnabled: boolean };
  } {
    return {
      gameplay: {
        ghostPieceEnabled: false,
        holdEnabled: false,
      },
    };
  }

  initModeData(): GuidedSrsData {
    return {
      deck: makeDefaultDeck(createTimestamp(1)),
      gradingConfig: {
        easyThresholdMs: 1000,
        goodThresholdMs: 2000,
      },
    };
  }

  getDeck(state: GameState): SrsDeck {
    const data = state.modeData as GuidedSrsData | undefined;
    if (data?.deck) return data.deck;
    return makeDefaultDeck(createTimestamp(1));
  }

  getGradingConfig(state: GameState): GuidedGradingConfig {
    const data = state.modeData as GuidedSrsData | undefined;
    if (data?.gradingConfig) return data.gradingConfig;
    return {
      easyThresholdMs: 1000,
      goodThresholdMs: 2000,
    };
  }

  selectCard(state: GameState): GuidedCard | null {
    const deck = this.getDeck(state);
    const nowCount = Math.max(1, state.stats.attempts);
    const now = createTimestamp(nowCount);
    const rec = pickNextDue(deck, now);
    return rec?.card ?? null;
  }

  onBeforeSpawn(state: GameState): { piece?: PieceId } | null {
    if (state.status !== "playing") return null;
    const card = this.selectCard(state);
    if (!card) return null;
    return { piece: card.piece };
  }

  getGuidance(state: GameState): ModeGuidance | null {
    const card = this.selectCard(state);
    if (!card) return null;
    return {
      label: `SRS: ${card.piece} @ x=${String(card.x as number)}, rot=${card.rot}`,
      target: { rot: card.rot, x: createGridCoord(card.x as number) },
      visual: { highlightTarget: true, showPath: true },
    };
  }

  private calculatePlacementRating(
    placedCorrectly: boolean,
    finesseResult: FinesseResult,
    hasPlayerInput: boolean,
    placementDurationMs: number,
    gradingConfig: { easyThresholdMs: number; goodThresholdMs: number }
  ): Rating {
    if (
      !placedCorrectly ||
      finesseResult.kind !== "optimal" ||
      !hasPlayerInput
    ) {
      return "again";
    }
    if (placementDurationMs < gradingConfig.easyThresholdMs) {
      return "easy";
    }
    if (placementDurationMs < gradingConfig.goodThresholdMs) {
      return "good";
    }
    return "hard";
  }

  private createFeedbackEffect(
    rating: Rating,
    finesseResult: FinesseResult
  ): NonNullable<GameModeResult["postActions"]>[0] {
    const feedback = ratingToFeedback[rating];
    const base = feedback.text;
    const text =
      rating === "again"
        ? ((): string => {
            const firstOptimal = finesseResult.optimalSequences[0];
            const sequence = firstOptimal
              ? firstOptimal.map((action) => getActionIcon(action)).join("")
              : "";
            return `${base}! ${sequence}`;
          })()
        : base;

    const createdAt = fromNow();
    const effect = {
      anchor: "bottomRight" as const,
      color: feedback.color,
      createdAt,
      driftYPx: 120,
      fontPx: 48,
      fontWeight: 800,
      id: createUiEffectId(createdAt as number),
      kind: "floatingText" as const,
      offsetX: 0,
      offsetY: 120,
      scaleFrom: 1,
      scaleTo: 0.9,
      text,
      ttlMs: createDurationMs(feedback.ttlMs),
    } as const;

    return { effect, type: "PushUiEffect" };
  }

  onPieceLocked(
    gameState: GameState,
    finesseResult: FinesseResult,
    lockedPiece: ActivePiece,
    finalPosition: ActivePiece
  ): GameModeResult {
    const deck = this.getDeck(gameState);
    const now = createTimestamp(gameState.stats.attempts + 1);
    const dueCard = this.selectCard(gameState);
    const hasPlayerInput = gameState.processedInputLog.length > 0;
    if (!dueCard) {
      console.warn(`DEBUG: No due card found, returning early`);
      return {};
    }

    // Validate piece matches expected piece (should always match in guided mode)
    if (lockedPiece.id !== dueCard.piece) {
      console.error(
        "Unexpected piece mismatch in guided mode - this should not happen"
      );
      return {};
    }

    // Check if placement fills the intended target squares (rotation-agnostic)
    const targetPiece: ActivePiece = {
      id: dueCard.piece,
      rot: dueCard.rot,
      x: createGridCoord(dueCard.x as number),
      y: createGridCoord(-2),
    };
    // Be resilient in tests that construct partial states
    const board = (gameState as { board?: Board }).board ?? createEmptyBoard();
    const targetFinal = dropToBottom(board, targetPiece);
    const placedCorrectly = this.equalOccupiedCells(
      board,
      finalPosition,
      targetFinal
    );

    const key = canonicalId(dueCard);
    const rec =
      deck.items.get(key) ??
      Array.from(deck.items.values()).find((r) => r.key === key);
    if (!rec) return {};

    // Calculate piece placement timing for enhanced grading
    const gradingConfig = this.getGradingConfig(gameState);
    const spawnTime = gameState.physics.activePieceSpawnedAt;
    let placementDurationMs = 0;

    if (spawnTime !== null) {
      // Use current time as lock time for duration calculation
      const lockTime = fromNow();
      placementDurationMs = (lockTime as number) - (spawnTime as number);
    }

    const rating = this.calculatePlacementRating(
      placedCorrectly,
      finesseResult,
      hasPlayerInput,
      placementDurationMs,
      gradingConfig
    );

    const updated = rate(rec, rating, now);
    const newDeck = updateDeckRecord(deck, updated);
    // Persist updated deck
    saveGuidedDeck(newDeck);

    return {
      modeData: { deck: newDeck, gradingConfig },
      postActions: [this.createFeedbackEffect(rating, finesseResult)],
    };
  }

  // Compute absolute occupied cells for a piece within board bounds
  private occupiedCells(
    board: Board,
    piece: ActivePiece
  ): ReadonlyArray<readonly [number, number]> {
    const shape = PIECES[piece.id];
    const cells = shape.cells[piece.rot];
    const out: Array<readonly [number, number]> = [];
    for (const [dx, dy] of cells) {
      const ax = gridCoordAsNumber(piece.x) + dx;
      const ay = gridCoordAsNumber(piece.y) + dy;
      if (ax >= 0 && ax < board.width && ay >= 0 && ay < board.height) {
        out.push([ax, ay]);
      }
    }
    return out;
  }

  // Compare two placements by their filled squares (order-insensitive)
  private equalOccupiedCells(
    board: Board,
    a: ActivePiece,
    b: ActivePiece
  ): boolean {
    const aCells = this.occupiedCells(board, a);
    const bCells = this.occupiedCells(board, b);
    if (aCells.length !== bCells.length) return false;
    const key = (p: readonly [number, number]) =>
      `${String(p[0])},${String(p[1])}` as const;
    const setA = new Set(aCells.map(key));
    for (const c of bCells) {
      if (!setA.has(key(c))) return false;
    }
    return true;
  }

  shouldPromptNext(gameState: GameState): boolean {
    return !gameState.active;
  }

  getNextPrompt(gameState: GameState): string | null {
    const card = this.selectCard(gameState);
    if (!card) return null;
    return `SRS: ${card.piece} @ x=${String(card.x as number)} rot=${card.rot}`;
  }

  // Provide intended target for analysis
  getTargetFor(
    _lockedPiece: ActivePiece,
    gameState: GameState
  ): { targetX: number; targetRot: Rot } | null {
    const card = this.selectCard(gameState);
    if (!card) return null;
    return { targetRot: card.rot, targetX: card.x as number };
  }

  getExpectedPiece(gameState: GameState): PieceId | undefined {
    const card = this.selectCard(gameState);
    return card?.piece;
  }

  getBoardDecorations(state: GameState): BoardDecorations | null {
    if (state.status !== "playing") return null;
    const card = this.selectCard(state);
    if (!card) return null;
    const board = state.board;

    // Build an abstract active piece at the target x/rot above the board
    const startY = createGridCoord(-2);
    const startX = createGridCoord(card.x as number);
    const piece = {
      id: card.piece,
      rot: card.rot,
      x: startX,
      y: startY,
    } as const;
    const finalPos = dropToBottom(board, piece);

    // Compute absolute cells to highlight
    const shape = PIECES[piece.id];
    const cells = shape.cells[piece.rot];
    const decorated = [] as Array<{
      x: ReturnType<typeof createGridCoord>;
      y: ReturnType<typeof createGridCoord>;
    }>;
    for (const [dx, dy] of cells) {
      const ax = createGridCoord(gridCoordAsNumber(finalPos.x) + dx);
      const ay = createGridCoord(gridCoordAsNumber(finalPos.y) + dy);
      // Only include visible board cells
      if (ax >= 0 && ax < board.width && ay >= 0 && ay < board.height) {
        decorated.push({ x: ax, y: ay });
      }
    }
    return [
      {
        alpha: 0.25,
        cells: decorated,
        color: shape.color,
        type: "cellHighlight",
      },
    ];
  }

  isTargetSatisfied(
    _lockedPiece: ActivePiece,
    finalPosition: ActivePiece,
    state: GameState
  ): boolean {
    const card = this.selectCard(state);
    if (!card) return true; // no opinion
    const targetPiece: ActivePiece = {
      id: card.piece,
      rot: card.rot,
      x: createGridCoord(card.x as number),
      y: createGridCoord(-2),
    };
    const board = (state as { board?: Board }).board ?? createEmptyBoard();
    const targetFinal = dropToBottom(board, targetPiece);
    return this.equalOccupiedCells(board, finalPosition, targetFinal);
  }

  reset(): void {
    // no-op; consumers should re-init modeData via initModeData
  }

  onResolveLock(): { action: "commit"; postActions: ReadonlyArray<Action> } {
    // Always commit, then clear the board in guided mode to keep drills independent.
    return { action: "commit", postActions: [{ type: "ResetBoard" }] };
  }

  onActivated(state: GameState): { modeData?: unknown } {
    const now = state.stats.startedAtMs;
    const deck = loadGuidedDeck(now);
    return {
      modeData: {
        deck,
        gradingConfig: {
          easyThresholdMs: 1000,
          goodThresholdMs: 2000,
        },
      },
    };
  }
}
