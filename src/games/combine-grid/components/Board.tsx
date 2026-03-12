import React from 'react';
import Tile from './Tile';
import { Tile as TileType, GridPos } from '../types';
import { GAP } from '../uiTokens';
import { isSelected, selectionIndex } from '../services/SelectionService';

interface BoardProps {
  grid: TileType[][];
  tileSize: number;
  selection: GridPos[];
  clearingPositions: GridPos[];
  newTileIds: Set<string>;
  onTilePress: (pos: GridPos) => void;
  shake: boolean;
}

export default function Board({
  grid,
  tileSize,
  selection,
  clearingPositions,
  newTileIds,
  onTilePress,
  shake,
}: BoardProps) {
  const cols = grid[0]?.length ?? 4;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, ${tileSize}px)`,
        gap: GAP,
        animation: shake ? 'shake 0.30s ease' : undefined,
      }}
    >
      {grid.map((row, r) =>
        row.map((tile, c) => {
          const pos: GridPos = { r, c };
          const sel = isSelected(selection, pos);
          const order = selectionIndex(selection, pos);
          const clearing = clearingPositions.some(
            (p) => p.r === r && p.c === c,
          );
          return (
            <Tile
              key={tile.id}
              tile={tile}
              size={tileSize}
              selected={sel}
              selectionOrder={order}
              clearing={clearing}
              isNew={newTileIds.has(tile.id)}
              onPress={() => onTilePress(pos)}
            />
          );
        }),
      )}
    </div>
  );
}
