/**
 * @jest-environment jsdom
 */

import { createEmptyBoard } from "../../../../src/core/board";
import { createGridCoord } from "../../../../src/types/brands";
import {
  createMiniCanvasElement,
  renderMiniBoard,
  drawMiniBackground,
  drawMiniGrid,
  drawMiniBorder,
} from "../../../../src/ui/renderers/mini-board";

import type { ActivePiece } from "../../../../src/state/types";

describe("Mini Board Renderer", () => {
  let canvas: HTMLCanvasElement;
  let ctx: jest.Mocked<CanvasRenderingContext2D>;

  beforeEach(() => {
    canvas = createMiniCanvasElement();

    // Mock CanvasRenderingContext2D
    ctx = {
      beginPath: jest.fn(),
      clearRect: jest.fn(),
      fillRect: jest.fn(),
      fillStyle: "",
      lineTo: jest.fn(),
      lineWidth: 1,
      moveTo: jest.fn(),
      stroke: jest.fn(),
      strokeRect: jest.fn(),
      strokeStyle: "",
    } as unknown as jest.Mocked<CanvasRenderingContext2D>;

    // Mock getContext to return our mock
    jest.spyOn(canvas, "getContext").mockReturnValue(ctx);
  });

  test("createMiniCanvasElement creates canvas with correct dimensions", () => {
    expect(canvas.width).toBe(300); // 10 * 30
    expect(canvas.height).toBe(150); // 5 * 30
    expect(canvas.className).toBe("mini-board-canvas");
  });

  test("drawMiniBackground fills canvas with black", () => {
    const fillRectSpy = jest.spyOn(ctx, "fillRect");
    drawMiniBackground(ctx);

    expect(ctx.fillStyle).toBe("#000000");
    expect(fillRectSpy).toHaveBeenCalledWith(0, 0, 300, 150);
  });

  test("drawMiniGrid draws grid lines", () => {
    const strokeSpy = jest.spyOn(ctx, "stroke");
    drawMiniGrid(ctx);

    expect(ctx.strokeStyle).toBe("#333333");
    expect(ctx.lineWidth).toBe(1);
    // Should be called for each grid line (11 vertical + 6 horizontal)
    expect(strokeSpy).toHaveBeenCalledTimes(17);
  });

  test("drawMiniBorder draws border", () => {
    const strokeRectSpy = jest.spyOn(ctx, "strokeRect");
    drawMiniBorder(ctx);

    expect(ctx.strokeStyle).toBe("#333333");
    expect(ctx.lineWidth).toBe(2);
    expect(strokeRectSpy).toHaveBeenCalledWith(0, 0, 300, 150);
  });

  test("renderMiniBoard renders complete mini board with piece", () => {
    const board = createEmptyBoard();
    const targetPiece: ActivePiece = {
      id: "T",
      rot: "spawn",
      x: createGridCoord(4),
      y: createGridCoord(18),
    };

    const clearRectSpy = jest.spyOn(ctx, "clearRect");

    expect(() => renderMiniBoard(ctx, board, targetPiece)).not.toThrow();
    expect(clearRectSpy).toHaveBeenCalledWith(0, 0, 300, 150);
  });
});
