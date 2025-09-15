export type ModeEffect =
  | {
      kind: "Message";
      level: "info" | "success" | "warning" | "error";
      text: string;
    }
  | { kind: "HighlightCells"; cells: ReadonlyArray<{ x: number; y: number }> }
  | { kind: "GhostPlacement"; x: number; rot: 0 | 1 | 2 | 3 }
  | { kind: "PlaySound"; name: "success" | "fail" | "tick" | "clear" }
  | { kind: "ScenarioAdvanced"; index: number }
  | { kind: "ShowHint"; hint: string };
