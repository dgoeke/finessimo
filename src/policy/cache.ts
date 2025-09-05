// Cache implementation for Chapter 4 of the opener training system
// Provides memoization caches for expensive policy computations

import { idx } from "../state/types";
import { createGridCoord, gridCoordAsNumber } from "../types/brands";

import type { Template, Placement } from "./types";
import type { GameState, Board } from "../state/types";

// Cache key brands for type safety
declare const CacheKeyBrand: unique symbol;
export type CacheKey = string & { readonly [CacheKeyBrand]: true };

declare const PreviewSignatureBrand: unique symbol;
export type PreviewSignature = string & {
  readonly [PreviewSignatureBrand]: true;
};

declare const BoardSignatureBrand: unique symbol;
export type BoardSignature = string & { readonly [BoardSignatureBrand]: true };

// Cache key constructors
export function createCacheKey(value: string): CacheKey {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("CacheKey must be a non-empty string");
  }
  return value as CacheKey;
}

export function createPreviewSignature(value: string): PreviewSignature {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("PreviewSignature must be a non-empty string");
  }
  return value as PreviewSignature;
}

export function createBoardSignature(value: string): BoardSignature {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("BoardSignature must be a non-empty string");
  }
  return value as BoardSignature;
}

// Board feature analysis result
export type BoardFeatures = Readonly<{
  columnHeights: ReadonlyArray<number>;
  holes: ReadonlyArray<readonly [number, number]>; // [x, y] pairs
  overhangs: ReadonlyArray<readonly [number, number]>; // [x, y] pairs
  wells: ReadonlyArray<readonly [number, number]>; // [x, depth] pairs
  maxHeight: number;
  minHeight: number;
  heightVariance: number;
  signature: BoardSignature;
}>;

// Template precondition evaluation result
export type PreconditionResult = Readonly<{
  feasible: boolean;
  notes: ReadonlyArray<string>;
  scoreDelta?: number;
  signature: CacheKey;
}>;

// LRU Cache implementation with branded keys
class LRUCache<K extends string, V> {
  private readonly maxSize: number;
  private readonly cache = new Map<K, V>();
  private readonly accessOrder = new Array<K>();

  constructor(maxSize = 100) {
    if (maxSize <= 0) {
      throw new Error("LRUCache maxSize must be positive");
    }
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.moveToEnd(key);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      // Update existing entry
      this.cache.set(key, value);
      this.moveToEnd(key);
    } else {
      // Add new entry
      if (this.cache.size >= this.maxSize) {
        this.evictOldest();
      }
      this.cache.set(key, value);
      this.accessOrder.push(key);
    }
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder.length = 0;
  }

  size(): number {
    return this.cache.size;
  }

  private moveToEnd(key: K): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
      this.accessOrder.push(key);
    }
  }

  private evictOldest(): void {
    const oldest = this.accessOrder.shift();
    if (oldest !== undefined) {
      this.cache.delete(oldest);
    }
  }
}

// Global caches with different sizes based on expected usage
const previewSignatureCache = new LRUCache<PreviewSignature, unknown>(200);
const boardFeatureCache = new LRUCache<BoardSignature, BoardFeatures>(100);
const preconditionCache = new LRUCache<CacheKey, PreconditionResult>(300);

/**
 * Create a preview signature for cache keys
 * Format: "piece1,piece2,piece3|hold:holdPiece|depth:N"
 */
export function createPreviewSignatureFromQueue(
  queue: ReadonlyArray<string>,
  hold: string | null,
  lookahead: number,
): PreviewSignature {
  if (lookahead < 0) {
    throw new Error("Lookahead must be non-negative");
  }

  const queuePart = queue.slice(0, lookahead).join(",");
  const holdPart = hold !== null ? `hold:${hold}` : "hold:null";
  const depthPart = `depth:${String(lookahead)}`;

  return createPreviewSignature(`${queuePart}|${holdPart}|${depthPart}`);
}

/**
 * Create a board signature from structural features
 * Uses column heights and key structural elements for fast comparison
 */
export function createBoardSignatureFromState(board: Board): BoardSignature {
  const heights = calculateColumnHeights(board);
  const heightsStr = heights.join(",");

  // Add checksum of filled cells for collision detection
  let checksum = 0;
  for (let i = 0; i < board.cells.length; i++) {
    const cellValue = board.cells[i];
    if (cellValue !== undefined && cellValue !== 0) {
      checksum = (checksum * 31 + i + cellValue) % 1000000007;
    }
  }

  return createBoardSignature(`h:${heightsStr}|c:${String(checksum)}`);
}

/**
 * Calculate column heights for board analysis
 */
function calculateColumnHeights(board: Board): ReadonlyArray<number> {
  const heights = new Array<number>(board.width).fill(0);

  for (let x = 0; x < board.width; x++) {
    for (let y = 0; y < board.height; y++) {
      const cell =
        board.cells[idx(board, createGridCoord(x), createGridCoord(y))];
      if (cell !== 0) {
        heights[x] = board.height - y;
        break;
      }
    }
  }

  return heights;
}

/**
 * Detect holes in the board (empty cells with filled cells above)
 */
function detectHoles(board: Board): ReadonlyArray<readonly [number, number]> {
  const holes: Array<readonly [number, number]> = [];

  for (let x = 0; x < board.width; x++) {
    let foundFilled = false;
    for (let y = 0; y < board.height; y++) {
      const cell =
        board.cells[idx(board, createGridCoord(x), createGridCoord(y))];
      if (cell !== 0) {
        foundFilled = true;
      } else if (foundFilled) {
        holes.push([x, y] as const);
      }
    }
  }

  return holes;
}

/**
 * Check if a position has overhang characteristics
 */
function isOverhang(board: Board, x: number, y: number): boolean {
  const cell = board.cells[idx(board, createGridCoord(x), createGridCoord(y))];
  if (cell === 0) return false;

  // Check if there's an empty space below in adjacent columns
  const leftBelow =
    board.cells[idx(board, createGridCoord(x - 1), createGridCoord(y + 1))];
  const rightBelow =
    board.cells[idx(board, createGridCoord(x + 1), createGridCoord(y + 1))];
  const hasEmptyLeftBelow = leftBelow === 0;
  const hasEmptyRightBelow = rightBelow === 0;

  return hasEmptyLeftBelow || hasEmptyRightBelow;
}

/**
 * Detect overhangs (filled cells with empty cells below in adjacent columns)
 */
function detectOverhangs(
  board: Board,
): ReadonlyArray<readonly [number, number]> {
  const overhangs: Array<readonly [number, number]> = [];

  for (let x = 1; x < board.width - 1; x++) {
    for (let y = 1; y < board.height; y++) {
      if (isOverhang(board, x, y)) {
        overhangs.push([x, y] as const);
      }
    }
  }

  return overhangs;
}

/**
 * Detect wells (empty vertical spaces between filled columns)
 */
function detectWells(
  board: Board,
  heights: ReadonlyArray<number>,
): ReadonlyArray<readonly [number, number]> {
  const wells: Array<readonly [number, number]> = [];

  for (let x = 0; x < board.width; x++) {
    const leftHeight = x > 0 ? (heights[x - 1] ?? 0) : 0;
    const rightHeight = x < board.width - 1 ? (heights[x + 1] ?? 0) : 0;
    const currentHeight = heights[x] ?? 0;

    if (leftHeight > currentHeight && rightHeight > currentHeight) {
      const depth = Math.min(leftHeight, rightHeight) - currentHeight;
      if (depth > 0) {
        wells.push([x, depth] as const);
      }
    }
  }

  return wells;
}

/**
 * Calculate height variance for board stability analysis
 */
function calculateHeightVariance(heights: ReadonlyArray<number>): number {
  if (heights.length === 0) return 0;

  const mean = heights.reduce((sum, h) => sum + h, 0) / heights.length;
  const variance =
    heights.reduce((sum, h) => sum + Math.pow(h - mean, 2), 0) / heights.length;

  return Math.sqrt(variance);
}

/**
 * Get or compute board features with caching
 */
export function getBoardFeatures(state: GameState): BoardFeatures {
  if (state.status !== "playing" && state.status !== "resolvingLock") {
    // For non-playing states, compute features directly without caching
    return computeBoardFeatures(state.board);
  }

  const signature = createBoardSignatureFromState(state.board);

  const cached = boardFeatureCache.get(signature);
  if (cached !== undefined) {
    return cached;
  }

  const features = computeBoardFeatures(state.board);
  boardFeatureCache.set(signature, features);

  return features;
}

/**
 * Compute board features directly (used by getBoardFeatures)
 */
function computeBoardFeatures(board: Board): BoardFeatures {
  const heights = calculateColumnHeights(board);
  const holes = detectHoles(board);
  const overhangs = detectOverhangs(board);
  const wells = detectWells(board, heights);

  const maxHeight = Math.max(...heights);
  const minHeight = Math.min(...heights);
  const heightVariance = calculateHeightVariance(heights);
  const signature = createBoardSignatureFromState(board);

  return {
    columnHeights: heights,
    heightVariance,
    holes,
    maxHeight,
    minHeight,
    overhangs,
    signature,
    wells,
  };
}

/**
 * Get or compute cached preconditions for a template
 */
export function getCachedPreconditions(
  template: Template,
  state: GameState,
): PreconditionResult {
  const boardSig = createBoardSignatureFromState(state.board);
  const previewSig = createPreviewSignatureFromQueue(
    state.nextQueue,
    state.hold ?? null,
    Math.min(4, state.nextQueue.length),
  );

  const cacheKey = createCacheKey(`${template.id}|${boardSig}|${previewSig}`);

  const cached = preconditionCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const result = template.preconditions(state);
  const preconditionResult: PreconditionResult = {
    feasible: result.feasible,
    notes: result.notes,
    ...(result.scoreDelta !== undefined && { scoreDelta: result.scoreDelta }),
    signature: cacheKey,
  };

  preconditionCache.set(cacheKey, preconditionResult);

  return preconditionResult;
}

/**
 * Memoization helper with signature-based caching
 */
export function memoizeWithSignature<T>(
  fn: (state: GameState) => T,
  keyFn: (state: GameState) => string,
  maxSize = 100,
): (state: GameState) => T {
  const cache = new LRUCache<string, T>(maxSize);

  return (state: GameState): T => {
    const key = keyFn(state);

    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const result = fn(state);
    cache.set(key, result);

    return result;
  };
}

/**
 * Create a cache key from placement for memoizing placement evaluations
 */
export function createPlacementCacheKey(
  placement: Placement,
  boardSig: BoardSignature,
): CacheKey {
  const placementStr = `${String(gridCoordAsNumber(placement.x))},${placement.rot}${placement.useHold === true ? ",hold" : ""}`;
  return createCacheKey(`p:${placementStr}|b:${boardSig}`);
}

/**
 * Clear all caches (useful for testing and memory management)
 */
export function clearAllCaches(): void {
  previewSignatureCache.clear();
  boardFeatureCache.clear();
  preconditionCache.clear();
}

/**
 * Get cache statistics for monitoring and debugging
 */
export function getCacheStats(): Readonly<{
  preview: { size: number; maxSize: number };
  boardFeatures: { size: number; maxSize: number };
  preconditions: { size: number; maxSize: number };
}> {
  return {
    boardFeatures: { maxSize: 100, size: boardFeatureCache.size() },
    preconditions: { maxSize: 300, size: preconditionCache.size() },
    preview: { maxSize: 200, size: previewSignatureCache.size() },
  };
}
