import { GameState, ActivePiece, Rot, PieceId } from '../state/types';
import { FinesseResult } from '../finesse/calculator';
import { GameMode, GameModeResult } from './index';

export class FreePlayMode implements GameMode {
  readonly name = 'freePlay';
  
  onPieceLocked(
    _gameState: GameState, 
    finesseResult: FinesseResult,
    _lockedPiece: ActivePiece,
    _finalPosition: ActivePiece
  ): GameModeResult {
    const { isOptimal, playerSequence, optimalSequences, faults } = finesseResult;
    
    if (isOptimal) {
      return {
        feedback: `✓ Optimal finesse! Used ${playerSequence.length} inputs.`
      };
    }
    
    const optimalLength = optimalSequences[0]?.length || 0;
    const extraInputs = playerSequence.length - optimalLength;
    
    let feedback = `✗ Non-optimal finesse. Used ${playerSequence.length} inputs, optimal was ${optimalLength}.`;
    
    if (extraInputs > 0) {
      feedback += ` ${extraInputs} extra input${extraInputs > 1 ? 's' : ''}.`;
    }
    
    if (faults.length > 0) {
      const faultDescriptions = faults.map(f => f.description).join(', ');
      feedback += ` Issues: ${faultDescriptions}`;
    }
    
    return { feedback };
  }
  
  shouldPromptNext(_gameState: GameState): boolean {
    return false;
  }
  
  getNextPrompt(_gameState: GameState): string | null {
    return null;
  }

  // Free play analyzes the actual final target; no preset target
  getTargetFor(_lockedPiece: ActivePiece, _gameState: GameState): { targetX: number; targetRot: Rot } | null {
    return null;
  }

  getExpectedPiece(_gameState: GameState): PieceId | undefined {
    return undefined;
  }
  
  reset(): void {
  }
}
