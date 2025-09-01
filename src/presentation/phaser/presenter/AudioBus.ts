// Phase 5: Audio bus adapter (no Phaser import)
// Maps SoundCue plan entries to underlying audio system (Phaser SoundManager in real scene).

export type AudioBus = Readonly<{
  play(name: "spawn" | "lock" | "line" | "topout"): void;
}>;
