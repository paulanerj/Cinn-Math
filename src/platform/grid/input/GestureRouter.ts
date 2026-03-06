/**
 * GestureRouter — translates DOM pointer/touch events into GridInteraction values.
 *
 * Attach it to a grid container element. It listens for pointer events and
 * emits typed GridInteraction objects to a single callback.
 *
 * Supported gestures:
 *  CHAIN_SELECT (start / extend / commit / cancel)
 *    — pointerdown on a cell → phase 'start'
 *    — pointermove enters another cell (while down) → phase 'extend'
 *    — pointerup → phase 'commit'
 *    — pointercancel / pointer leaves element → phase 'cancel'
 *
 *  TAP_CELL
 *    — pointerdown + pointerup on the same cell with no move → emitted instead of commit
 *    — useful for games that treat taps separately from drags
 *
 *  SWIPE
 *    — fast drag that crosses > SWIPE_THRESHOLD_PX in one direction → emitted on pointerup
 *    — mutually exclusive with CHAIN_SELECT commit
 *
 * Phase B — Grid Runtime Foundation.
 *
 * Usage:
 *   const router = new GestureRouter(el, rows, cols, cellSize, onInteraction);
 *   // ... on unmount ...
 *   router.detach();
 */

import type { GridInteraction, ChainSelect } from '../engine/gridTypes';

const SWIPE_THRESHOLD_PX = 40;

export type InteractionHandler = (interaction: GridInteraction) => void;

interface CellCoord { row: number; col: number }

export class GestureRouter {
  private el: HTMLElement;
  private rows: number;
  private cols: number;
  private cellSize: number;
  private onInteraction: InteractionHandler;

  /** Cells accumulated during the current drag chain */
  private chain: CellCoord[] = [];
  private pointerDown = false;
  private startCell: CellCoord | null = null;
  /** Raw pointer start position for swipe detection */
  private startX = 0;
  private startY = 0;

  constructor(
    el: HTMLElement,
    rows: number,
    cols: number,
    cellSize: number,
    onInteraction: InteractionHandler,
  ) {
    this.el = el;
    this.rows = rows;
    this.cols = cols;
    this.cellSize = cellSize;
    this.onInteraction = onInteraction;
    this.attach();
  }

  /** Update dimensions when grid resizes (e.g. on window resize). */
  updateDimensions(rows: number, cols: number, cellSize: number): void {
    this.rows = rows;
    this.cols = cols;
    this.cellSize = cellSize;
  }

  detach(): void {
    this.el.removeEventListener('pointerdown', this.onPointerDown);
    this.el.removeEventListener('pointermove', this.onPointerMove);
    this.el.removeEventListener('pointerup', this.onPointerUp);
    this.el.removeEventListener('pointercancel', this.onPointerCancel);
    this.el.removeEventListener('pointerleave', this.onPointerLeave);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private attach(): void {
    this.el.addEventListener('pointerdown', this.onPointerDown);
    this.el.addEventListener('pointermove', this.onPointerMove);
    this.el.addEventListener('pointerup', this.onPointerUp);
    this.el.addEventListener('pointercancel', this.onPointerCancel);
    this.el.addEventListener('pointerleave', this.onPointerLeave);
    // Prevent default scroll behaviour while interacting with the grid
    this.el.style.touchAction = 'none';
  }

  private cellAt(clientX: number, clientY: number): CellCoord | null {
    const rect = this.el.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return null;
    return { row, col };
  }

  private sameCell(a: CellCoord, b: CellCoord): boolean {
    return a.row === b.row && a.col === b.col;
  }

  private chainAlreadyContains(cell: CellCoord): boolean {
    return this.chain.some(c => this.sameCell(c, cell));
  }

  private emit(interaction: GridInteraction): void {
    this.onInteraction(interaction);
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const cell = this.cellAt(e.clientX, e.clientY);
    if (!cell) return;

    this.el.setPointerCapture(e.pointerId);
    this.pointerDown = true;
    this.startCell = cell;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.chain = [cell];

    this.emit({
      type: 'CHAIN_SELECT',
      cells: [...this.chain],
      phase: 'start',
    } satisfies ChainSelect);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.pointerDown) return;
    const cell = this.cellAt(e.clientX, e.clientY);
    if (!cell) return;

    const last = this.chain[this.chain.length - 1];
    if (this.sameCell(last, cell)) return; // still in same cell

    // Backtrack: if the entered cell is second-to-last, pop the last cell
    if (this.chain.length >= 2) {
      const prev = this.chain[this.chain.length - 2];
      if (this.sameCell(prev, cell)) {
        this.chain.pop();
        this.emit({
          type: 'CHAIN_SELECT',
          cells: [...this.chain],
          phase: 'extend',
        } satisfies ChainSelect);
        return;
      }
    }

    // Only extend to adjacent (including diagonal) cells
    const dr = Math.abs(last.row - cell.row);
    const dc = Math.abs(last.col - cell.col);
    if (dr > 1 || dc > 1) return;

    // Don't revisit (except backtrack handled above)
    if (this.chainAlreadyContains(cell)) return;

    this.chain.push(cell);
    this.emit({
      type: 'CHAIN_SELECT',
      cells: [...this.chain],
      phase: 'extend',
    } satisfies ChainSelect);
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.pointerDown) return;
    this.pointerDown = false;

    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Swipe: fast, long directional move
    if (dist >= SWIPE_THRESHOLD_PX && this.chain.length <= 2) {
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const direction = absX >= absY
        ? (dx > 0 ? 'right' : 'left')
        : (dy > 0 ? 'down' : 'up');
      const start = this.startCell!;
      this.chain = [];
      this.emit({ type: 'SWIPE', direction, startRow: start.row, startCol: start.col });
      return;
    }

    // Tap: pointer up on same cell without significant move
    const endCell = this.cellAt(e.clientX, e.clientY);
    if (this.chain.length === 1 && endCell && this.sameCell(endCell, this.startCell!)) {
      this.chain = [];
      this.emit({ type: 'TAP_CELL', row: endCell.row, col: endCell.col });
      return;
    }

    // Chain commit
    const committed = [...this.chain];
    this.chain = [];
    this.emit({
      type: 'CHAIN_SELECT',
      cells: committed,
      phase: 'commit',
    } satisfies ChainSelect);
  };

  private onPointerCancel = (): void => {
    if (!this.pointerDown) return;
    this.pointerDown = false;
    const cancelled = [...this.chain];
    this.chain = [];
    this.emit({
      type: 'CHAIN_SELECT',
      cells: cancelled,
      phase: 'cancel',
    } satisfies ChainSelect);
  };

  private onPointerLeave = (): void => {
    // Only cancel if pointer left without an up event (e.g. drag out of window)
    if (!this.pointerDown) return;
    this.onPointerCancel();
  };
}
