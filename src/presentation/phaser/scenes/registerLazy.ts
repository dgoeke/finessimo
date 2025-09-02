import { SCENE_KEYS } from "./types";
import type Phaser from "phaser";
import { MainMenu } from "./MainMenu";
import { Settings } from "./Settings";
import { ModeSelect } from "./ModeSelect";
import { Gameplay } from "./Gameplay";
import { Results } from "./Results";

// Single lazy-loaded chunk for all non-Boot scenes
export async function registerLazyScenes(game: Phaser.Game): Promise<void> {
  game.scene.add(SCENE_KEYS.MainMenu, MainMenu);
  game.scene.add(SCENE_KEYS.Settings, Settings);
  game.scene.add(SCENE_KEYS.ModeSelect, ModeSelect);
  game.scene.add(SCENE_KEYS.Gameplay, Gameplay);
  game.scene.add(SCENE_KEYS.Results, Results);
}
