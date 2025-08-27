import { type PieceId } from "../state/types";

import { type PieceRandomGenerator } from "./rng-interface";

/**
 * Test RNG that always returns the same piece.
 * Useful for testing specific scenarios.
 */
export class OnePieceRng implements PieceRandomGenerator {
  constructor(private readonly piece: PieceId) {}

  getNextPiece(): {
    piece: PieceId;
    newRng: PieceRandomGenerator;
  } {
    return {
      newRng: this, // Always return the same generator
      piece: this.piece,
    };
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
 * Test RNG that returns pieces in a specific sequence, then repeats.
 * Useful for testing specific piece sequences.
 */
export class SequenceRng implements PieceRandomGenerator {
  constructor(
    private readonly sequence: Array<PieceId>,
    private readonly index = 0,
  ) {
    if (sequence.length === 0) {
      throw new Error("Sequence must not be empty");
    }
  }

  getNextPiece(): {
    piece: PieceId;
    newRng: PieceRandomGenerator;
  } {
    const piece = this.sequence[this.index];
    if (piece === undefined) {
      throw new Error("Sequence index out of bounds");
    }
    const nextIndex = (this.index + 1) % this.sequence.length;
    return {
      newRng: new SequenceRng(this.sequence, nextIndex),
      piece,
    };
  }

  getNextPieces(count: number): {
    pieces: Array<PieceId>;
    newRng: PieceRandomGenerator;
  } {
    const pieces: Array<PieceId> = [];
    let currentIndex = this.index;

    for (let i = 0; i < count; i++) {
      const piece = this.sequence[currentIndex];
      if (piece === undefined) {
        throw new Error("Sequence index out of bounds");
      }
      pieces.push(piece);
      currentIndex = (currentIndex + 1) % this.sequence.length;
    }

    return {
      newRng: new SequenceRng(this.sequence, currentIndex),
      pieces,
    };
  }
}
