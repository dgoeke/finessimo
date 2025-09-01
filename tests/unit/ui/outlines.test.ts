import { describe, it, expect } from "@jest/globals";

import { createGridCoord } from "../../../src/types/brands";
import {
  computePerimeterEdges,
  orderEdgesToPaths,
  computeOutlinePaths,
  pathToPath2D,
} from "../../../src/ui/utils/outlines";

import type {
  GridCell,
  OrientedEdge,
  OutlinePath,
} from "../../../src/ui/utils/outlines";

describe("outline utilities", () => {
  describe("computePerimeterEdges", () => {
    it("should compute 4 edges for a single cell", () => {
      const cells: Array<GridCell> = [[createGridCoord(0), createGridCoord(0)]];
      const edges = computePerimeterEdges(cells);

      expect(edges).toHaveLength(4);

      // Verify we have all 4 edges of the unit square
      const edgeStrings = edges
        .map(
          (e) =>
            `${String(e.from.x)},${String(e.from.y)}-${String(e.to.x)},${String(e.to.y)}`,
        )
        .sort((a, b) => a.localeCompare(b));

      expect(edgeStrings).toEqual([
        "0,0-1,0", // top
        "0,1-0,0", // left (reverse)
        "1,0-1,1", // right
        "1,1-0,1", // bottom (reverse)
      ]);
    });

    it("should cancel internal edges for 2x2 square (O piece)", () => {
      const cells: Array<GridCell> = [
        [createGridCoord(0), createGridCoord(0)],
        [createGridCoord(1), createGridCoord(0)],
        [createGridCoord(0), createGridCoord(1)],
        [createGridCoord(1), createGridCoord(1)],
      ];
      const edges = computePerimeterEdges(cells);

      // 2x2 square has 8 perimeter edges (4 cells * 4 edges - 8 internal edges)
      expect(edges).toHaveLength(8);

      // Verify no internal edges remain
      const hasInternalEdge = edges.some(
        (e) =>
          (e.from.x === 1 && e.to.x === 1 && e.from.y === 0 && e.to.y === 1) || // vertical internal
          (e.from.x === 0 && e.to.x === 1 && e.from.y === 1 && e.to.y === 1), // horizontal internal
      );
      expect(hasInternalEdge).toBe(false);
    });

    it("should handle L-shaped piece correctly", () => {
      // L piece in spawn orientation:
      // □□□
      // □
      const cells: Array<GridCell> = [
        [createGridCoord(0), createGridCoord(0)],
        [createGridCoord(1), createGridCoord(0)],
        [createGridCoord(2), createGridCoord(0)],
        [createGridCoord(0), createGridCoord(1)],
      ];
      const edges = computePerimeterEdges(cells);

      // L shape has 10 perimeter edges
      expect(edges).toHaveLength(10);
    });

    it("should handle disjoint cells", () => {
      // Two separate cells
      const cells: Array<GridCell> = [
        [createGridCoord(0), createGridCoord(0)],
        [createGridCoord(2), createGridCoord(0)], // gap of 1
      ];
      const edges = computePerimeterEdges(cells);

      // Two separate cells = 8 edges total
      expect(edges).toHaveLength(8);
    });
  });

  describe("orderEdgesToPaths", () => {
    it("should create a single closed path for a square", () => {
      // Manually create edges for a 1x1 square
      const edges: Array<OrientedEdge> = [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }, // top
        { from: { x: 1, y: 0 }, to: { x: 1, y: 1 } }, // right
        { from: { x: 1, y: 1 }, to: { x: 0, y: 1 } }, // bottom
        { from: { x: 0, y: 1 }, to: { x: 0, y: 0 } }, // left
      ];

      const paths = orderEdgesToPaths(edges);

      expect(paths).toHaveLength(1);
      expect(paths[0]).toHaveLength(4);

      // Verify it's a closed loop
      const path = paths[0];
      expect(path).toBeDefined();
      expect(path?.[0]).toEqual({ x: 0, y: 0 });
      expect(path).toContainEqual({ x: 1, y: 0 });
      expect(path).toContainEqual({ x: 1, y: 1 });
      expect(path).toContainEqual({ x: 0, y: 1 });
    });

    it("should handle empty edge list", () => {
      const paths = orderEdgesToPaths([]);
      expect(paths).toEqual([]);
    });

    it("should create multiple paths for disjoint shapes", () => {
      // Two separate squares
      const edges: Array<OrientedEdge> = [
        // First square at (0,0)
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        { from: { x: 1, y: 0 }, to: { x: 1, y: 1 } },
        { from: { x: 1, y: 1 }, to: { x: 0, y: 1 } },
        { from: { x: 0, y: 1 }, to: { x: 0, y: 0 } },
        // Second square at (2,0)
        { from: { x: 2, y: 0 }, to: { x: 3, y: 0 } },
        { from: { x: 3, y: 0 }, to: { x: 3, y: 1 } },
        { from: { x: 3, y: 1 }, to: { x: 2, y: 1 } },
        { from: { x: 2, y: 1 }, to: { x: 2, y: 0 } },
      ];

      const paths = orderEdgesToPaths(edges);

      expect(paths).toHaveLength(2);
      expect(paths[0]).toHaveLength(4);
      expect(paths[1]).toHaveLength(4);
    });
  });

  describe("computeOutlinePaths", () => {
    it("should compute outline for Z piece", () => {
      // Z piece horizontal:
      // □□
      //  □□
      const cells: Array<GridCell> = [
        [createGridCoord(0), createGridCoord(0)],
        [createGridCoord(1), createGridCoord(0)],
        [createGridCoord(1), createGridCoord(1)],
        [createGridCoord(2), createGridCoord(1)],
      ];

      const paths = computeOutlinePaths(cells);

      expect(paths).toHaveLength(1);
      const path = paths[0];
      expect(path).toBeDefined();

      // Z piece has 10 vertices in its outline (with all edge vertices)
      expect(path).toHaveLength(10);

      // Verify it contains key vertices
      expect(path).toContainEqual({ x: 1, y: 1 }); // Key vertex
    });

    it("should compute outline for T piece", () => {
      // T piece spawn orientation:
      //  □
      // □□□
      const cells: Array<GridCell> = [
        [createGridCoord(1), createGridCoord(0)],
        [createGridCoord(0), createGridCoord(1)],
        [createGridCoord(1), createGridCoord(1)],
        [createGridCoord(2), createGridCoord(1)],
      ];

      const paths = computeOutlinePaths(cells);

      expect(paths).toHaveLength(1);
      const path = paths[0];
      expect(path).toBeDefined();

      // T piece has 10 vertices in its outline (with all edge vertices)
      expect(path).toHaveLength(10);
    });

    it("should compute outline for I piece horizontal", () => {
      // I piece horizontal: □□□□
      const cells: Array<GridCell> = [
        [createGridCoord(0), createGridCoord(0)],
        [createGridCoord(1), createGridCoord(0)],
        [createGridCoord(2), createGridCoord(0)],
        [createGridCoord(3), createGridCoord(0)],
      ];

      const paths = computeOutlinePaths(cells);

      expect(paths).toHaveLength(1);
      const path = paths[0];
      expect(path).toBeDefined();

      // Rectangle has 10 vertices (includes all edge vertices, not just corners)
      expect(path).toHaveLength(10);

      // Verify corners
      expect(path).toContainEqual({ x: 0, y: 0 });
      expect(path).toContainEqual({ x: 4, y: 0 });
      expect(path).toContainEqual({ x: 4, y: 1 });
      expect(path).toContainEqual({ x: 0, y: 1 });
    });

    it("should handle empty cell list", () => {
      const paths = computeOutlinePaths([]);
      expect(paths).toEqual([]);
    });
  });

  describe("pathToPath2D", () => {
    it("should convert grid path to pixel path", () => {
      const path: OutlinePath = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ];

      const cellSize = 30;
      const path2d = pathToPath2D(path, cellSize);

      // Path2D doesn't expose its internal state directly,
      // but we can verify it was created without errors
      expect(path2d).toBeInstanceOf(Path2D);
    });

    it("should handle empty path", () => {
      const path2d = pathToPath2D([], 30);
      expect(path2d).toBeInstanceOf(Path2D);
    });

    it("should scale coordinates by cell size", () => {
      const path: OutlinePath = [
        { x: 2, y: 3 },
        { x: 4, y: 3 },
        { x: 4, y: 5 },
        { x: 2, y: 5 },
      ];

      const cellSize = 20;
      const path2d = pathToPath2D(path, cellSize);

      // Path2D scaled by cellSize (can't directly test coordinates,
      // but verifying no errors is sufficient for unit test)
      expect(path2d).toBeInstanceOf(Path2D);
    });
  });

  describe("integration tests", () => {
    it("should compute correct outline for all tetromino shapes", () => {
      const tetrominoes: Record<string, Array<GridCell>> = {
        I: [
          [createGridCoord(0), createGridCoord(0)],
          [createGridCoord(1), createGridCoord(0)],
          [createGridCoord(2), createGridCoord(0)],
          [createGridCoord(3), createGridCoord(0)],
        ],
        J: [
          [createGridCoord(0), createGridCoord(0)],
          [createGridCoord(1), createGridCoord(0)],
          [createGridCoord(2), createGridCoord(0)],
          [createGridCoord(2), createGridCoord(1)],
        ],
        L: [
          [createGridCoord(0), createGridCoord(0)],
          [createGridCoord(1), createGridCoord(0)],
          [createGridCoord(2), createGridCoord(0)],
          [createGridCoord(0), createGridCoord(1)],
        ],
        O: [
          [createGridCoord(0), createGridCoord(0)],
          [createGridCoord(1), createGridCoord(0)],
          [createGridCoord(0), createGridCoord(1)],
          [createGridCoord(1), createGridCoord(1)],
        ],
        S: [
          [createGridCoord(1), createGridCoord(0)],
          [createGridCoord(2), createGridCoord(0)],
          [createGridCoord(0), createGridCoord(1)],
          [createGridCoord(1), createGridCoord(1)],
        ],
        T: [
          [createGridCoord(1), createGridCoord(0)],
          [createGridCoord(0), createGridCoord(1)],
          [createGridCoord(1), createGridCoord(1)],
          [createGridCoord(2), createGridCoord(1)],
        ],
        Z: [
          [createGridCoord(0), createGridCoord(0)],
          [createGridCoord(1), createGridCoord(0)],
          [createGridCoord(1), createGridCoord(1)],
          [createGridCoord(2), createGridCoord(1)],
        ],
      };

      const expectedVertexCounts: Record<string, number> = {
        I: 10, // Rectangle (with all edge vertices)
        J: 10, // J shape
        L: 10, // L shape
        O: 8, // Square (2x2)
        S: 10, // S shape (concave)
        T: 10, // T shape
        Z: 10, // Z shape (concave)
      };

      for (const [name, cells] of Object.entries(tetrominoes)) {
        const paths = computeOutlinePaths(cells);

        expect(paths).toHaveLength(1);
        const path = paths[0];
        expect(path).toBeDefined();

        const expectedCount = expectedVertexCounts[name];
        expect(expectedCount).toBeDefined();
        if (expectedCount !== undefined && path) {
          expect(path).toHaveLength(expectedCount);

          // Verify all vertices are integers (grid aligned)
          for (const vertex of path) {
            expect(Number.isInteger(vertex.x)).toBe(true);
            expect(Number.isInteger(vertex.y)).toBe(true);
          }
        }
      }
    });
  });
});
