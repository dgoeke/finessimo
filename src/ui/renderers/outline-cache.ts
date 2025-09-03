/**
 * Pure outline cache implementation for efficient overlay rendering.
 *
 * This module provides caching for cell outline computations to avoid recomputing
 * outline paths for identical cell sets during 60fps rendering.
 */

import { getCellsHash, computeOutlinePaths } from "../utils/outlines";

import type { GridCell, OutlinePath } from "../utils/outlines";

/**
 * Interface for outline cache used by overlay renderers.
 * Provides memoized outline path computation for cell sets.
 */
export type OutlineCache = {
  readonly get: (cells: ReadonlyArray<GridCell>) => OutlinePath;
};

/**
 * Create an outline cache that memoizes outline path computations.
 * Uses cell coordinates hash as cache key for efficient lookups.
 *
 * @returns OutlineCache instance with get method for path lookup
 */
export const createOutlineCache = (): OutlineCache => {
  const cacheMap = new Map<string, OutlinePath>();

  return {
    get: (cells: ReadonlyArray<GridCell>): OutlinePath => {
      const cacheKey = getCellsHash(cells);
      const cached = cacheMap.get(cacheKey);
      if (cached) return cached;

      const paths = computeOutlinePaths(cells);
      const outline = paths[0] ?? [];
      cacheMap.set(cacheKey, outline);
      return outline;
    },
  };
};
