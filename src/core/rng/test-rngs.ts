import { type PieceId } from "../../state/types";

import { type PieceRandomGenerator } from "./interface";

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
