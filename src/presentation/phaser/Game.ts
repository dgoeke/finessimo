import Phaser from "phaser";
// rexUI scene plugin mapping (ESM). Registered via Game config.
import RexUIPlugin from "phaser3-rex-plugins/templates/ui/ui-plugin.js";

import { SCENES_FOR_CONFIG } from "./scenes";

export function createGame(
  parent: HTMLElement,
  width: number,
  height: number,
): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    backgroundColor: "#000000",
    height,
    parent,
    pixelArt: true,
    plugins: {
      scene: [
        {
          key: "rexui",
          mapping: "rexUI",
          plugin: RexUIPlugin,
        },
      ],
    },
    roundPixels: true,
    scale: {
      autoCenter: Phaser.Scale.CENTER_BOTH,
      height,
      mode: Phaser.Scale.FIT,
      width,
    },
    // Register scenes using the typed registry (no unsafe casts)
    scene: SCENES_FOR_CONFIG,
    type: Phaser.AUTO,
    width,
  };

  return new Phaser.Game(config);
}
