
import { Tile, TileKind } from '../types';

export interface EvaluationResult {
  kind: TileKind;
  val: number;
  event: 'MERGE_STANDARD' | 'MERGE_TROPHY' | 'MERGE_STONE';
  description: string;
  lineage: string;
  fixed: boolean;
}

export class Engine {
  /**
   * evaluateInteraction
   * Pure function to determine the outcome of two tiles colliding.
   * Centralizes outcome logic and lineage construction.
   * 
   * 🔒 STONE CLASSIFICATION RULE (REV 3):
   * A result becomes STONE if and only if (res > targetValue).
   * All divisibility/factor-based penalties have been removed.
   */
  static evaluateInteraction(source: Tile, targetTile: Tile, targetValue: number): EvaluationResult {
    const res = source.val * targetTile.val;
    
    /**
     * LINEAGE INTEGRITY RULE (MANDATORY - REV 3):
     * No reduction. No simplification. No reordering.
     * Must reflect the exact player action history.
     */
    const srcExpr = source.lineage || String(source.val);
    const tgtExpr = targetTile.lineage || String(targetTile.val);
    const lineage = `${srcExpr} × ${tgtExpr}`;
    const equation = `${lineage} = ${res}`;
    
    let kind = TileKind.NUMBER;
    let event: 'MERGE_STANDARD' | 'MERGE_TROPHY' | 'MERGE_STONE' = 'MERGE_STANDARD';
    let fixed = false;

    if (res === targetValue) {
      // SUCCESS: Exact match.
      kind = TileKind.TROPHY;
      event = 'MERGE_TROPHY';
    } else if (res > targetValue) {
      // OVERFLOW: Result exceeds target. Permanent STONE.
      kind = TileKind.STONE;
      event = 'MERGE_STONE';
      fixed = true;
    }
    // Note: Any result <= targetValue that is not the exact target
    // is treated as a MERGE_STANDARD and remains movable.

    return { 
      kind, 
      val: res, 
      event, 
      description: equation, 
      lineage,
      fixed 
    };
  }
}
