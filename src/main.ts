import { SCENE_KEYS } from "./presentation/phaser/scenes/types";

// Main entry point
async function main(): Promise<void> {
  // Starting Finessimo - Tetris Finesse Trainer (Phaser mode)

  // Ensure html/body fill viewport and prevent scrollbars
  Object.assign(document.documentElement.style, {
    height: "100%",
    margin: "0",
    padding: "0",
    width: "100%",
  });
  Object.assign(document.body.style, {
    height: "100vh",
    margin: "0",
    overflow: "hidden",
    padding: "0",
    width: "100vw",
  });

  const root = document.getElementById("app") ?? document.body;
  // Light skeleton for faster First Contentful Paint
  root.textContent = "Loading engine…";
  // Dynamically import Phaser game to avoid eager loading heavy chunks
  const { createGame } = await import("./presentation/phaser/Game");
  const game = createGame(root, innerWidth, innerHeight);

  const handleResize = (): void => {
    game.scale.resize(innerWidth, innerHeight);
  };
  window.addEventListener("resize", handleResize);

  // Clean up handler on game destroy
  game.events.once("destroy", () => {
    window.removeEventListener("resize", handleResize);
  });

  // Scenes are registered in Game.ts; start Boot
  game.scene.start(SCENE_KEYS.Boot);
}

// Start the application
void main();
