import { useCallback, useReducer } from 'react';
import { Tile, GridPos, GamePhase } from '../types';
import { ROWS, COLS, ROUNDS_PER_SESSION } from '../constants';
import {
  buildGrid,
  countValidPairs,
  countBombs,
  removeTiles,
  applyGravity,
} from '../services/GridService';
import {
  emptySelection,
  selectTile,
  isPairComplete,
  pairMultiplies,
  Selection,
} from '../services/SelectionService';
import { GridEngine } from '../../../engine/GridEngine';
import { PracticeProfile } from '../../../engine/PracticeProfile';
import { EngineSession } from '../../../engine/EngineSession';

export type GameState = {
  grid: Tile[][];
  target: number;
  phase: GamePhase;
  selection: Selection;
  trophies: number;
  score: number;
  round: number;
  message: string;
};

type Action =
  | { type: 'START_ROUND'; grid: Tile[][]; target: number }
  | { type: 'SELECT_TILE'; pos: GridPos }
  | { type: 'CLEAR_PAIR'; positions: GridPos[] }
  | { type: 'APPLY_GRAVITY' }
  | { type: 'REFILL_TILE'; pos: GridPos; tile: Tile }
  | { type: 'STALEMATE' }
  | { type: 'ROUND_OVER'; trophies: number }
  | { type: 'NEXT_ROUND'; grid: Tile[][]; target: number }
  | { type: 'FINAL' }
  | { type: 'SET_MESSAGE'; msg: string };

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'START_ROUND':
      return { ...state, grid: action.grid, target: action.target, phase: 'IDLE', selection: emptySelection(), message: '' };
    case 'SELECT_TILE': {
      const newSel = selectTile(state.selection, action.pos, state.grid);
      return { ...state, selection: newSel, phase: 'SELECTING' };
    }
    case 'CLEAR_PAIR': {
      const cleared = removeTiles(state.grid, action.positions);
      return { ...state, grid: cleared, selection: emptySelection(), phase: 'CLEARING', score: state.score + 10 };
    }
    case 'APPLY_GRAVITY': {
      const fallen = applyGravity(state.grid);
      return { ...state, grid: fallen, phase: 'FALLING' };
    }
    case 'REFILL_TILE': {
      const next = state.grid.map(row => row.map(t => ({ ...t })));
      next[action.pos.r][action.pos.c] = action.tile;
      return { ...state, grid: next, phase: 'IDLE' };
    }
    case 'STALEMATE':
      return { ...state, phase: 'STALEMATE', message: 'No more moves!' };
    case 'ROUND_OVER':
      return { ...state, phase: 'ROUND_OVER', trophies: state.trophies + action.trophies };
    case 'NEXT_ROUND':
      return { ...state, grid: action.grid, target: action.target, phase: 'IDLE', selection: emptySelection(), round: state.round + 1, message: '' };
    case 'FINAL':
      return { ...state, phase: 'FINAL' };
    case 'SET_MESSAGE':
      return { ...state, message: action.msg };
    default:
      return state;
  }
}

function makeInitialState(): GameState {
  return {
    grid: [],
    target: 12,
    phase: 'IDLE',
    selection: emptySelection(),
    trophies: 0,
    score: 0,
    round: 1,
    message: '',
  };
}

export function useGameState() {
  const [state, dispatch] = useReducer(reducer, makeInitialState());

  const engineRef = { current: null as GridEngine | null };

  const startNewRound = useCallback((engine: GridEngine, target: number) => {
    engine.startRound(target, ROWS, COLS, [2, 3, 4, 5, 6]);
    const engineGrid = engine.getInitialGrid(ROWS, COLS);
    const grid = buildGrid(engineGrid, ROWS, COLS);
    dispatch({ type: 'START_ROUND', grid, target });
  }, []);

  const handleTilePress = useCallback((pos: GridPos, engine: GridEngine, target: number) => {
    const newSel = selectTile(state.selection, pos, state.grid);
    if (!isPairComplete(newSel)) {
      dispatch({ type: 'SELECT_TILE', pos });
      return;
    }

    // Pair selected — check if valid
    if (pairMultiplies(newSel as any, state.grid, target)) {
      const positions = [newSel.first!, newSel.second!];
      dispatch({ type: 'CLEAR_PAIR', positions });

      setTimeout(() => {
        dispatch({ type: 'APPLY_GRAVITY' });

        setTimeout(() => {
          // Check stalemate
          const fallen = applyGravity(removeTiles(state.grid, positions));
          const validCount = countValidPairs(fallen, target);
          const bombCount = countBombs(fallen);
          if (validCount === 1 && bombCount === 0) {
            dispatch({ type: 'STALEMATE' });
          } else {
            dispatch({ type: 'SET_MESSAGE', msg: '' });
          }
        }, 300);
      }, 200);
    } else {
      dispatch({ type: 'SET_MESSAGE', msg: 'Those don\'t multiply to ' + target });
      dispatch({ type: 'START_ROUND', grid: state.grid, target });
    }
  }, [state]);

  return { state, dispatch, startNewRound, handleTilePress };
}
