import type { FinesseAction } from "../../state/types";

/**
 * Authoritative mapping of finesse actions to their Unicode icon representations.
 * Used across the UI for consistent visual representation of finesse sequences.
 */
export const FINESSE_ACTION_ICONS: Record<FinesseAction, string> = {
  DASLeft: "⇤",
  DASRight: "⇥",
  HardDrop: "⤓",
  MoveLeft: "←",
  MoveRight: "→",
  RotateCCW: "↺",
  RotateCW: "↻",
  SoftDrop: "⇩",
} as const;

/**
 * Get the icon representation for a finesse action.
 * @param action The finesse action to get the icon for
 * @returns Unicode icon string
 */
export function getActionIcon(action: FinesseAction): string {
  return FINESSE_ACTION_ICONS[action];
}
