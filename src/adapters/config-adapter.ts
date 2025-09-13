/**
 * Helpers for converting player-facing "frames@60" settings to ticks.
 */
export function framesAt60ToTicks(framesAt60: number, TPS: number): number {
  return Math.ceil(framesAt60 * (TPS / 60));
}
export function msToTicks(ms: number, TPS: number): number {
  return Math.ceil((ms / 1000) * TPS);
}
