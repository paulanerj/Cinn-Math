
import { Tile } from '../types';

export interface Candidate {
  r: number;
  c: number;
  center: { x: number; y: number };
}

interface SwapRequest {
  sourceCell: Tile;
  candidates: Candidate[];
  pointerEndLocal: { x: number; y: number };
  pointerStartLocal: { x: number; y: number };
  tileSize: number;
}

interface SwapResolution {
  ok: boolean;
  targetCell?: { r: number; c: number };
  reason?: string;
}

export function resolveAdjacentTarget(req: SwapRequest): SwapResolution {
  const { candidates, pointerEndLocal, tileSize } = req;
  
  // Find closest candidate
  let closest: Candidate | null = null;
  let minDistSq = Infinity;
  
  // Threshold: Pointer must be within some distance of the candidate center to count as a deliberate swap to that tile.
  // Usually half a tile size radius.
  const thresholdSq = (tileSize * 0.8) ** 2; // generous hit box

  for (const cand of candidates) {
    const dx = cand.center.x - pointerEndLocal.x;
    const dy = cand.center.y - pointerEndLocal.y;
    const dSq = dx*dx + dy*dy;
    
    if (dSq < minDistSq && dSq < thresholdSq) {
      minDistSq = dSq;
      closest = cand;
    }
  }

  if (closest) {
    return { ok: true, targetCell: { r: closest.r, c: closest.c } };
  }

  return { ok: false, reason: 'NO_TARGET_NEAR_POINTER' };
}
