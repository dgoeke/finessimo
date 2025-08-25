import { PieceId } from "../state/types";

// Simple seedable RNG state
export interface SevenBagRng {
  seed: string;
  currentBag: PieceId[];
  bagIndex: number;
  internalSeed: number;
}

const ALL_PIECES: PieceId[] = ["I", "O", "T", "S", "Z", "J", "L"];

// Create initial RNG state
export function createRng(seed = "default"): SevenBagRng {
  return {
    seed,
    currentBag: [],
    bagIndex: 0,
    internalSeed: hashString(seed),
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
  array: T[],
  seed: number,
): { shuffled: T[]; nextSeed: number } {
  const result = [...array];
  let currentSeed = seed;

  for (let i = result.length - 1; i > 0; i--) {
    currentSeed = nextRandom(currentSeed);
    // Use high bits mapped to [0, i] to reduce modulo bias
    const j = Math.floor(((currentSeed >>> 0) / 4294967296) * (i + 1));
    const temp = result[i];
    const otherTemp = result[j];
    if (temp !== undefined && otherTemp !== undefined) {
      result[i] = otherTemp;
      result[j] = temp;
    }
  }

  return { shuffled: result, nextSeed: currentSeed };
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
    piece,
    newRng: {
      ...rng,
      currentBag,
      bagIndex: bagIndex + 1,
      internalSeed,
    },
  };
}

// Get multiple pieces at once (for preview queue)
export function getNextPieces(
  rng: SevenBagRng,
  count: number,
): { pieces: PieceId[]; newRng: SevenBagRng } {
  const pieces: PieceId[] = [];
  let currentRng = rng;

  for (let i = 0; i < count; i++) {
    const result = getNextPiece(currentRng);
    pieces.push(result.piece);
    currentRng = result.newRng;
  }

  return { pieces, newRng: currentRng };
}
