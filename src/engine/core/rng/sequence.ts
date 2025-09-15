import { type PieceRandomGenerator } from "@/engine/core/rng/interface";
import { type PieceId } from "@/engine/types";

/**
 * RNG that yields a fixed sequence and then repeats.
 * Each call returns a new RNG instance with advanced index (immutable style).
 */
export class SequenceRng implements PieceRandomGenerator {
  constructor(
    private readonly sequence: Array<PieceId>,
    private readonly index = 0,
  ) {
    if (sequence.length === 0) throw new Error("Sequence must not be empty");
  }

  getNextPiece(): { piece: PieceId; newRng: PieceRandomGenerator } {
    const piece = this.sequence[this.index];
    if (piece === undefined) throw new Error("Sequence index out of bounds");
    const nextIndex = (this.index + 1) % this.sequence.length;
    return { newRng: new SequenceRng(this.sequence, nextIndex), piece };
  }

  getNextPieces(count: number): {
    pieces: Array<PieceId>;
    newRng: PieceRandomGenerator;
  } {
    const pieces: Array<PieceId> = [];
    let i = this.index;
    for (let c = 0; c < count; c++) {
      const piece = this.sequence[i];
      if (piece === undefined) throw new Error("Sequence index out of bounds");
      pieces.push(piece);
      i = (i + 1) % this.sequence.length;
    }
    return { newRng: new SequenceRng(this.sequence, i), pieces };
  }
}
