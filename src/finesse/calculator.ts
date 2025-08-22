import { KeyAction, ActivePiece, GameplayConfig } from '../state/types';

// Finesse calculation result
export interface FinesseResult {
  optimalSequences: KeyAction[][]; // Can be multiple paths of the same length
  playerSequence: KeyAction[]; // normalized
  isOptimal: boolean;
  faults: Fault[]; // Fault type to be defined
}

// Fault types (to be expanded in later iterations)
export interface Fault {
  type: 'extra_input' | 'suboptimal_path' | 'unnecessary_rotation';
  description: string;
  position?: number; // Index in the player sequence where fault occurs
}

// Finesse Calculator interface
export interface FinesseCalculator {
  // Calculate optimal finesse for placing a piece at target position
  calculateOptimal(
    piece: ActivePiece,
    targetX: number,
    targetRot: string,
    config: GameplayConfig
  ): KeyAction[][];
  
  // Analyze player input for finesse optimality
  analyze(
    piece: ActivePiece,
    targetX: number,
    targetRot: string,
    playerInputs: KeyAction[],
    config: GameplayConfig
  ): FinesseResult;
}

// Stub implementation of the finesse calculator
export class StubFinesseCalculator implements FinesseCalculator {
  calculateOptimal(
    piece: ActivePiece,
    targetX: number,
    targetRot: string,
    _config: GameplayConfig
  ): KeyAction[][] {
    console.log(`StubFinesseCalculator: calculateOptimal for ${piece.id} to position (${targetX}, ${targetRot})`);
    
    // Stub implementation - returns a simple path
    const stubPath: KeyAction[] = [];
    
    // Add rotation inputs if needed
    if (targetRot !== piece.rot) {
      stubPath.push('RotateCW');
    }
    
    // Add movement inputs
    const deltaX = targetX - piece.x;
    if (deltaX < 0) {
      stubPath.push('LeftDown');
    } else if (deltaX > 0) {
      stubPath.push('RightDown');
    }
    
    // Always end with hard drop
    stubPath.push('HardDrop');
    
    return [stubPath];
  }
  
  analyze(
    piece: ActivePiece,
    targetX: number,
    targetRot: string,
    playerInputs: KeyAction[],
    config: GameplayConfig
  ): FinesseResult {
    console.log(`StubFinesseCalculator: analyze player inputs for ${piece.id}`);
    
    // Calculate optimal sequences
    const optimalSequences = this.calculateOptimal(piece, targetX, targetRot, config);
    
    // Normalize player inputs (stub implementation)
    const playerSequence = this.normalizeInputs(playerInputs, config);
    
    // Simple optimality check - just compare lengths
    const optimalLength = optimalSequences[0]?.length || 0;
    const playerLength = playerSequence.length;
    const isOptimal = playerLength <= optimalLength;
    
    // Generate faults if not optimal
    const faults: Fault[] = [];
    if (!isOptimal) {
      faults.push({
        type: 'extra_input',
        description: `Used ${playerLength} inputs instead of optimal ${optimalLength}`,
        position: optimalLength
      });
    }
    
    return {
      optimalSequences,
      playerSequence,
      isOptimal,
      faults
    };
  }
  
  // Stub input normalization (to be implemented properly in later iterations)
  private normalizeInputs(inputs: KeyAction[], _config: GameplayConfig): KeyAction[] {
    // For now, just filter out key up events and return as-is
    return inputs.filter(input => 
      !input.endsWith('Up') && 
      input !== 'SoftDropUp'
    );
  }
}

// Export a default instance
export const finesseCalculator = new StubFinesseCalculator();