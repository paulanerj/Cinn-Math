
import { Tile } from '../types';

/** 
 * Produces a stable "fingerprint" of the grid state.
 * format: [ShortID]:[TypeChar]:[Value]
 */
export function gridDigest(grid: (Tile | null)[][]): string {
  if (!grid || grid.length === 0) return 'EMPTY_GRID';
  
  return grid.flat().map(t => {
    if (!t) return '_';
    const kindChar = t.kind[0].toUpperCase();
    const opFlag = t.op ? `(${t.op})` : '';
    return `${t.id.slice(0, 3)}:${kindChar}:${t.val}${opFlag}`;
  }).join('|');
}

/** 
 * Produces a human-readable ASCII table for console debugging.
 */
export function gridToAscii(grid: (Tile | null)[][]): string {
  if (!grid || grid.length === 0) return '--- NO GRID DATA ---';
  
  return grid.map((row, r) => {
    const rowContent = row.map(t => {
      if (!t) return ' . ';
      const val = t.kind === 'op' ? t.op : t.val;
      return ` ${val} `;
    }).join('|');
    return `R${r}: |${rowContent}|`;
  }).join('\n');
}
