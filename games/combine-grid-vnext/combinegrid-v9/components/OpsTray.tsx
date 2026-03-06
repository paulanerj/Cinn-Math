
import React from 'react';
import { OpType, TileKind } from '../types';
import Tile from './Tile';

interface OpsTrayProps {
  onDragStart: (op: OpType, e: React.PointerEvent) => void;
}

const OPS: OpType[] = ['+', '-', '×', '÷', '='];

/**
 * PURPOSE: Toolbox for Replace mode.
 * OWNERSHIP: Static source of operation tiles.
 */
const OpsTray: React.FC<OpsTrayProps> = ({ onDragStart }) => {
  return (
    <div className="flex justify-center items-center gap-4 p-6 mt-4 bg-zinc-900/50 rounded-3xl border border-zinc-800 shadow-xl">
      {OPS.map((op) => (
        <div key={op} className="relative w-16 h-16">
          <div
            className="w-full h-full cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => onDragStart(op, e)}
          >
            <Tile
              tile={{
                id: `tray-${op}`,
                r: 0,
                c: 0,
                kind: TileKind.OP,
                val: 0,
                op: op,
                fixed: false,
              }}
              tileSize={60}
              x={0}
              y={0}
              isTrayOp
            />
          </div>
        </div>
      ))}
      <div className="ml-4 flex flex-col items-start opacity-50">
        <span className="text-[10px] font-black uppercase tracking-tighter text-zinc-500">Operation Tray</span>
        <span className="text-[9px] font-bold text-zinc-600">Drag to Grid</span>
      </div>
    </div>
  );
};

export default OpsTray;
