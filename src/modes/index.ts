import { type PieceRandomGenerator } from "../core/rng-interface";
import { type FinesseResult } from "../finesse/calculator";
import {
  type GameState,
  type ActivePiece,
  type Rot,
  type PieceId,
  type ModeGuidance,
  type TimingConfig,
  type GameplayConfig,
  type PendingLock,
  type Action,
  type BoardDecorations,
} from "../state/types";

import { FreePlayMode } from "./freePlay";
import { GuidedMode } from "./guided";

// Lock resolution types for mode-driven retry decisions
export type ResolveLockContext = {
  state: GameState; // current state
  pending: PendingLock; // source/finalPos/lines
  finesse: FinesseResult; // result from analyzer
};

export type ResolveLockDecision =
  | { action: "retry" }
  | { action: "commit"; postActions?: ReadonlyArray<Action> };

export type GameModeResult = {
  isComplete?: boolean;
  nextPrompt?: string;
  // Optional: supply a new opaque mode data object to store in GameState
  modeData?: unknown;
};

export type GameMode = {
  readonly name: string;

  // Optional initial configuration tweaks applied on activation
  initialConfig?(): {
    timing?: Partial<TimingConfig>;
    gameplay?: Partial<GameplayConfig>;
  };
  // Optional initializer for per-mode opaque data stored in GameState
  initModeData?(): unknown;

  // Optional lifecycle hook invoked by the app when a mode is activated.
  // Allows a mode to provide initial modeData and/or post-activation actions
  // (e.g., persistence load, guidance setup) without app.ts branching.
  onActivated?(state: GameState): {
    modeData?: unknown;
    postActions?: ReadonlyArray<Action>;
  };

  onPieceLocked(
    gameState: GameState,
    finesseResult: FinesseResult,
    lockedPiece: ActivePiece,
    finalPosition: ActivePiece,
  ): GameModeResult;

  shouldPromptNext(gameState: GameState): boolean;

  getNextPrompt(gameState: GameState): string | null;

  // Spawn policy hook: allow a mode to suggest the next piece (e.g., guided drills)
  onBeforeSpawn?(state: GameState): { piece?: PieceId } | null;

  // Generic guidance for UI/visualization (targets, labels, flags)
  getGuidance?(state: GameState): ModeGuidance | null;

  // Optional: provide per-frame board decorations for the UI to render
  getBoardDecorations?(state: GameState): BoardDecorations | null;

  // Optional: provide intended target for analysis in this mode
  getTargetFor?(
    lockedPiece: ActivePiece,
    gameState: GameState,
  ): { targetX: number; targetRot: Rot } | null;
  // Optional: custom placement validation for wrong-target faults
  isTargetSatisfied?(
    lockedPiece: ActivePiece,
    finalPosition: ActivePiece,
    state: GameState,
  ): boolean;
  // Optional: provide expected piece for the current challenge (e.g., Guided)
  getExpectedPiece?(gameState: GameState): PieceId | undefined;

  // Lock resolution hook for retry decisions
  onResolveLock?(ctx: ResolveLockContext): ResolveLockDecision;

  // RNG ownership and preview control
  createRng?(seed: string, prev?: PieceRandomGenerator): PieceRandomGenerator;

  getNextPiece?(
    state: GameState,
    rng: PieceRandomGenerator,
  ): { piece: PieceId; newRng: PieceRandomGenerator };

  getPreview?(
    state: GameState,
    rng: PieceRandomGenerator,
    count: number,
  ): { pieces: Array<PieceId>; newRng: PieceRandomGenerator };

  reset(): void;
};

export type GameModeRegistry = {
  register(mode: GameMode): void;
  get(name: string): GameMode | undefined;
  list(): Array<string>;
};

class DefaultGameModeRegistry implements GameModeRegistry {
  private modes = new Map<string, GameMode>();

  register(mode: GameMode): void {
    this.modes.set(mode.name, mode);
  }

  get(name: string): GameMode | undefined {
    return this.modes.get(name);
  }

  list(): Array<string> {
    return Array.from(this.modes.keys());
  }
}

export const gameModeRegistry = new DefaultGameModeRegistry();

gameModeRegistry.register(new FreePlayMode());
gameModeRegistry.register(new GuidedMode());
