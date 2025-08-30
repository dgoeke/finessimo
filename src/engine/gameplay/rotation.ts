import { tryRotate, getNextRotation } from "../../core/srs";

import type { GameState, Action } from "../../state/types";

export const handlers = {
  Rotate: (s: GameState, a: Extract<Action, { type: "Rotate" }>): GameState => {
    if (!s.active) return s;

    const targetRot = getNextRotation(s.active.rot, a.dir);
    const rotated = tryRotate(s.active, targetRot, s.board);

    if (!rotated) return s;

    return {
      ...s,
      active: rotated,
    };
  },
} as const;
