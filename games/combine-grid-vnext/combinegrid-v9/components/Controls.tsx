
import React from 'react';
import { EngineMode, AdjacencyMode, TileKind, OpType } from '../types';
import { SoundEngine } from '../services/SoundEngine';

interface ControlsProps {
  mode: EngineMode;
  adjacency: AdjacencyMode;
  onModeChange: (m: EngineMode) => void;
  onAdjacencyChange: (a: AdjacencyMode) => void;
  onUndo: () => void;
  onReset: () => void;
  onSpawnManual: (kind: TileKind, val: number, op: OpType | null) => void;
  canUndo: boolean;
}

const Controls: React.FC<ControlsProps> = ({ 
  mode, adjacency, onModeChange, onAdjacencyChange, onUndo, onReset, onSpawnManual, canUndo 
}) => {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-zinc-800 border-b-2 border-zinc-700 shadow-lg z-50">
      <h1 className="text-indigo-400 font-extrabold uppercase tracking-widest mr-4 text-sm md:text-base">GridEngine V6</h1>
      
      <div className="flex items-center gap-2">
        <label className="text-xs font-bold text-zinc-400 uppercase">Mode:</label>
        <select 
          className="bg-zinc-700 text-white px-3 py-1.5 rounded-lg font-bold text-sm cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500"
          value={mode}
          onChange={(e) => {
            SoundEngine.playTap();
            onModeChange(e.target.value as EngineMode);
          }}
        >
          <option value={EngineMode.SWAP}>Swap</option>
          <option value={EngineMode.COMBINE}>Combine</option>
          <option value={EngineMode.BOMB}>Bomb</option>
          <option value={EngineMode.REPLACE}>Replace (Ops)</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs font-bold text-zinc-400 uppercase">Adjacency:</label>
        <button 
          className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-colors ${adjacency === AdjacencyMode.DIAGONAL ? 'bg-indigo-600' : 'bg-zinc-700'}`}
          onClick={() => {
            SoundEngine.playTap();
            onAdjacencyChange(adjacency === AdjacencyMode.ORTHOGONAL ? AdjacencyMode.DIAGONAL : AdjacencyMode.ORTHOGONAL);
          }}
        >
          {adjacency === AdjacencyMode.ORTHOGONAL ? 'Ortho' : 'Diagonal'}
        </button>
      </div>

      <div className="flex gap-2 ml-auto">
        <button 
          disabled={!canUndo}
          className={`px-3 py-1.5 rounded-lg font-bold text-sm shadow-md transition-all active:translate-y-0.5 ${canUndo ? 'bg-zinc-600 hover:bg-zinc-500' : 'bg-zinc-800 text-zinc-600 opacity-50'}`}
          onClick={() => {
            SoundEngine.playTap();
            onUndo();
          }}
        >
          Undo
        </button>
        <button 
          className="px-3 py-1.5 rounded-lg bg-zinc-600 hover:bg-zinc-500 font-bold text-sm shadow-md transition-all active:translate-y-0.5"
          onClick={() => {
            SoundEngine.playTap();
            onReset();
          }}
        >
          Reset
        </button>
      </div>

      <div className="w-full h-px bg-zinc-700 my-1 md:hidden" />

      <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar pb-1">
        <span className="text-[10px] font-bold text-zinc-500 uppercase whitespace-nowrap">Spawn:</span>
        <button className="bg-red-600 px-2 py-1 rounded text-xs font-bold whitespace-nowrap" onClick={() => { SoundEngine.playTap(); onSpawnManual(TileKind.BOMB, 3, null); }}>+Bomb</button>
        <button className="bg-amber-600 px-2 py-1 rounded text-xs font-bold whitespace-nowrap" onClick={() => { SoundEngine.playTap(); onSpawnManual(TileKind.TROPHY, 10, null); }}>+Trophy</button>
        <button className="bg-purple-600 px-2 py-1 rounded text-xs font-bold whitespace-nowrap" onClick={() => { SoundEngine.playTap(); onSpawnManual(TileKind.OP, 0, '+'); }}>+Add</button>
        <button className="bg-zinc-900 px-2 py-1 rounded text-xs font-bold whitespace-nowrap border border-zinc-700" onClick={() => { SoundEngine.playTap(); onSpawnManual(TileKind.BLANK, 0, null); }}>+Blank</button>
      </div>
    </div>
  );
};

export default Controls;
