import { tryMove } from "../../core/board";

// Movement actions are separated by input classification (Tap/Hold/Repeat)
// even though reducers are identical. Upstream classification matters for
// analytics, ARR/DAS behavior, and lock-delay reset semantics.

import type { GameState, Action } from "../../state/types";

export const handlers = {
  HoldMove: (
    s: GameState,
    a: Extract<Action, { type: "HoldMove" }>,
  ): GameState => {
    if (s.active === undefined) {
      return s;
    }

    const stepped = tryMove(s.board, s.active, a.dir, 0);
    if (!stepped) {
      return s;
    }

    return {
      ...s,
      active: stepped,
    };
  },

  RepeatMove: (
    s: GameState,
    a: Extract<Action, { type: "RepeatMove" }>,
  ): GameState => {
    if (s.active === undefined) {
      return s;
    }

    const stepped = tryMove(s.board, s.active, a.dir, 0);
    if (!stepped) {
      return s;
    }

    return {
      ...s,
      active: stepped,
    };
  },

  TapMove: (
    s: GameState,
    a: Extract<Action, { type: "TapMove" }>,
  ): GameState => {
    if (s.active === undefined) {
      return s;
    }

    const stepped = tryMove(s.board, s.active, a.dir, 0);
    if (!stepped) {
      return s;
    }

    return {
      ...s,
      active: stepped,
    };
  },
} as const;
