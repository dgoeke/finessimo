import type { Command } from "../engine/commands";
import type { DomainEvent } from "../engine/events";

/**
 * Sketch of a finesse analysis surface.
 * Callers maintain a per-piece trace of Commands (outside the engine).
 * When the engine emits { kind: "Locked", pieceId }, they finalize the trace and call analyzePiece.
 */
export type FinesseResult = {
  pieceId: number;
  optimal: boolean;
  faults: number;
  notes?: Array<string>;
};

export function analyzePiece(
  pieceId: number,
  _boardAtSpawn: unknown, // TODO: snapshot type
  _targetPlacement: unknown, // TODO: placement type
  _trace: ReadonlyArray<Command>,
  _eventsDuringLife: ReadonlyArray<DomainEvent>,
): FinesseResult {
  // TODO: implement me; this module is outside the engine
  return { faults: 0, optimal: true, pieceId };
}
