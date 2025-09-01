// Phase 4: Phaser Input Adapter interface (no Phaser import)
// Pure mapping boundary; in real scene, this would read keys/gamepad.

import type { Action } from "../../../state/types";
import type { Ms } from "../presenter/types";

export type PhaserInputAdapter = Readonly<{
  drainActions(dt: Ms): ReadonlyArray<Action>;
}>;
