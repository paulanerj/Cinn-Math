import React, { useMemo } from 'react';
import { Tile as TileType, GridPos } from '../types';
import { Selection } from '../services/SelectionService';
import Tile from './Tile';
import { GAP } from '../uiTokens';

interface BoardProps {
  grid: TileType[][];
  selection: Selection;
  tileSize: number;
  onTilePress: (pos: GridPos) => void;
}

function posKey(p: GridPos) { return `${p.r},${p.c}`; }

export default function Board({ grid, selection, tileSize, onTilePress }: BoardProps) {
  const selectedKeys = useMemo(() => {
    const keys = new Set<string>();
    if (selection.first) keys.add(posKey(selection.first));
    if (selection.second) keys.add(posKey(selection.second));
    return keys;
  }, [selection]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${grid[0]?.length ?? 4}, ${tileSize}px)`,
        gap: GAP,
      }}
    >
      {grid.map((row, r) =>
        row.map((tile, c) => (
          <Tile
            key={tile.id}
            tile={tile}
            size={tileSize}
            selected={selectedKeys.has(posKey({ r, c }))}
            onPress={() => onTilePress({ r, c })}
          />
        ))
      )}
    </div>
  );
}
