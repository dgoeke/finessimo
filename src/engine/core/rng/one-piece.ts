import { type PieceRandomGenerator } from "@/engine/core/rng/interface";
import { type PieceId } from "@/engine/types";

/**
 * RNG that always returns the same piece.
 * Useful for tests and deterministic scenarios.
 */
export class OnePieceRng implements PieceRandomGenerator {
  constructor(private readonly piece: PieceId) {}

  getNextPiece(): { piece: PieceId; newRng: PieceRandomGenerator } {
    return { newRng: this, piece: this.piece };
  }

  getNextPieces(count: number): {
    pieces: Array<PieceId>;
    newRng: PieceRandomGenerator;
  } {
    return {
      newRng: this,
      pieces: Array(count).fill(this.piece) as Array<PieceId>,
    };
  }
}
