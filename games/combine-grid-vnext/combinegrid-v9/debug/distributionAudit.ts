
import { Tile, TileKind } from '../types';
import { Solver } from '../services/Solver';

export interface GridStats {
  countsByValue: Record<number, number>;
  percentByBucket: {
    factors: number;
    distractors: number;
    neutrals: number;
  };
  maxValueShare: { val: number, share: number };
  uniqueDistractors: number;
  totalTiles: number;
  isSolvable: boolean;
}

export function getGridStats(grid: (Tile | null)[][], target: number): GridStats {
  const tiles = grid.flat().filter((t): t is Tile => t?.kind === TileKind.NUMBER);
  const total = tiles.length;

  const counts: Record<number, number> = {};
  let factorCount = 0;
  let distractorCount = 0;
  let neutralCount = 0;

  tiles.forEach(t => {
    counts[t.val] = (counts[t.val] || 0) + 1;
    if (t.val === 0 || t.val === 1) neutralCount++;
    else if (target % t.val === 0) factorCount++;
    else distractorCount++;
  });

  let maxVal = -1;
  let maxCount = 0;
  Object.entries(counts).forEach(([val, count]) => {
    if (count > maxCount) {
      maxCount = count;
      maxVal = Number(val);
    }
  });

  const uniqueDistractors = new Set(tiles.filter(t => t.val > 1 && target % t.val !== 0).map(t => t.val)).size;
  const isSolvable = Solver.hasImmediateSolve(grid, target);

  return {
    countsByValue: counts,
    percentByBucket: {
      factors: total ? factorCount / total : 0,
      distractors: total ? distractorCount / total : 0,
      neutrals: total ? neutralCount / total : 0,
    },
    maxValueShare: { val: maxVal, share: total ? maxCount / total : 0 },
    uniqueDistractors,
    totalTiles: total,
    isSolvable
  };
}

export const DEBUG_DISTRIBUTION = true;

export function logDistributionAudit(grid: (Tile | null)[][], target: number, context: string) {
  if (!DEBUG_DISTRIBUTION) return;
  const stats = getGridStats(grid, target);
  console.group(`📊 Distribution Audit: ${context}`);
  console.log(`Target: ${target} | Solvable: ${stats.isSolvable ? '✅ YES' : '❌ NO'}`);
  console.log(`Buckets: F:${(stats.percentByBucket.factors * 100).toFixed(0)}% | D:${(stats.percentByBucket.distractors * 100).toFixed(0)}% | N:${(stats.percentByBucket.neutrals * 100).toFixed(0)}%`);
  console.log(`Dominance: Value ${stats.maxValueShare.val} holds ${(stats.maxValueShare.share * 100).toFixed(0)}% (Cap: 18%)`);
  console.groupEnd();
}
