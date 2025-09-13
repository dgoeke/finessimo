import { type PieceId } from "../types";

/**
 * Interface for piece random generators.
 * This allows us to have different RNG implementations for production and testing.
 */
export type PieceRandomGenerator = {
  /**
   * Get the next piece from this generator
   * Returns the piece and a new generator state (immutable pattern)
   */
  getNextPiece(): {
    piece: PieceId;
    newRng: PieceRandomGenerator;
  };

  /**
   * Get multiple pieces at once (for preview queue)
   * Returns the pieces and a new generator state
   */
  getNextPieces(count: number): {
    pieces: Array<PieceId>;
    newRng: PieceRandomGenerator;
  };
};
