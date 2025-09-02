// Phase 7: Results scene — animated counters & particle effects
import Phaser from "phaser";

import { percentageAsNumber, unbrandedMsAsNumber } from "../../../types/brands";

import { SCENE_KEYS } from "./types";

import type { Percentage, UnbrandedMs } from "../../../types/brands";

// Summary data projected from GameState.stats by the caller.
export type ResultsSummary = Readonly<{
  linesCleared: number;
  piecesPlaced: number;
  accuracyPercentage: Percentage; // 0..100 enforced at construction
  timePlayedMs: UnbrandedMs; // Explicit unbranding marker
}>;

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
    ): {
      setInteractive(): void;
      on(e: string, cb: () => void): void;
    };
    label(config: {
      background: unknown;
      text: unknown;
      x?: number;
      y?: number;
    }): unknown;
  };
};

export class Results extends Phaser.Scene {
  private _summary: ResultsSummary | null = null;
  private _counters = new Map<string, Phaser.GameObjects.Text>();
  private _particles: Phaser.GameObjects.Particles.ParticleEmitter | null =
    null;

  constructor() {
    super({ key: SCENE_KEYS.Results });
  }

  init(data?: { summary?: ResultsSummary }): void {
    // Receive summary data from Gameplay scene
    this._summary = data?.summary ?? null;
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    // Title
    const title = this.add.text(w / 2, 60, "Results", {
      color: "#ffffff",
      fontFamily: "monospace",
      fontSize: "24px",
    });
    title.setOrigin(0.5, 0.5);

    // Create counter displays
    const createCounter = (
      label: string,
      y: number,
    ): Phaser.GameObjects.Text => {
      const labelText = this.add.text(w / 2 - 100, y, `${label}:`, {
        color: "#a0a0a0",
        fontFamily: "monospace",
        fontSize: "16px",
      });
      labelText.setOrigin(1, 0.5);

      const valueText = this.add.text(w / 2 + 20, y, "0", {
        color: "#ffffff",
        fontFamily: "monospace",
        fontSize: "20px",
      });
      valueText.setOrigin(0, 0.5);
      return valueText;
    };

    // Create stat counters
    this._counters.set("lines", createCounter("Lines", 140));
    this._counters.set("pieces", createCounter("Pieces", 180));
    this._counters.set("accuracy", createCounter("Accuracy", 220));
    this._counters.set("time", createCounter("Time", 260));

    // Create buttons using rexUI
    const rex = this.rexUI as RexUiPlugin;
    const buttonY = h - 100;

    // Retry button
    const retryBg = rex.add.roundRectangle(0, 0, 120, 40, 8, 0x224488);
    const retryText = this.add.text(0, 0, "Retry", {
      color: "#ffffff",
      fontFamily: "monospace",
      fontSize: "16px",
    });
    rex.add.label({
      background: retryBg,
      text: retryText,
      x: w / 2 - 80,
      y: buttonY,
    });
    retryBg.setInteractive();
    retryBg.on("pointerdown", () => this.retry());

    // Menu button
    const menuBg = rex.add.roundRectangle(0, 0, 120, 40, 8, 0x223344);
    const menuText = this.add.text(0, 0, "Menu", {
      color: "#ffffff",
      fontFamily: "monospace",
      fontSize: "16px",
    });
    rex.add.label({
      background: menuBg,
      text: menuText,
      x: w / 2 + 80,
      y: buttonY,
    });
    menuBg.setInteractive();
    menuBg.on("pointerdown", () => this.backToMenu());

    // Create particle emitter for celebration
    const particles = this.add.particles(0, 0, "tiles", {
      alpha: { end: 0, start: 1 },
      angle: { max: 360, min: 0 },
      blendMode: "ADD",
      lifespan: 2000,
      quantity: 2,
      radial: true,
      scale: { end: 0, start: 0.5 },
      speed: { max: 300, min: 100 },
      tint: [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff],
      x: w / 2,
      y: h / 2,
    });
    this._particles = particles;
    particles.stop();

    // Animate counters if we have summary data
    if (this._summary) {
      this.showResults(this._summary);
    }
  }

  private showResults(summary: ResultsSummary): void {
    const duration = 800; // ms per counter

    // Animate lines counter
    const linesCounter = this._counters.get("lines");
    if (linesCounter) {
      this.tweens.addCounter({
        duration,
        from: 0,
        onUpdate: (tween) => {
          linesCounter.setText(Math.floor(tween.getValue() ?? 0).toString());
        },
        to: summary.linesCleared,
      });
    }

    // Animate pieces counter
    const piecesCounter = this._counters.get("pieces");
    if (piecesCounter) {
      this.tweens.addCounter({
        delay: 200,
        duration,
        from: 0,
        onUpdate: (tween) => {
          piecesCounter.setText(Math.floor(tween.getValue() ?? 0).toString());
        },
        to: summary.piecesPlaced,
      });
    }

    // Animate accuracy counter
    const accuracyCounter = this._counters.get("accuracy");
    if (accuracyCounter) {
      this.tweens.addCounter({
        delay: 400,
        duration,
        from: 0,
        onUpdate: (tween) => {
          const val = Math.floor(tween.getValue() ?? 0);
          accuracyCounter.setText(`${String(val)}%`);
        },
        to: Math.round(percentageAsNumber(summary.accuracyPercentage)),
      });
    }

    // Animate time counter
    const timeCounter = this._counters.get("time");
    if (timeCounter) {
      const seconds =
        Math.floor(unbrandedMsAsNumber(summary.timePlayedMs)) / 1000;
      this.tweens.addCounter({
        delay: 600,
        duration,
        from: 0,
        onUpdate: (tween) => {
          const totalSecs = Math.floor(tween.getValue() ?? 0);
          const m = Math.floor(totalSecs / 60);
          const s = totalSecs % 60;
          timeCounter.setText(`${String(m)}:${String(s).padStart(2, "0")}`);
        },
        to: Math.floor(seconds),
      });
    }

    // Emit celebration particles
    if (this._particles) {
      this._particles.start();
      this.time.delayedCall(3000, () => {
        this._particles?.stop();
      });
    }
  }

  retry(): void {
    // Restart gameplay with same mode
    this.scene.start(SCENE_KEYS.Gameplay);
  }

  backToMenu(): void {
    this.scene.start(SCENE_KEYS.MainMenu);
  }
}
