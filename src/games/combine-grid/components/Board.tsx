import React from 'react';
import Tile from './Tile';
import { GridPos } from '../types';
import { GAP } from '../uiTokens';
import { isSelected } from '../services/SelectionService';

interface BoardProps {
  grid: number[][];
  tileSize: number;
  selection: GridPos[];
  clearingPositions: GridPos[];
  onTilePress: (pos: GridPos) => void;
}

export default function Board({
  grid,
  tileSize,
  selection,
  clearingPositions,
  onTilePress,
}: BoardProps) {
  const cols = grid[0]?.length ?? 4;

  return (
    <div
      style={{
        background: 'rgba(0,0,0,0.30)',
        borderRadius: 12,
        padding: 6,
        boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.40)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, ${tileSize}px)`,
          gap: GAP,
        }}
      >
        {grid.map((row, r) =>
          row.map((val, c) => {
            const pos: GridPos = { row: r, col: c };
            const sel = isSelected(selection, pos);
            const clearing = clearingPositions.some((p) => p.row === r && p.col === c);
            return (
              <Tile
                key={`${r},${c}`}
                val={val}
                size={tileSize}
                selected={sel}
                clearing={clearing}
                onPress={() => onTilePress(pos)}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}
