// Phase 1: Scene registry (no Phaser import)
import { Boot } from "./Boot";
import { Gameplay } from "./Gameplay";
import { MainMenu } from "./MainMenu";
import { ModeSelect } from "./ModeSelect";
import { Results } from "./Results";
import { Settings } from "./Settings";
import { SCENE_KEYS } from "./types";

import type { SceneKey } from "./types";

export { SCENE_KEYS };
export { Boot, Gameplay, MainMenu, ModeSelect, Results, Settings };

export const SCENES = [
  Boot,
  MainMenu,
  Settings,
  ModeSelect,
  Gameplay,
  Results,
] as const;

export type SceneCtor = new () => unknown;

export const SCENE_REGISTRY: Readonly<Record<SceneKey, SceneCtor>> = {
  Boot,
  Gameplay,
  MainMenu,
  ModeSelect,
  Results,
  Settings,
} as const;
