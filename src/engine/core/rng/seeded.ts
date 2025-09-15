import { type PieceRandomGenerator } from "@/engine/core/rng/interface";
import { type PieceId } from "@/engine/types";

// Simple seedable RNG state
export type SevenBagRng = {
  seed: string;
  currentBag: Array<PieceId>;
  bagIndex: number;
  internalSeed: number;
};

const ALL_PIECES: Array<PieceId> = ["I", "O", "T", "S", "Z", "J", "L"];

// Create initial RNG state
export function createRng(seed = "default"): SevenBagRng {
  return {
    bagIndex: 0,
    currentBag: [],
    internalSeed: hashString(seed),
    seed,
  };
}

// Simple string hash (FNV-1a, 32-bit) for stable seeds
function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0; // unsigned 32-bit
}

// Simple PRNG (Linear Congruential Generator)
function nextRandom(seed: number): number {
  return (seed * 1664525 + 1013904223) % 2 ** 32;
}

// Shuffle array using Fisher-Yates algorithm
function shuffle<T>(
  array: Array<T>,
  seed: number,
): { shuffled: Array<T>; nextSeed: number } {
  const result = [...array];
  let currentSeed = seed;

  for (let i = result.length - 1; i > 0; i--) {
    currentSeed = nextRandom(currentSeed);
    // Use high bits mapped to [0, i] to reduce modulo bias
    const j = Math.floor(((currentSeed >>> 0) / 4294967296) * (i + 1));
    const temp = result[i] as T;
    const otherTemp = result[j] as T;
    // Both temp and otherTemp are always defined since we operate on a complete array
    // with valid indices (i from length-1 to 1, j from 0 to i)
    result[i] = otherTemp;
    result[j] = temp;
  }

  return { nextSeed: currentSeed, shuffled: result };
}

// Get next piece from the 7-bag
export function getNextPiece(rng: SevenBagRng): {
  piece: PieceId;
  newRng: SevenBagRng;
} {
  let currentBag = rng.currentBag;
  let bagIndex = rng.bagIndex;
  let internalSeed = rng.internalSeed;

  // If we've exhausted the current bag, create a new one
  if (bagIndex >= currentBag.length) {
    const shuffleResult = shuffle(ALL_PIECES, internalSeed);
    currentBag = shuffleResult.shuffled;
    internalSeed = shuffleResult.nextSeed;
    bagIndex = 0;
  }

  const piece = currentBag[bagIndex];
  if (piece === undefined) {
    throw new Error("Bag is empty or corrupted");
  }

  return {
    newRng: {
      ...rng,
      bagIndex: bagIndex + 1,
      currentBag,
      internalSeed,
    },
    piece,
  };
}

// Get multiple pieces at once (for preview queue)
export function getNextPieces(
  rng: SevenBagRng,
  count: number,
): { pieces: Array<PieceId>; newRng: SevenBagRng } {
  const pieces: Array<PieceId> = [];
  let currentRng = rng;

  for (let i = 0; i < count; i++) {
    const result = getNextPiece(currentRng);
    pieces.push(result.piece);
    currentRng = result.newRng;
  }

  return { newRng: currentRng, pieces };
}

/**
 * Wrapper class that implements PieceRandomGenerator interface for SevenBagRng
 */
export class SevenBagRngImpl implements PieceRandomGenerator {
  constructor(private state: SevenBagRng) {}

  getNextPiece(): {
    piece: PieceId;
    newRng: PieceRandomGenerator;
  } {
    const result = getNextPiece(this.state);
    return {
      newRng: new SevenBagRngImpl(result.newRng),
      piece: result.piece,
    };
  }

  getNextPieces(count: number): {
    pieces: Array<PieceId>;
    newRng: PieceRandomGenerator;
  } {
    const result = getNextPieces(this.state, count);
    return {
      newRng: new SevenBagRngImpl(result.newRng),
      pieces: result.pieces,
    };
  }

  /**
   * Get the internal state (for compatibility with existing code)
   */
  getState(): SevenBagRng {
    return this.state;
  }
}

/**
 * Create a new SevenBagRng generator with the interface
 */
export function createSevenBagRng(seed = "default"): PieceRandomGenerator {
  return new SevenBagRngImpl(createRng(seed));
}
