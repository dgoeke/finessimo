import type { DASMachineService } from "../../../../input/machines/das";
import type { ModeUiAdapter } from "../../../../modes/types";
import type { GameState, Action } from "../../../../state/types";
import type { Seed } from "../../../../types/brands";
import type { Timestamp } from "../../../../types/timestamp";
import type { PhaserInputAdapter } from "../../input/PhaserInputAdapter";
import type { Presenter, ViewModel, Ms } from "../../presenter/types";
import type { Clock } from "../clock";
import type Phaser from "phaser";

export type TetrominoPieceId = "I" | "J" | "L" | "O" | "S" | "T" | "Z";

export type SceneCtx = {
  readonly scene: Phaser.Scene;
  readonly presenter: Presenter;
  readonly input: PhaserInputAdapter;
  readonly das: DASMachineService;
  readonly clock: Clock;
  readonly reduce: (s: Readonly<GameState>, a: Action) => GameState;
  readonly safeDispatch: (a: Action) => void;
  readonly randomSeed: () => Seed;
  readonly spawnNextPiece: () => void;
  readonly modeUiAdapters: Record<"freePlay" | "guided", ModeUiAdapter>;

  fixedDt: Ms;

  // state accessors
  getState(): GameState;
  state: GameState;
  setState(s: GameState): void;

  // layout + cached view bits
  originX: number;
  originY: number;
  tileSize: number;
  boardHeightPx: number;
  overlayColumns: Phaser.GameObjects.Graphics | null;
  overlayTargets: Phaser.GameObjects.Graphics | null;
  nextPreviewContainers: Array<Phaser.GameObjects.Container>;
  holdContainer: Phaser.GameObjects.Container | null;
  vmPrev: ViewModel | null;
  setVmPrev(vm: ViewModel | null): void;
  softDropOn: boolean;
  setSoftDropOn(on: boolean): void;

  // ephemeral helpers for input/effects
  pendingTap: { dir: -1 | 1; t: Timestamp } | null;
  setPendingTap(v: { dir: -1 | 1; t: Timestamp } | null): void;
  effectsTexts: Map<number, Phaser.GameObjects.Text>;
  effectsStart: Map<number, number>;
};
