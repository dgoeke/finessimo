// Phase 5: Camera FX adapter (no Phaser import)
// Defines a thin, impure boundary for camera/post FX. Implementations live in Phaser scene code.

import type { Ms } from "./types";

export type CameraFxAdapter = Readonly<{
  fadeIn(duration: Ms): void;
  fadeOut(duration: Ms): void;
  shake(duration: Ms, intensity?: number): void;
  zoomTo(duration: Ms, zoom: number): void;
}>;
