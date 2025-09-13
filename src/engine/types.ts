// Basic branded Tick
export type Tick = number & { readonly brand: "Tick" };

// Fixed-point Q16.16 helpers (see utils)
export type Q16_16 = number & { readonly brand: "Q16_16" };

// Board/Piece basics (skeleton)
export type Cell = 0 | 1; // TODO: include color/type if needed
export type Board = {
  readonly width: number;
  readonly height: number;
  readonly cells: Uint8Array; // width * height
};

export type PieceKind = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
export type Rotation = 0 | 1 | 2 | 3;

export type ActivePiece = {
  readonly id: number;
  kind: PieceKind;
  rot: Rotation;
  x: number;
  y: number;
};

export type RNGState = {
  seed: number;
  // TODO: bag7 & prng impl
};

export type PhysicsState = {
  gravityAccum32: Q16_16; // accumulates cells per tick
  softDropOn: boolean;
  grounded: boolean;

  // Lock-delay state
  lock: {
    deadlineTick: Tick | null;
    resetCount: number;
  };
};

export type EngineConfig = Readonly<{
  width: number;
  height: number;
  previewCount: number;
  lockDelayTicks: number;
  maxLockResets: number;
  gravity32: Q16_16;
  softDrop32?: Q16_16;
  rngSeed: number;
}>;

export type GameState = {
  readonly cfg: EngineConfig;
  readonly board: Board;
  readonly queue: ReadonlyArray<PieceKind>; // TODO: make ring buffer
  readonly hold: { piece: PieceKind | null; usedThisTurn: boolean };
  readonly rng: RNGState;
  readonly tick: Tick;
  readonly piece: ActivePiece | null;
  readonly physics: PhysicsState;
  // Any other stats you need
};

export function mkInitialState(cfg: EngineConfig, startTick: Tick): GameState {
  const cells = new Uint8Array(cfg.width * cfg.height);
  return {
    board: { cells, height: cfg.height, width: cfg.width },
    cfg,
    hold: { piece: null, usedThisTurn: false },
    physics: {
      gravityAccum32: 0 as Q16_16,
      grounded: false,
      lock: { deadlineTick: null, resetCount: 0 },
      softDropOn: false,
    },
    piece: null,
    queue: [],
    rng: { seed: cfg.rngSeed },
    tick: startTick,
  };
}
