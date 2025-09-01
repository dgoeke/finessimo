// Phase 1: Scene keys and minimal controller contract (no Phaser import)

export type SceneKey =
  | "Boot"
  | "MainMenu"
  | "Settings"
  | "ModeSelect"
  | "Gameplay"
  | "Results";

export type SceneController = {
  start(key: SceneKey): void;
};

export const SCENE_KEYS = {
  Boot: "Boot",
  Gameplay: "Gameplay",
  MainMenu: "MainMenu",
  ModeSelect: "ModeSelect",
  Results: "Results",
  Settings: "Settings",
} as const satisfies Record<SceneKey, SceneKey> &
  Readonly<Record<SceneKey, SceneKey>>;
