import { PieceId } from '../state/types';

// Simple seedable RNG state
export interface SevenBagRng {
  seed: string;
  currentBag: PieceId[];
  bagIndex: number;
  internalSeed: number;
}

const ALL_PIECES: PieceId[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

// Create initial RNG state
export function createRng(seed = 'default'): SevenBagRng {
  return {
    seed,
    currentBag: [],
    bagIndex: 0,
    internalSeed: hashString(seed)
  };
}

// Simple string hash function for seeding
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Simple PRNG (Linear Congruential Generator)
function nextRandom(seed: number): number {
  return (seed * 1664525 + 1013904223) % (2 ** 32);
}

// Shuffle array using Fisher-Yates algorithm
function shuffle<T>(array: T[], seed: number): { shuffled: T[], nextSeed: number } {
  const result = [...array];
  let currentSeed = seed;
  
  for (let i = result.length - 1; i > 0; i--) {
    currentSeed = nextRandom(currentSeed);
    const j = currentSeed % (i + 1);
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
export function getNextPiece(rng: SevenBagRng): { piece: PieceId, newRng: SevenBagRng } {
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
    throw new Error('Bag is empty or corrupted');
  }
  
  return {
    piece,
    newRng: {
      ...rng,
      currentBag,
      bagIndex: bagIndex + 1,
      internalSeed
    }
  };
}

// Get multiple pieces at once (for preview queue)
export function getNextPieces(rng: SevenBagRng, count: number): { pieces: PieceId[], newRng: SevenBagRng } {
  const pieces: PieceId[] = [];
  let currentRng = rng;
  
  for (let i = 0; i < count; i++) {
    const result = getNextPiece(currentRng);
    pieces.push(result.piece);
    currentRng = result.newRng;
  }
  
  return { pieces, newRng: currentRng };
}
