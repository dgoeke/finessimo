import { gameModeRegistry } from "../../../../modes";
import { getActiveRng } from "../../../../modes/spawn-service";
import { fromNow } from "../../../../types/timestamp";

import { simpleEqual, shallowEqual } from "./utils";

import type { SceneCtx } from "./types";
import type { GameMode as IGameMode } from "../../../../modes";
import type { Action } from "../../../../state/types";

export function initializeMode(ctx: SceneCtx, modeName: string): void {
  const mode = gameModeRegistry.get(modeName);
  if (!mode) return;
  applyModeInitialConfig(ctx, mode);
  applyModePrompt(ctx, mode);
  runModeActivationHook(ctx, mode);
  setupModeRng(ctx, mode);
}

export function setGameMode(ctx: SceneCtx, modeName: string): void {
  const mode = gameModeRegistry.get(modeName);
  if (!mode) return;

  const s = ctx.state;
  const modeConfig =
    typeof mode.initialConfig === "function" ? mode.initialConfig() : {};
  const mergedGameplay = { ...s.gameplay, ...modeConfig.gameplay };
  const mergedTiming = { ...s.timing, ...modeConfig.timing };
  const seed = ctx.randomSeed();

  const init: Action = {
    gameplay: mergedGameplay,
    mode: modeName,
    retainStats: true,
    seed,
    timestampMs: fromNow(),
    timing: mergedTiming,
    type: "Init",
  };
  const reduced = ctx.reduce(s, init);
  ctx.setState(reduced);
  ctx.safeDispatch(init);

  applyModePrompt(ctx, mode);
  runModeActivationHook(ctx, mode);
  setupModeRng(ctx, mode);
  ctx.spawnNextPiece();
}

export function applyModeInitialConfig(ctx: SceneCtx, mode: IGameMode): void {
  const s = ctx.state;
  if (typeof mode.initialConfig !== "function") return;
  const modeConfig = mode.initialConfig();

  if (modeConfig.timing) {
    const timing = { ...s.timing, ...modeConfig.timing };
    const act: Action = { timing, type: "UpdateTiming" };
    ctx.setState(ctx.reduce(ctx.state, act));
    ctx.safeDispatch(act);
  }
  if (modeConfig.gameplay) {
    const gameplay = { ...s.gameplay, ...modeConfig.gameplay };
    const act: Action = { gameplay, type: "UpdateGameplay" };
    ctx.setState(ctx.reduce(ctx.state, act));
    ctx.safeDispatch(act);
  }
}

export function applyModePrompt(ctx: SceneCtx, mode: IGameMode): void {
  const s = ctx.state;
  if (!mode.shouldPromptNext(s)) return;
  const prompt = mode.getNextPrompt(s);
  if (prompt !== null) {
    const act: Action = { prompt, type: "UpdateModePrompt" };
    ctx.setState(ctx.reduce(ctx.state, act));
    ctx.safeDispatch(act);
  }
}

export function runModeActivationHook(ctx: SceneCtx, mode: IGameMode): void {
  if (typeof mode.onActivated !== "function") return;
  const activation = mode.onActivated(ctx.state);
  if (activation.modeData !== undefined) {
    const act: Action = { data: activation.modeData, type: "UpdateModeData" };
    ctx.setState(ctx.reduce(ctx.state, act));
    ctx.safeDispatch(act);
  }
  if (Array.isArray(activation.postActions)) {
    const acts = activation.postActions as ReadonlyArray<Action>;
    for (const act of acts) {
      ctx.setState(ctx.reduce(ctx.state, act));
      ctx.safeDispatch(act);
    }
  }
}

export function setupModeRng(ctx: SceneCtx, mode: IGameMode): void {
  const s = ctx.state;
  const desired = Math.max(5, s.gameplay.nextPieceCount ?? 5);
  const seededRng = getActiveRng(mode, ctx.randomSeed(), s.rng);
  const { newRng, pieces } =
    typeof mode.getPreview === "function"
      ? mode.getPreview(s, seededRng, desired)
      : seededRng.getNextPieces(desired);
  const act: Action = { pieces, rng: newRng, type: "ReplacePreview" };
  ctx.setState(ctx.reduce(ctx.state, act));
  ctx.safeDispatch(act);
}

export function updateModeUi(ctx: SceneCtx): void {
  const s = ctx.state;
  const mode = gameModeRegistry.get(s.currentMode);
  if (!mode) return;
  updateGuidance(ctx, mode);
  updateAdapterData(ctx);
  updateDecorations(ctx, mode);
}

function updateGuidance(ctx: SceneCtx, mode: IGameMode): void {
  const s = ctx.state;
  if (typeof mode.getGuidance !== "function") return;
  const guidance = mode.getGuidance(s) ?? null;
  const prev = s.guidance ?? null;
  if (!simpleEqual(guidance, prev)) {
    const act: Action = { guidance, type: "UpdateGuidance" };
    ctx.setState(ctx.reduce(ctx.state, act));
    ctx.safeDispatch(act);
  }
}

function updateAdapterData(ctx: SceneCtx): void {
  const s = ctx.state;
  const modeName = s.currentMode as "freePlay" | "guided";
  const adapter = ctx.modeUiAdapters[modeName];
  const derivedUi = adapter.computeDerivedUi(s);
  if (derivedUi === null) return;
  const currentModeData =
    typeof s.modeData === "object" && s.modeData !== null
      ? (s.modeData as Record<string, unknown>)
      : {};
  const mergedModeData = { ...currentModeData, ...derivedUi };
  if (!shallowEqual(mergedModeData, currentModeData)) {
    const act: Action = { data: mergedModeData, type: "UpdateModeData" };
    ctx.setState(ctx.reduce(ctx.state, act));
    ctx.safeDispatch(act);
  }
}

function updateDecorations(ctx: SceneCtx, mode: IGameMode): void {
  const s = ctx.state;
  if (typeof mode.getBoardDecorations !== "function") return;
  const decorations = mode.getBoardDecorations(s) ?? null;
  const prev = s.boardDecorations ?? null;
  if (!simpleEqual(decorations, prev)) {
    const act: Action = { decorations, type: "UpdateBoardDecorations" };
    ctx.setState(ctx.reduce(ctx.state, act));
    ctx.safeDispatch(act);
  }
}
