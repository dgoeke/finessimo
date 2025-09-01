// PR3: Real Phaser ModeSelect scene — lists and selects modes
import Phaser from "phaser";

import { gameModeRegistry } from "../../../modes";
import { dispatch } from "../../../state/signals";

import { SCENE_KEYS } from "./types";

type RexRoundRect = {
  setInteractive(): void;
  on(e: string, cb: () => void): void;
  setFillStyle(color: number): void;
};

type RexUiPlugin = {
  add: {
    sizer(config: unknown): {
      add(child: unknown, opts?: unknown): void;
      layout(): void;
    };
    roundRectangle(
      x: number,
      y: number,
      width: number,
      height: number,
      radius: number,
      color: number,
    ): RexRoundRect;
    label(config: unknown): unknown;
  };
};

export class ModeSelect extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.ModeSelect });
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    // Title
    const title = this.add.text(w / 2, 80, "Select Mode", {
      color: "#ffffff",
      fontFamily: "monospace",
      fontSize: "22px",
    });
    title.setOrigin(0.5, 0.5);

    // Get available modes
    const modes = this.listModes();

    // Build rexUI menu
    const rex = this.rexUI as RexUiPlugin;
    const menu = rex.add.sizer({
      orientation: 1, // vertical
      space: { item: 10 },
      x: w / 2,
      y: h / 2,
    });

    // Helper to create mode button
    const makeModeButton = (modeName: string): RexUIInternal.Base => {
      const bg = rex.add.roundRectangle(0, 0, 200, 44, 8, 0x334455);

      // Format mode name for display (e.g., "freePlay" -> "Free Play")
      const displayName = modeName
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
        .trim();

      const txt = this.add.text(0, 0, displayName, {
        color: "#ffffff",
        fontFamily: "monospace",
        fontSize: "16px",
      });

      const btn = rex.add.label({
        background: bg,
        text: txt,
      }) as RexUIInternal.Base;

      bg.setInteractive();
      bg.on("pointerdown", () => this.selectMode(modeName));

      // Add hover effect
      bg.on("pointerover", () => {
        bg.setFillStyle(0x445566);
      });
      bg.on("pointerout", () => {
        bg.setFillStyle(0x334455);
      });

      return btn;
    };

    // Add mode buttons
    for (const modeName of modes) {
      menu.add(makeModeButton(modeName), { align: "center" });
    }

    // Add back button
    const backBg = rex.add.roundRectangle(0, 0, 120, 36, 6, 0x223344);
    const backTxt = this.add.text(0, 0, "< Back", {
      color: "#a0e7ff",
      fontFamily: "monospace",
      fontSize: "14px",
    });
    const backBtn = rex.add.label({
      background: backBg,
      text: backTxt,
    }) as RexUIInternal.Base;
    backBg.setInteractive();
    backBg.on("pointerdown", () => this.backToMenu());

    menu.add(backBtn, { align: "center", padding: { top: 20 } });
    menu.layout();
  }

  toGameplay(): void {
    this.scene.start(SCENE_KEYS.Gameplay);
  }

  backToMenu(): void {
    this.scene.start(SCENE_KEYS.MainMenu);
  }

  /**
   * Pure listing of available mode names from the registry.
   * UI can call this to build a menu without coupling to registry internals.
   */
  listModes(): ReadonlyArray<string> {
    return gameModeRegistry.list();
  }

  /**
   * Select a mode by name and transition into gameplay.
   * Keeps the core pure by dispatching a typed action only.
   */
  selectMode(modeName: string): void {
    dispatch({ mode: modeName, type: "SetMode" });
    this.scene.start(SCENE_KEYS.Gameplay);
  }
}
