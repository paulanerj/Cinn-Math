/**
 * SpeedGridModule — GridGameModule implementation for SpeedGrid.
 *
 * SpeedGrid (timed chain game):
 *  — 6×5 grid of numbered tiles (values 1–9).
 *  — The player chains adjacent tiles whose SUM or PRODUCT equals the target.
 *  — A correct chain clears those tiles; gravity collapses the column and
 *    refills. Target recomputes from the new grid. +2s time bonus per match.
 *  — 90s countdown via tick() accumulation (NOT setInterval).
 *  — Score = targetValue × max(1, chainLength − 1).
 *
 * Phase C — SpeedGrid Consolidation.
 */

import { GridEngine } from '../../engine/GridEngine';
import { GravitySystem, GridCell } from '../../systems/gravity/GravitySystem';
import { ChainSelector } from '../../systems/input/ChainSelector';
import { ScoringSystem } from '../../systems/score/ScoreSystem';
import type { GridGameModule, GridGameState, GridInteraction } from '../../platform/grid/engine/gridTypes';

// ── Constants ──────────────────────────────────────────────────────────────

const ROWS = 6;
const COLS = 5;
const INITIAL_TIME = 90;
const TIME_BONUS = 2;

// ── SpeedGridModule ────────────────────────────────────────────────────────

export class SpeedGridModule implements GridGameModule {
  readonly rows = ROWS;
  readonly cols = COLS;

  private engine: GridEngine;
  private chain: ChainSelector;
  private scorer: ScoringSystem;
  private grid: GridCell[][];
  private target: number;
  private score = 0;
  private phase: GridGameState['phase'] = 'playing';
  private selectedIds = new Set<string>();
  private timeRemaining: number = INITIAL_TIME;
  private timeAccMs: number = 0;
  private operator: 'addition' | 'multiplication';

  constructor(operator: 'addition' | 'multiplication' = 'addition') {
    this.operator = operator;
    this.engine = new GridEngine();
    this.chain = new ChainSelector();
    this.scorer = new ScoringSystem();

    const engineOp: 'sum' | 'product' = operator === 'addition' ? 'sum' : 'product';
    this.engine.startSolverGenerated({ rows: ROWS, cols: COLS, operator: engineOp });

    const raw = this.engine.getInitialGrid(ROWS, COLS);
    this.grid = raw.map((row, r) =>
      row.map((tile, c) => ({
        ...tile,
        id: `${r}-${c}-${Math.random().toString(36).substr(2, 6)}`,
        key: `${r}-${c}-init`,
      }))
    );
    this.target = this._computeTarget();
  }

  // ── GridGameModule interface ───────────────────────────────────────────

  getState(): GridGameState {
    const viewGrid = this.grid.map(row =>
      row.map(cell => ({
        ...cell,
        selected: this.selectedIds.has(cell.id),
      }))
    );
    return {
      grid: viewGrid,
      score: this.score,
      target: this.target,
      timeRemaining: this.timeRemaining,
      phase: this.phase,
    };
  }

  onInteraction(interaction: GridInteraction): void {
    if (this.phase !== 'playing') return;

    switch (interaction.type) {
      case 'TAP_CELL': {
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

      case 'DRAG_SWAP':
      case 'SWIPE':
        break;
    }
  }

  tick(dt: number): void {
    if (this.phase !== 'playing') return;
    this.timeAccMs += dt;
    while (this.timeAccMs >= 1000 && this.timeRemaining > 0) {
      this.timeAccMs -= 1000;
      this.timeRemaining--;
    }
    if (this.timeRemaining <= 0) {
      this.phase = 'gameover';
    }
  }

  destroy(): void {
    this.chain.clear();
    this.selectedIds.clear();
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _commitChain(): void {
    const chainNodes = this.chain.getChain();
    const value = this.chain.evaluateProduct(this.operator);

    this.chain.clear();
    this.selectedIds.clear();

    if (chainNodes.length === 0) return;
    if (value !== this.target) return;

    // Correct chain — clear tiles, apply gravity, award points, +time bonus
    const removedIds = new Set(chainNodes.map(n => n.id));
    const points = this.scorer.addScore(chainNodes.length, this.target);
    this.score += points;
    this.timeRemaining = Math.min(INITIAL_TIME, this.timeRemaining + TIME_BONUS);

    const result = GravitySystem.computeGravity(
      this.grid,
      removedIds,
      () => ({ kind: 'number' as const, val: 1 + Math.floor(Math.random() * 9) }),
    );
    this.grid = result.finalGrid;
    this.target = this._computeTarget();
  }

  private _computeTarget(): number {
    try {
      const engineOp: 'sum' | 'product' = this.operator === 'addition' ? 'sum' : 'product';
      return this.engine.computeSolverTargetFromExternalGrid({
        operator: engineOp,
        gridVals: this.grid.map(r => r.map(c => c.val)),
        pathLenMin: 2,
        pathLenMax: 4,
      }).target;
    } catch {
      return this.grid[0][0].val + this.grid[0][1].val;
    }
  }
}
