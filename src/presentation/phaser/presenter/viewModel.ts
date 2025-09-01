import { calculateGhostPosition } from "../../../core/board";
import { cellsForActivePiece } from "../../../engine/util/cell-projection";
import { isExtendedModeData } from "../../../modes/types";
import { gridCoordAsNumber } from "../../../types/brands";

import type { ViewModel, Col, Row, Px } from "./types";
import type { GameState } from "../../../state/types";

// Small branded constructors (helpers live on the presentation boundary)
export function toCol(n: number): Col {
  if (!Number.isFinite(n)) throw new Error("Col must be finite number");
  return Math.trunc(n) as Col;
}

export function toRow(n: number): Row {
  if (!Number.isFinite(n)) throw new Error("Row must be finite number");
  return Math.trunc(n) as Row;
}

export function toPx(n: number): Px {
  if (!Number.isFinite(n)) throw new Error("Px must be finite number");
  return n as Px;
}

/**
 * Pure projection from GameState to ViewModel used by the presenter.
 * Includes: board grid, active/ghost cells, topOut flag, and HUD fields.
 */
export function mapGameStateToViewModel(s: Readonly<GameState>): ViewModel {
  const board2d = projectBoardGrid(s);
  const activeVm = projectActive(s);
  const ghostVm = projectGhost(s);

  // HUD projection — scoring is not part of core yet; keep 0
  const hud = {
    lines: s.stats.linesCleared,
    mode: s.currentMode,
    score: 0,
  } as const;

  // Assemble ViewModel while respecting exactOptionalPropertyTypes: omit undefined props
  const vmBase: {
    board: ReadonlyArray<ReadonlyArray<number>>;
    topOut: boolean;
    hud: typeof hud;
  } = {
    board: board2d,
    hud,
    topOut: s.status === "topOut",
  };

  const vmWithActive = activeVm ? { ...vmBase, active: activeVm } : vmBase;
  const vm = ghostVm ? { ...vmWithActive, ghost: ghostVm } : vmWithActive;
  return vm as ViewModel;
}

function projectBoardGrid(
  s: Readonly<GameState>,
): ReadonlyArray<ReadonlyArray<number>> {
  const h = s.board.height;
  const w = s.board.width;
  const out = new Array<Array<number>>(h);
  for (let y = 0; y < h; y++) {
    const row = new Array<number>(w);
    for (let x = 0; x < w; x++) {
      row[x] = s.board.cells[y * w + x] ?? 0;
    }
    out[y] = row;
  }
  return out as ReadonlyArray<ReadonlyArray<number>>;
}

function projectActive(
  s: Readonly<GameState>,
): ViewModel["active"] | undefined {
  if (!s.active) return undefined;
  return {
    cells: cellsForActivePiece(s.active).map(([cx, cy]) => ({
      col: toCol(gridCoordAsNumber(cx)),
      row: toRow(gridCoordAsNumber(cy)),
    })),
    kind: s.active.id,
  } as const;
}

function projectGhost(s: Readonly<GameState>): ViewModel["ghost"] | undefined {
  if (s.status !== "playing" || !s.active) return undefined;
  const modeData = isExtendedModeData(s.modeData) ? s.modeData : undefined;
  const ghostEnabled =
    modeData?.ghostEnabled ?? s.gameplay.ghostPieceEnabled ?? true;
  if (!ghostEnabled) return undefined;

  const ghost = calculateGhostPosition(s.board, s.active);
  const samePos =
    gridCoordAsNumber(ghost.x) === gridCoordAsNumber(s.active.x) &&
    gridCoordAsNumber(ghost.y) === gridCoordAsNumber(s.active.y) &&
    ghost.rot === s.active.rot;
  if (samePos) return undefined;

  return {
    cells: cellsForActivePiece(ghost).map(([cx, cy]) => ({
      col: toCol(gridCoordAsNumber(cx)),
      row: toRow(gridCoordAsNumber(cy)),
    })),
  } as const;
}
