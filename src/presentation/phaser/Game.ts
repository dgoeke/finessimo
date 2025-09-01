// Phase 0: Placeholder game factory (no Phaser import yet)
// Intentionally avoids importing external 'phaser' to keep lint/typecheck green
// until dependencies are introduced in later phases.

export type GameHandle = Readonly<{ readonly kind: "PhaserGameHandle" }>;

export function createGame(
  _parent: HTMLElement,
  _width: number,
  _height: number,
): GameHandle {
  // Not constructed in Phase 0; return a sentinel handle
  return { kind: "PhaserGameHandle" } as const;
}
