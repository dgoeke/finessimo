import type { Keymap } from "./adapter";

// Browser KeyboardEvent.code → InputAction(s)
export const DEFAULT_KBD_MAP: Keymap = new Map([
  // Context-dependent keys (for both menu navigation and gameplay)
  ["ArrowUp", ["NavigateUp", "HardDrop"]], // Up in menus, HardDrop in game
  ["ArrowDown", ["NavigateDown", "SoftDrop"]], // Down in menus, SoftDrop in game
  ["ArrowLeft", ["NavigateLeft", "MoveLeft"]],
  ["ArrowRight", ["NavigateRight", "MoveRight"]],

  // UI keys
  ["Enter", ["Select"]],
  ["Space", ["Select"]],
  ["Escape", ["Back"]],

  // Gameplay-specific keys
  ["KeyZ", ["RotateCCW"]],
  ["KeyX", ["RotateCW"]],
  ["KeyC", ["Hold"]],
  ["ShiftLeft", ["SoftDrop"]],
  ["ShiftRight", ["SoftDrop"]],
]);

// Gamepad mapping
export const DEFAULT_PAD_MAP: Keymap = new Map([
  ["gp:button:0", ["Select"]], // A / Cross
  ["gp:button:1", ["Back"]], // B / Circle
  ["gp:button:12", ["NavigateUp"]],
  ["gp:button:13", ["NavigateDown"]],
  ["gp:button:14", ["NavigateLeft", "MoveLeft"]],
  ["gp:button:15", ["NavigateRight", "MoveRight"]],
  ["gp:button:4", ["Hold"]], // LB
  ["gp:button:5", ["RotateCW"]], // RB
  ["gp:button:2", ["RotateCCW"]], // X / Square
  ["gp:button:3", ["HardDrop"]], // Y / Triangle
  ["gp:axis:0:-", ["NavigateLeft", "MoveLeft"]],
  ["gp:axis:0:+", ["NavigateRight", "MoveRight"]],
  ["gp:axis:1:+", ["NavigateDown"]], // could map to SoftDrop depending on UI
]);
