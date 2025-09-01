// Phase 4: Phaser Input Adapter interface (no Phaser import)
// Pure mapping boundary; in real scene, this would read keys/gamepad.

import type { DASEvent } from "../../../input/machines/das";
import type { Action } from "../../../state/types";
import type { Ms } from "../presenter/types";

export type InputEvent = DASEvent | Action;

export type PhaserInputAdapter = Readonly<{
  drainEvents(dt: Ms): ReadonlyArray<InputEvent>;
}>;
