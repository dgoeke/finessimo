// PR3: Real Phaser MainMenu scene — typed navigation hooks
import Phaser from "phaser";

import { dispatch } from "../../../state/signals";

import { SCENE_KEYS } from "./types";

export class MainMenu extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.MainMenu });
  }

  create(): void {
    // Build rexUI-based vertical menu
    const w = this.scale.width;
    const h = this.scale.height;

    const header = this.add.text(0, 0, "Finessimo", {
      color: "#ffffff",
      fontFamily: "monospace",
      fontSize: "22px",
    });
    header.setOrigin(0.5, 0.5);

    const menu = this.rexUI.add.sizer({
      orientation: 1, // vertical
      space: { item: 8 },
      x: w / 2,
      y: h / 2,
    });

    // Helper to create a labeled button with interactive background
    const makeButton = (
      label: string,
      onClick: () => void,
    ): RexUIInternal.Base => {
      const bg = this.rexUI.add.roundRectangle(0, 0, 160, 36, 8, 0x223344);
      bg.setOrigin(0.5, 0.5);
      const txt = this.add.text(0, 0, label, {
        color: "#e7eaf0",
        fontFamily: "monospace",
        fontSize: "14px",
      });
      const btn = this.rexUI.add.label({
        background: bg,
        text: txt,
      }) as RexUIInternal.Base;
      bg.setInteractive();
      bg.on("pointerdown", () => onClick());
      return btn;
    };

    menu.add(header, { align: "center" });
    menu.add(makeButton("Start Free Play", () => this.startFreePlay()));
    menu.add(makeButton("Mode Select", () => this.toModeSelect()));
    menu.add(makeButton("Settings", () => this.toSettings()));
    menu.layout();
  }

  toSettings(): void {
    this.scene.start(SCENE_KEYS.Settings);
  }

  toModeSelect(): void {
    this.scene.start(SCENE_KEYS.ModeSelect);
  }

  toGameplay(): void {
    this.scene.start(SCENE_KEYS.Gameplay);
  }

  // --- Convenience shortcuts for common menu actions ---
  startMode(modeName: string): void {
    dispatch({ mode: modeName, type: "SetMode" });
    this.scene.start(SCENE_KEYS.Gameplay);
  }

  startFreePlay(): void {
    this.startMode("freePlay");
  }

  startGuided(): void {
    this.startMode("guided");
  }
}
