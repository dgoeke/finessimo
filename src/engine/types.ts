import { type PieceRandomGenerator } from "./core/rng/interface";
import { createSevenBagRng } from "./core/rng/seeded";
import {
  type Board,
  type PieceId,
  type ActivePiece,
  createBoardCells,
} from "./core/types";

export * from "./core/types";
export type Tick = number & { readonly brand: "Tick" };
export type Q16_16 = number & { readonly brand: "Q16_16" };
export type TickDelta = number & { readonly brand: "TickDelta" };

export { type PieceRandomGenerator } from "./core/rng/interface";
export { createSevenBagRng } from "./core/rng/seeded";

export type RNGState = PieceRandomGenerator;

export type PhysicsState = {
  gravityAccum32: Q16_16; // accumulates cells per tick
  softDropOn: boolean;

  lock: {
    deadlineTick: Tick | null;
    resetCount: number;
  };
};

export type EngineConfig = Readonly<{
  width: 10;
  height: 20;
  previewCount: number;
  lockDelayTicks: TickDelta;
  maxLockResets: number;
  gravity32: Q16_16;
  softDrop32?: Q16_16;
  rngSeed: number;
}>;

export type GameState = {
  readonly cfg: EngineConfig;
  readonly board: Board;
  readonly queue: ReadonlyArray<PieceId>; // TODO: make ring buffer
  readonly hold: { piece: PieceId | null; usedThisTurn: boolean };
  readonly rng: RNGState;
  readonly tick: Tick;
  readonly piece: ActivePiece | null;
  readonly physics: PhysicsState;
};

export function mkInitialState(cfg: EngineConfig, startTick: Tick): GameState {
  const cells = createBoardCells();
  const rng = createSevenBagRng(cfg.rngSeed.toString());

  const queueResult = rng.getNextPieces(cfg.previewCount);

  return {
    board: {
      cells,
      height: 20,
      totalHeight: 23,
      vanishRows: 3,
      width: 10,
    },
    cfg,
    hold: { piece: null, usedThisTurn: false },
    physics: {
      gravityAccum32: 0 as Q16_16,
      lock: { deadlineTick: null, resetCount: 0 },
      softDropOn: false,
    },
    piece: null,
    queue: queueResult.pieces,
    rng: queueResult.newRng,
    tick: startTick,
  };
}
