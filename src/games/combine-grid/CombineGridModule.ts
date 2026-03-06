/**
 * CombineGridModule — GridGameModule implementation for CombineGrid.
 *
 * CombineGrid (factor-chain game):
 *  — The board is a ROWS×COLS grid of numbered tiles (values 1–12).
 *  — The player chains adjacent tiles whose PRODUCT equals the current target.
 *  — A correct chain clears those tiles; gravity collapses the column and
 *    refills from above. The target advances to the next value.
 *  — Score = targetValue × max(1, chainLength − 1).
 *
 * This module WRAPS existing engine primitives without rewriting them:
 *  — GridEngine     — target sequencing and tile spawning
 *  — GravitySystem  — column collapse + refill
 *  — ChainSelector  — adjacency / backtrack validation
 *  — ScoringSystem  — score calculation
 *
 * Interaction contract (from gridTypes.ts):
 *  CHAIN_SELECT phase='start'   → begin a new chain at the given cell
 *  CHAIN_SELECT phase='extend'  → update the chain to the given cell list
 *  CHAIN_SELECT phase='commit'  → evaluate product; clear if correct
 *  CHAIN_SELECT phase='cancel'  → discard the current chain
 *  TAP_CELL                     → treated as single-cell chain + immediate commit
 *
 * Phase B — Grid Runtime Foundation.
 */

import { GridEngine } from '../../engine/GridEngine';
import { GravitySystem, GridCell } from '../../systems/gravity/GravitySystem';
import { ChainSelector } from '../../systems/input/ChainSelector';
import { ScoringSystem } from '../../systems/score/ScoreSystem';
import type { GridGameModule, GridGameState, GridInteraction } from '../../platform/grid/engine/gridTypes';

// ── Constants ──────────────────────────────────────────────────────────────

const ROWS = 7;
const COLS = 5;

// ── Tile color palette (by value) ─────────────────────────────────────────

const VALUE_COLORS: Record<number, string> = {
  1:  '#6b7280', // gray-500
  2:  '#3b82f6', // blue-500
  3:  '#10b981', // emerald-500
  4:  '#8b5cf6', // violet-500
  5:  '#f59e0b', // amber-500
  6:  '#ec4899', // pink-500
  7:  '#ef4444', // red-500
  8:  '#06b6d4', // cyan-500
  9:  '#84cc16', // lime-500
  10: '#f97316', // orange-500
  11: '#a78bfa', // violet-400
  12: '#14b8a6', // teal-500
};

function tileColor(val: number): string {
  return VALUE_COLORS[val] ?? '#4b5563';
}

// ── CombineGridModule ──────────────────────────────────────────────────────

export class CombineGridModule implements GridGameModule {
  readonly rows = ROWS;
  readonly cols = COLS;

  private engine: GridEngine;
  private chain: ChainSelector;
  private scorer: ScoringSystem;
  private grid: GridCell[][];
  private target: number;
  private score = 0;
  private phase: GridGameState['phase'] = 'playing';

  /** Set of tile IDs currently in the active chain (for selected highlight) */
  private selectedIds = new Set<string>();

  constructor() {
    this.engine = new GridEngine();
    this.chain  = new ChainSelector();
    this.scorer = new ScoringSystem();

    // Start a free-play session so targets keep cycling
    this.engine.startFreePlay();
    this.target = this.engine.currentTarget();

    // Build initial grid
    this.engine.startRound(this.target, ROWS, COLS, []);
    const raw = this.engine.getInitialGrid(ROWS, COLS);
    this.grid = raw.map((row, r) =>
      row.map((tile, c) => ({
        ...tile,
        id:  `${r}-${c}-${Math.random().toString(36).substr(2, 6)}`,
        key: `${r}-${c}-init`,
      }))
    );
  }

  // ── GridGameModule interface ───────────────────────────────────────────

  getState(): GridGameState {
    // Build a view-ready grid reflecting selected state
    const viewGrid = this.grid.map(row =>
      row.map(cell => ({
        ...cell,
        selected: this.selectedIds.has(cell.id),
      }))
    );
    return {
      grid:   viewGrid,
      score:  this.score,
      target: this.target,
      phase:  this.phase,
    };
  }

  onInteraction(interaction: GridInteraction): void {
    if (this.phase !== 'playing') return;

    switch (interaction.type) {
      case 'TAP_CELL': {
        // Treat tap as a single-tile chain + immediate commit
        const cell = this.grid[interaction.row]?.[interaction.col];
        if (!cell) return;
        this.chain.start({ r: interaction.row, c: interaction.col, val: cell.val, id: cell.id });
        this.selectedIds = new Set([cell.id]);
        this._commitChain();
        break;
      }

      case 'CHAIN_SELECT': {
        const cells = interaction.cells;
        if (cells.length === 0) return;

        if (interaction.phase === 'start') {
          const first = cells[0];
          const cell = this.grid[first.row]?.[first.col];
          if (!cell) return;
          this.chain.start({ r: first.row, c: first.col, val: cell.val, id: cell.id });
          this.selectedIds = new Set([cell.id]);
          return;
        }

        if (interaction.phase === 'extend') {
          // Re-build the chain from the authoritative cell list provided by GestureRouter
          // (GestureRouter already validates adjacency; we rebuild cleanly)
          const first = cells[0];
          const firstCell = this.grid[first.row]?.[first.col];
          if (!firstCell) return;
          this.chain.start({ r: first.row, c: first.col, val: firstCell.val, id: firstCell.id });
          this.selectedIds = new Set([firstCell.id]);
          for (let i = 1; i < cells.length; i++) {
            const c = cells[i];
            const tile = this.grid[c.row]?.[c.col];
            if (!tile) break;
            this.chain.addToChain({ r: c.row, c: c.col, val: tile.val, id: tile.id });
            this.selectedIds.add(tile.id);
          }
          return;
        }

        if (interaction.phase === 'commit') {
          this._commitChain();
          return;
        }

        if (interaction.phase === 'cancel') {
          this.chain.clear();
          this.selectedIds.clear();
          return;
        }
        break;
      }

      // DRAG_SWAP and SWIPE are not used by CombineGrid — silently ignore
      case 'DRAG_SWAP':
      case 'SWIPE':
        break;
    }
  }

  tick(_dt: number): void {
    // CombineGrid is event-driven; no per-frame simulation needed.
    // Timer-based mode can be added here later without touching the contract.
  }

  destroy(): void {
    this.chain.clear();
    this.selectedIds.clear();
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _commitChain(): void {
    const chainNodes = this.chain.getChain();
    const product    = this.chain.evaluateProduct('multiplication');

    // Clear selection regardless
    this.chain.clear();
    this.selectedIds.clear();

    if (chainNodes.length === 0) return;

    if (product !== this.target) {
      // Wrong product — flash handled by view (selected goes back to normal)
      return;
    }

    // ✅ Correct chain — clear tiles and apply gravity
    const removedIds = new Set(chainNodes.map(n => n.id));
    const points = this.scorer.addScore(chainNodes.length, this.target);
    this.score += points;

    const result = GravitySystem.computeGravity(
      this.grid,
      removedIds,
      () => this.engine.getRefillTile(),
    );
    this.grid = result.finalGrid;

    // Advance target
    this.target = this.engine.nextTarget();
    this.engine.startRound(this.target, ROWS, COLS, []);
  }
}
