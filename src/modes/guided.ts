import { GameState, PieceId, Rot, ActivePiece } from '../state/types';
import { FinesseResult } from '../finesse/calculator';
import { GameMode, GameModeResult } from './index';

interface GuidedDrill {
  piece: PieceId;
  targetX: number;
  targetRot: Rot;
  description: string;
}

export class GuidedMode implements GameMode {
  readonly name = 'guided';
  
  private drills: GuidedDrill[] = [
    { piece: 'T', targetX: 0, targetRot: 'spawn', description: 'Place T-piece at left edge (spawn rotation)' },
    { piece: 'T', targetX: 7, targetRot: 'spawn', description: 'Place T-piece at right edge (spawn rotation)' },
    { piece: 'T', targetX: 4, targetRot: 'right', description: 'Place T-piece at center (right rotation)' },
    { piece: 'I', targetX: 0, targetRot: 'spawn', description: 'Place I-piece at left edge (spawn rotation)' },
    { piece: 'I', targetX: 6, targetRot: 'spawn', description: 'Place I-piece at right edge (spawn rotation)' },
    { piece: 'L', targetX: 0, targetRot: 'spawn', description: 'Place L-piece at left edge (spawn rotation)' },
    { piece: 'J', targetX: 7, targetRot: 'spawn', description: 'Place J-piece at right edge (spawn rotation)' },
  ];
  
  private currentDrillIndex = 0;
  private attemptsOnCurrentDrill = 0;
  
  onPieceLocked(
    _gameState: GameState, 
    finesseResult: FinesseResult,
    lockedPiece: ActivePiece,
    finalPosition: ActivePiece
  ): GameModeResult {
    this.attemptsOnCurrentDrill++;
    
    const currentDrill = this.drills[this.currentDrillIndex];
    if (!currentDrill) {
      return {
        feedback: 'All drills completed! Well done!',
        isComplete: true
      };
    }
    
    const { isOptimal, playerSequence, optimalSequences, faults } = finesseResult;

    // Enforce piece identity and target match for the current drill
    const expected = this.drills[this.currentDrillIndex];
    if (expected) {
      if (lockedPiece.id !== expected.piece) {
        return { feedback: `✗ Wrong piece. Expected ${expected.piece}.` };
      }
      if (!(finalPosition.x === expected.targetX && finalPosition.rot === expected.targetRot)) {
        return { feedback: `✗ Wrong target. Place at x=${expected.targetX}, rot=${expected.targetRot}.` };
      }
    }
    
    if (isOptimal) {
      this.currentDrillIndex++;
      const nextDrill = this.drills[this.currentDrillIndex];
      
      let feedback = `✓ Perfect! Completed drill in ${playerSequence.length} inputs (optimal).`;
      
      if (nextDrill) {
        feedback += ` Moving to next drill.`;
        return {
          feedback,
          nextPrompt: nextDrill.description
        };
      } else {
        return {
          feedback: `${feedback} All drills completed! Excellent work!`,
          isComplete: true
        };
      }
    }
    
    const optimalLength = optimalSequences[0]?.length || 0;
    const extraInputs = playerSequence.length - optimalLength;
    
    let feedback = `✗ Try again! Used ${playerSequence.length} inputs, optimal is ${optimalLength}.`;
    
    if (extraInputs > 0) {
      feedback += ` You used ${extraInputs} extra input${extraInputs > 1 ? 's' : ''}.`;
    }
    
    if (faults.length > 0) {
      const primaryFault = faults[0];
      if (primaryFault) {
        feedback += ` Hint: ${primaryFault.description}`;
      }
    }
    
    if (this.attemptsOnCurrentDrill > 2 && optimalSequences.length > 0) {
      const optimalSequence = optimalSequences[0];
      if (optimalSequence) {
        const optimalStr = optimalSequence.join(' → ');
        feedback += ` Optimal sequence: ${optimalStr}`;
      }
    }
    
    return { feedback };
  }
  
  shouldPromptNext(gameState: GameState): boolean {
    if (!gameState.active) {
      const currentDrill = this.drills[this.currentDrillIndex];
      return currentDrill !== undefined;
    }
    return false;
  }
  
  getNextPrompt(_gameState: GameState): string | null {
    const currentDrill = this.drills[this.currentDrillIndex];
    if (currentDrill) {
      return `Drill ${this.currentDrillIndex + 1}/${this.drills.length}: ${currentDrill.description}`;
    }
    return null;
  }
  
  // Provide intended target for analysis
  getTargetFor(_lockedPiece: ActivePiece, _gameState: GameState): { targetX: number; targetRot: Rot } | null {
    const currentDrill = this.drills[this.currentDrillIndex];
    if (!currentDrill) return null;
    return { targetX: currentDrill.targetX, targetRot: currentDrill.targetRot };
    
  }

  getExpectedPiece(_gameState: GameState): PieceId | undefined {
    const currentDrill = this.drills[this.currentDrillIndex];
    return currentDrill?.piece;
  }

  reset(): void {
    this.currentDrillIndex = 0;
    this.attemptsOnCurrentDrill = 0;
  }
  
  getCurrentDrill(): GuidedDrill | undefined {
    return this.drills[this.currentDrillIndex];
  }
  
  getProgress(): { current: number; total: number } {
    return {
      current: this.currentDrillIndex,
      total: this.drills.length
    };
  }
}
