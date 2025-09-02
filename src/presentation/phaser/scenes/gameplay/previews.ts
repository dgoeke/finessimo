import Phaser from "phaser";

import { PIECES } from "../../../../core/pieces";

import { assertNever } from "./utils";

import type { TetrominoPieceId } from "./types";

export const PREVIEW_CELL_PX = 12;
export const PREVIEW_BOX_COLS = 4;
export const PREVIEW_BOX_ROWS = 3;

export function setupPreviewsAndHold(
  scene: Phaser.Scene,
  boardWidthPx: number,
  ox: number,
  oy: number,
): {
  nextPreviewContainers: Array<Phaser.GameObjects.Container>;
  holdContainer: Phaser.GameObjects.Container;
} {
  const nextScale = 0.65;
  const nextColumnX = boardWidthPx + ox + 20;
  const nextCenterX = nextColumnX + (PREVIEW_CELL_PX * PREVIEW_BOX_COLS) / 2;
  scene.add
    .text(nextCenterX, oy, "Next", {
      color: "#ffffff",
      fontFamily: "monospace",
      fontSize: "14px",
      resolution: Math.max(2, window.devicePixelRatio),
    })
    .setOrigin(0.5, 0);

  const nextPreviewContainers: Array<Phaser.GameObjects.Container> = [];
  for (let i = 0; i < 5; i++) {
    const container = scene.add.container(
      boardWidthPx + ox + 20,
      oy + 25 + i * 35,
    );
    nextPreviewContainers.push(container);
    for (let j = 0; j < 4; j++) {
      const sprite = scene.add.sprite(0, 0, "tiles", 1);
      sprite.setOrigin(0, 0);
      sprite.setVisible(false);
      sprite.setScale(nextScale);
      container.add(sprite);
    }
  }

  const previewBoxWidthPx = PREVIEW_CELL_PX * PREVIEW_BOX_COLS;
  const holdScale = 0.75;
  const holdX = ox - 20 - previewBoxWidthPx;
  const holdCenterX = holdX + (16 * PREVIEW_BOX_COLS * holdScale) / 2;
  scene.add
    .text(holdCenterX, oy, "Hold", {
      color: "#ffffff",
      fontFamily: "monospace",
      fontSize: "14px",
      resolution: Math.max(2, window.devicePixelRatio),
    })
    .setOrigin(0.5, 0);

  const holdContainer = scene.add.container(holdX, oy + 25);
  for (let i = 0; i < 4; i++) {
    const sprite = scene.add.sprite(0, 0, "tiles", 1);
    sprite.setOrigin(0, 0);
    sprite.setVisible(false);
    sprite.setScale(holdScale);
    holdContainer.add(sprite);
  }

  return { holdContainer, nextPreviewContainers };
}

export function updateNextPreviews(
  containers: Array<Phaser.GameObjects.Container>,
  nextQueue: ReadonlyArray<TetrominoPieceId>,
): void {
  containers.forEach((container) => {
    container.list.forEach((sprite) => {
      if (sprite instanceof Phaser.GameObjects.Sprite) {
        sprite.setVisible(false);
      }
    });
  });

  for (let i = 0; i < Math.min(containers.length, nextQueue.length); i++) {
    const pieceId = nextQueue[i];
    const container = containers[i];
    if (pieceId !== undefined && container !== undefined && pieceId in PIECES) {
      renderPieceInContainer(container, pieceId, true);
    }
  }
}

export function updateHoldPreview(
  container: Phaser.GameObjects.Container | null,
  holdPiece: TetrominoPieceId | null,
): void {
  if (!container) return;
  container.list.forEach((sprite) => {
    if (sprite instanceof Phaser.GameObjects.Sprite) {
      sprite.setVisible(false);
    }
  });
  if (holdPiece !== null && holdPiece in PIECES) {
    renderPieceInContainer(container, holdPiece, false);
  }
}

export function renderPieceInContainer(
  container: Phaser.GameObjects.Container,
  pieceId: TetrominoPieceId,
  center: boolean,
): void {
  const piece = PIECES[pieceId];
  const spawnCells = piece.cells.spawn;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [cx, cy] of spawnCells) {
    if (cx < minX) minX = cx;
    if (cy < minY) minY = cy;
    if (cx > maxX) maxX = cx;
    if (cy > maxY) maxY = cy;
  }
  const widthCells = maxX - minX + 1;
  const heightCells = maxY - minY + 1;
  const offsetCellsX = center ? (PREVIEW_BOX_COLS - widthCells) / 2 : 0;
  const offsetCellsY = center ? (PREVIEW_BOX_ROWS - heightCells) / 2 : 0;
  const frame = pieceKindToFrame(pieceId);
  const sprites = container.list.filter(
    (o): o is Phaser.GameObjects.Sprite =>
      o instanceof Phaser.GameObjects.Sprite,
  );

  for (let i = 0; i < Math.min(spawnCells.length, sprites.length); i++) {
    const cell = spawnCells[i];
    const sprite = sprites[i];
    if (cell && sprite) {
      const relX = (cell[0] - minX + offsetCellsX) * PREVIEW_CELL_PX;
      const relY = (cell[1] - minY + offsetCellsY) * PREVIEW_CELL_PX;
      sprite.setPosition(relX, relY);
      sprite.setFrame(frame);
      sprite.setVisible(true);
    }
  }
}

function pieceKindToFrame(kind?: TetrominoPieceId): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  if (kind === undefined) return 1;
  switch (kind) {
    case "I":
      return 1;
    case "J":
      return 2;
    case "L":
      return 3;
    case "O":
      return 4;
    case "S":
      return 5;
    case "T":
      return 6;
    case "Z":
      return 7;
    default:
      return assertNever(kind);
  }
}
