import { type FinesseResult } from "../finesse/calculator";
import {
  type GameState,
  type ActivePiece,
  type Rot,
  type PieceId,
  type ModeGuidance,
  type TimingConfig,
  type GameplayConfig,
} from "../state/types";

import { FreePlayMode } from "./freePlay";
import { GuidedMode } from "./guided";

export type GameModeResult = {
  feedback: string;
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

  // Optional: provide intended target for analysis in this mode
  getTargetFor?(
    lockedPiece: ActivePiece,
    gameState: GameState,
  ): { targetX: number; targetRot: Rot } | null;
  // Optional: provide expected piece for the current challenge (e.g., Guided)
  getExpectedPiece?(gameState: GameState): PieceId | undefined;

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
