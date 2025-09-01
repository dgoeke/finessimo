import Phaser from "phaser";

import { SCENES } from "./scenes";

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
    roundPixels: true,
    scale: {
      autoCenter: Phaser.Scale.CENTER_BOTH,
      height,
      mode: Phaser.Scale.FIT,
      width,
    },
    // Register scenes using the typed registry
    scene: SCENES as unknown as Array<Phaser.Types.Scenes.SceneType>,
    type: Phaser.AUTO,
    width,
  };

  return new Phaser.Game(config);
}
