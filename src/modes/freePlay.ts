import { createSevenBagRng } from "../core/rng";
import { type PieceRandomGenerator } from "../core/rng-interface";
import { type FinesseResult } from "../finesse/calculator";
import {
  type GameState,
  type ActivePiece,
  type Rot,
  type PieceId,
  type ModeGuidance,
} from "../state/types";

import {
  type GameMode,
  type GameModeResult,
  type ResolveLockContext,
  type ResolveLockDecision,
} from "./index";

export class FreePlayMode implements GameMode {
  readonly name = "freePlay";

  onBeforeSpawn(_state: GameState): { piece?: PieceId } | null {
    void _state;
    return null; // no override
  }

  getGuidance(_state: GameState): ModeGuidance | null {
    void _state;
    return null; // no special guidance
  }

  onPieceLocked(
    _gameState: GameState,
    _finesseResult: FinesseResult,
    _lockedPiece: ActivePiece,
    _finalPosition: ActivePiece,
  ): GameModeResult {
    // FreePlay does not emit textual feedback; overlay renders from FinesseResult
    void _gameState;
    void _finesseResult;
    void _lockedPiece;
    void _finalPosition;
    return {};
  }

  shouldPromptNext(_gameState: GameState): boolean {
    void _gameState;
    return false;
  }

  getNextPrompt(_gameState: GameState): string | null {
    void _gameState;
    return null;
  }

  // Free play analyzes the actual final target; no preset target
  getTargetFor(
    _lockedPiece: ActivePiece,
    _gameState: GameState,
  ): { targetX: number; targetRot: Rot } | null {
    void _lockedPiece;
    void _gameState;
    return null;
  }

  getExpectedPiece(_gameState: GameState): PieceId | undefined {
    void _gameState;
    return undefined;
  }

  // Lock resolution - implements retry on finesse error for hard drops
  onResolveLock(ctx: ResolveLockContext): ResolveLockDecision {
    const { finesse, pending, state } = ctx;

    // Only retry on hard drops with finesse errors when setting is enabled
    if (
      state.gameplay.retryOnFinesseError === true &&
      pending.source === "hardDrop" &&
      finesse.kind === "faulty" &&
      finesse.optimalSequences.length > 0
    ) {
      return { action: "retry" };
    }

    return { action: "commit" };
  }

  // 7-bag defaults for RNG and preview
  createRng(seed: string, _prev?: PieceRandomGenerator): PieceRandomGenerator {
    void _prev;
    return createSevenBagRng(seed);
  }

  getNextPiece(
    _state: GameState,
    rng: PieceRandomGenerator,
  ): { piece: PieceId; newRng: PieceRandomGenerator } {
    void _state;
    return rng.getNextPiece();
  }

  getPreview(
    _state: GameState,
    rng: PieceRandomGenerator,
    count: number,
  ): { pieces: Array<PieceId>; newRng: PieceRandomGenerator } {
    void _state;
    return rng.getNextPieces(count);
  }

  reset(): void {
    void 0;
  }
}
