// Phaser presentation layer — core types (brands, ViewModel, RenderPlan, Presenter)
// Phase 0: Skeleton & Contracts. Pure, no Phaser imports.

// Branded primitives (opaque types)
export type Px = number & { readonly __brand: "Px" };
export type Col = number & { readonly __brand: "Col" };
export type Row = number & { readonly __brand: "Row" };
export type Ms = number & { readonly __brand: "Ms" };

// Transition detection flags for state changes
export type Transitions = Readonly<{
  readonly justSpawned: boolean; // piece just appeared
  readonly justLocked: boolean; // piece just locked to board
  readonly linesJustCleared: number; // lines cleared this frame (0 = no lines)
}>;

// ViewModel — pure projection for rendering
export type ViewModel = Readonly<{
  readonly board: ReadonlyArray<ReadonlyArray<number>>; // 0..7 indices, [row][col]
  readonly active?: Readonly<{
    readonly kind: "I" | "J" | "L" | "O" | "S" | "T" | "Z";
    readonly cells: ReadonlyArray<Readonly<{ col: Col; row: Row }>>;
  }>;
  readonly ghost?: Readonly<{
    readonly cells: ReadonlyArray<Readonly<{ col: Col; row: Row }>>;
  }>;
  readonly topOut: boolean;
  readonly hud: Readonly<{
    readonly score: number;
    readonly lines: number;
    readonly mode: string;
  }>;
}> &
  Transitions;

// RenderPlan — discriminated union of drawing/audio/ui commands
export type RenderPlan =
  | Readonly<{
      t: "TileDiff";
      puts: ReadonlyArray<Readonly<{ col: Col; row: Row; frame: number }>>;
      dels: ReadonlyArray<Readonly<{ col: Col; row: Row }>>;
    }>
  | Readonly<{
      t: "PiecePos";
      id: "active" | "ghost";
      xPx: Px;
      yPx: Px;
      cells?: ReadonlyArray<Readonly<{ col: number; row: number }>>;
      kind?: "I" | "J" | "L" | "O" | "S" | "T" | "Z";
    }>
  | Readonly<{
      t: "CameraFx";
      kind: "shake" | "fadeIn" | "fadeOut" | "zoomTo";
      ms: Ms;
      magnitude?: number;
    }>
  | Readonly<{ t: "SoundCue"; name: "spawn" | "lock" | "line" | "topout" }>
  | Readonly<{ t: "UiHint"; name: "showSettings" | "hideSettings" }>
  | Readonly<{ t: "Noop" }>;

// Presenter contract — pure computePlan + impure apply
export type Presenter = Readonly<{
  computePlan(
    vmPrev: ViewModel | null,
    vmNext: ViewModel,
  ): ReadonlyArray<RenderPlan>;
  apply(plan: ReadonlyArray<RenderPlan>): void;
}>;
