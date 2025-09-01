import { describe, expect, it, jest } from "@jest/globals";

import {
  SCENE_KEYS,
  SCENES,
  Boot,
  Gameplay,
  MainMenu,
  ModeSelect,
  Results,
  Settings,
} from "../../src/presentation/phaser/scenes";

import type {
  SceneController,
  SceneKey,
} from "../../src/presentation/phaser/scenes/types";

describe("Phaser Scene Shells (Phase 1)", () => {
  it("exports 6 scenes and stable keys", () => {
    expect(SCENES.length).toBe(6);
    expect(SCENE_KEYS).toEqual({
      Boot: "Boot",
      Gameplay: "Gameplay",
      MainMenu: "MainMenu",
      ModeSelect: "ModeSelect",
      Results: "Results",
      Settings: "Settings",
    });
  });

  it("Boot.create() transitions to MainMenu", () => {
    const boot = new Boot();
    const spy = jest
      .spyOn(boot.scene, "start")
      .mockImplementation((_: unknown, __?: unknown) => boot.scene);
    boot.create();
    expect(spy).toHaveBeenCalledWith(SCENE_KEYS.MainMenu);
    spy.mockRestore();
  });

  it("MainMenu has shallow transitions", () => {
    const start = jest.fn<(k: SceneKey) => void>();
    const controller: SceneController = { start };
    const menu = new MainMenu();
    menu.scene = controller;
    menu.toSettings();
    expect(start).toHaveBeenLastCalledWith(SCENE_KEYS.Settings);
    menu.toModeSelect();
    expect(start).toHaveBeenLastCalledWith(SCENE_KEYS.ModeSelect);
    menu.toGameplay();
    expect(start).toHaveBeenLastCalledWith(SCENE_KEYS.Gameplay);
  });

  it("Settings.backToMenu() transitions to MainMenu", () => {
    const start = jest.fn<(k: SceneKey) => void>();
    const controller: SceneController = { start };
    const settings = new Settings();
    settings.scene = controller;
    settings.backToMenu();
    expect(start).toHaveBeenCalledWith(SCENE_KEYS.MainMenu);
  });

  it("ModeSelect transitions to Gameplay and back", () => {
    const start = jest.fn<(k: SceneKey) => void>();
    const controller: SceneController = { start };
    const modeSelect = new ModeSelect();
    modeSelect.scene = controller;
    modeSelect.toGameplay();
    expect(start).toHaveBeenLastCalledWith(SCENE_KEYS.Gameplay);
    modeSelect.backToMenu();
    expect(start).toHaveBeenLastCalledWith(SCENE_KEYS.MainMenu);
  });

  it("Gameplay transitions to Results or MainMenu", () => {
    const start = jest.fn<(k: SceneKey) => void>();
    const controller: SceneController = { start };
    const gameplay = new Gameplay();
    gameplay.scene = controller;
    gameplay.toResults();
    expect(start).toHaveBeenLastCalledWith(SCENE_KEYS.Results);
    gameplay.backToMenu();
    expect(start).toHaveBeenLastCalledWith(SCENE_KEYS.MainMenu);
  });

  it("Results.backToMenu() transitions to MainMenu", () => {
    const start = jest.fn<(k: SceneKey) => void>();
    const controller: SceneController = { start };
    const results = new Results();
    results.scene = controller;
    results.backToMenu();
    expect(start).toHaveBeenCalledWith(SCENE_KEYS.MainMenu);
  });
});
