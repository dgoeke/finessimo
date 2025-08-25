Library considerations:

[ ] Add Robot for game state + tinykeys for input
[ ] Pick Lit for DOM rendering
[ ] Add ts-pattern for reducer

---

Symptom

- After placing a piece with an optimal “hold to wall + hard drop,” finesse feedback still appears, showing the same minimal sequence
  as a suggestion, implying your input was suboptimal.

Pipeline Involved

- Input → InputProcessor emits processed actions → Reducer updates state and logs → FinesseService runs on lock → Extracts “finesse
  actions” from processed log → BFS calculator returns minimal sequences → Result compared and UI shows feedback if not optimal.

Key Components

- src/input/handler.ts: Emits on KeyDown an immediate move { type: 'Move', source: 'tap' }, then, after DAS/ARR timing, emits { type:
  'Move', source: 'das' } pulses.
- src/state/reducer.ts: Stores processedInputLog (stream of { action, timestamp }).
- src/finesse/calculator.ts: - extractFinesseActions(processedInputLog): Maps processed actions to abstract FinesseActions (MoveLeft/Right, DASLeft/Right,
  Rotate*, HardDrop). Coalesces consecutive DAS pulses by direction via currentDASDirection. - calculateOptimal(...): BFS from spawn using abstract actions; “hold to wall” is a single DAS* action, not a Tap followed by DAS. - analyze(...): Compares player sequence length to minimal length; flags extra_input if longer.
- src/finesse/service.ts: On lock, sets target (guided target or actual final), builds a spawn-piece origin, calls
  extractFinesseActions and analyze, and if isOptimal is false, passes the first optimal sequence to the UI.

Root Cause (Mismatch)

- For a real “hold to wall” in gameplay:
  - InputProcessor produces both a tap move (on KeyDown) and later DAS pulses for the same continuous press.
  - extractFinesseActions currently:
  - Pushes `MoveLeft`/`MoveRight` for the tap.
  - When the first `das` pulse arrives in the same direction, it also pushes `DASLeft`/`DASRight` (it only coalesces subsequent DAS
- Therefore, a single continuous hold is represented as two finesse actions: [MoveLeft, DASLeft, HardDrop].
- BFS minimal sequences model hold as one abstract input: [DASLeft, HardDrop].

Concrete Example (Sequence)

- Player holds left then hard drops.
  - Processed log: [Move(tap,-1), Move(das,-1), Move(das,-1), ..., HardDrop].
  - Extracted finesse sequence: [MoveLeft, DASLeft, HardDrop] (tap kept, first DAS added; later DAS coalesced).
  - BFS optimal: [DASLeft, HardDrop] (single hold action).
- Comparison by length:
  - Player length = 3; optimal length = 2 → isOptimal = false with extra_input fault.

Consequences

- FinesseService sets optimalSequence (e.g., [DASLeft, HardDrop]) and isOptimal = false.
- UI (src/ui/finesse-feedback.ts) shows the suggested sequence whenever isOptimal === false, so it displays the same conceptual move
  (hold to wall) even though the player executed it optimally, creating the perception that the app is contradicting itself.
- Stats increment as non-optimal with an “extra_input” fault despite correct play.

Scope of the Disconnect

- The discrepancy originates in the translation layer (extractFinesseActions) between processed game actions and abstract finesse
  actions. It treats a continuous “hold” as both a tap and a DAS, whereas the BFS model treats it as a single DAS input.
