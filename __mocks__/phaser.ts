// Minimal Jest manual mock for Phaser used in presenter scene tests
// Provides just enough surface for instantiating a Scene and calling scene.start

class MockScenePlugin {
  // Return self for chaining in tests; signature matches Phaser's ScenePlugin.start
  start(_key?: unknown, _data?: unknown): MockScenePlugin {
    return this;
  }
}

class MockScene {
  public scale = { width: 0, height: 0 } as const;
  public add = {
    text: (_x: number, _y: number, _t: string, _s?: unknown) => ({
      setOrigin: (_ox: number, _oy: number) => void 0,
      setText: (_nt: string) => void 0,
    }),
  } as const;
  public load = { on: (_e: string, _cb: (..._a: unknown[]) => void) => void 0 } as const;
  public scene = new MockScenePlugin();
  // accept optional config to mirror Phaser.Scene constructor
  constructor(_config?: unknown) {}
}

const PhaserMock = {
  AUTO: 0,
  Scale: { CENTER_BOTH: 1, FIT: 2 },
  Scene: MockScene,
} as const;

export default PhaserMock as unknown as typeof import("phaser");

