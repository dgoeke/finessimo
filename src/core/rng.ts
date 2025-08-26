import { type PieceId } from "../state/types";

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
    const temp = result[i];
    const otherTemp = result[j];
    if (temp !== undefined && otherTemp !== undefined) {
      result[i] = otherTemp;
      result[j] = temp;
    }
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
