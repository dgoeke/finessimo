import { type PieceRandomGenerator } from "../../core/rng/interface";
import { createSevenBagRng } from "../../core/rng/seeded";
import { type FinesseResult } from "../../engine/finesse/calculator";
import {
  type GameState,
  type ActivePiece,
  type Rot,
  type PieceId,
  type ModeGuidance,
  type BoardDecorations,
} from "../../state/types";
import {
  type GameMode,
  type GameModeResult,
  type ResolveLockContext,
  type ResolveLockDecision,
} from "../index";

export class FreePlayMode implements GameMode {
  readonly name = "freePlay";

  // Enable hold functionality in free play mode
  initialConfig(): { gameplay: { holdEnabled: boolean } } {
    return {
      gameplay: {
        holdEnabled: true,
      },
    };
  }

  onActivated(_state: GameState): { modeData?: unknown } {
    return {}; // No mode data needed for simple free play
  }

  onBeforeSpawn(_state: GameState): { piece?: PieceId } | null {
    return null; // no override
  }

  getGuidance(_state: GameState): ModeGuidance | null {
    // Free play mode provides no guidance
    return null;
  }

  onPieceLocked(
    _gameState: GameState,
    _finesseResult: FinesseResult,
    _lockedPiece: ActivePiece,
    _finalPosition: ActivePiece,
  ): GameModeResult {
    // FreePlay does not emit textual feedback; overlay renders from FinesseResult
    return {};
  }

  shouldPromptNext(_gameState: GameState): boolean {
    return false;
  }

  getNextPrompt(_gameState: GameState): string | null {
    return null;
  }

  // Free play analyzes the actual final target; no preset target
  getTargetFor(
    _lockedPiece: ActivePiece,
    _gameState: GameState,
  ): { targetX: number; targetRot: Rot } | null {
    return null;
  }

  getBoardDecorations(_state: GameState): BoardDecorations | null {
    // Free play mode provides no board decorations
    return null;
  }

  getExpectedPiece(_gameState: GameState): PieceId | undefined {
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
    return createSevenBagRng(seed);
  }

  getNextPiece(
    _state: GameState,
    rng: PieceRandomGenerator,
  ): { piece: PieceId; newRng: PieceRandomGenerator } {
    return rng.getNextPiece();
  }

  getPreview(
    _state: GameState,
    rng: PieceRandomGenerator,
    count: number,
  ): { pieces: Array<PieceId>; newRng: PieceRandomGenerator } {
    return rng.getNextPieces(count);
  }

  reset(): void {
    // Intentionally no-op for free play
  }
}
