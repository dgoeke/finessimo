import { GameState, Action, ActivePiece, FinesseUIFeedback, Rot } from '../state/types';
import { finesseCalculator, Fault } from './calculator';
import { GameMode } from '../modes';
import { dropToBottom } from '../core/board';
import { normalizeInputSequence } from '../input/handler';
import { PIECES } from '../core/pieces';

export interface FinesseService {
  analyzePieceLock(
    state: GameState,
    lockedPiece: ActivePiece,
    gameMode: GameMode
  ): Action[];
}

export class DefaultFinesseService implements FinesseService {
  analyzePieceLock(
    state: GameState,
    lockedPiece: ActivePiece,
    gameMode: GameMode
  ): Action[] {
    const actions: Action[] = [];
    
    // Determine intended analysis target from mode, if provided; otherwise use actual final
    const finalPosition = dropToBottom(state.board, lockedPiece);
    let targetX: number = finalPosition.x;
    let targetRot: Rot = finalPosition.rot;
    if (typeof gameMode.getTargetFor === 'function') {
      const t = gameMode.getTargetFor(lockedPiece, state);
      if (t) { targetX = t.targetX; targetRot = t.targetRot; }
    }

    // Build spawn-state origin for BFS minimality
    const spawnTopLeft = PIECES[lockedPiece.id].spawnTopLeft;
    const spawnPiece: ActivePiece = { id: lockedPiece.id, rot: 'spawn', x: spawnTopLeft[0], y: spawnTopLeft[1] };

    // Normalize player input sequence using configured cancellation window
    const playerInputs = normalizeInputSequence(state.inputLog, state.gameplay.finesseCancelMs);

    // Analyze
    const finesseResult = finesseCalculator.analyze(
      spawnPiece,
      targetX,
      targetRot,
      playerInputs,
      state.gameplay
    );

    // Inject mode-level faults: wrong piece or wrong target, if applicable
    const faults: Fault[] = [...finesseResult.faults];
    if (typeof gameMode.getExpectedPiece === 'function') {
      const expected = gameMode.getExpectedPiece(state);
      if (expected && lockedPiece.id !== expected) {
        faults.push({ type: 'wrong_piece', description: `Expected piece ${expected}, got ${lockedPiece.id}` });
      }
    }
    if (typeof gameMode.getTargetFor === 'function') {
      const t = gameMode.getTargetFor(lockedPiece, state);
      if (t && !(finalPosition.x === t.targetX && finalPosition.rot === t.targetRot)) {
        faults.push({ type: 'wrong_target', description: `Expected target x=${t.targetX}, rot=${t.targetRot}` });
      }
    }
    const mergedResult = { ...finesseResult, faults, isOptimal: finesseResult.isOptimal && faults.length === 0 };
    
    const modeResult = gameMode.onPieceLocked(state, mergedResult, lockedPiece, finalPosition);
    
    const feedback: FinesseUIFeedback = {
      message: modeResult.feedback,
      isOptimal: finesseResult.isOptimal,
      timestamp: Date.now()
    };
    
    actions.push({
      type: 'UpdateFinesseFeedback',
      feedback
    });
    
    if (modeResult.nextPrompt) {
      actions.push({
        type: 'UpdateModePrompt',
        prompt: modeResult.nextPrompt
      });
    }
    
    return actions;
  }
}

export const finesseService = new DefaultFinesseService();
