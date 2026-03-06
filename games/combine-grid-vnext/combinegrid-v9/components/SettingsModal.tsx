
import React, { useState } from 'react';
import { GameEvent, TargetSource } from '../types';
import Logger from './Logger';

interface RestartConfig {
  rows: number;
  cols: number;
  mode: TargetSource;
  practiceSet: number[];
  recipe: number[];
}

interface SettingsModalProps {
  onClose: () => void;
  onRestart: (config: RestartConfig) => void;
  currentRows: number;
  currentCols: number;
  currentPracticeSet?: number[];
  currentMode?: TargetSource;
  currentRecipe?: number[];
  events: GameEvent[];
  onClearLogs: () => void;
}

const DEFAULT_PRACTICE = [2,3,4,5,6];
const DEFAULT_RECIPE = [12,15,24,32,56];

const MULTIPLIER_OPTIONS = [2,3,4,5,6,7,8,9,10,11,12];

const SettingsModal: React.FC<SettingsModalProps> = ({
  onClose,
  onRestart,
  currentRows,
  currentCols,
  currentPracticeSet = DEFAULT_PRACTICE,
  currentMode = TargetSource.RECIPE,
  currentRecipe = DEFAULT_RECIPE,
  events,
  onClearLogs
}) => {

  const [activeTab, setActiveTab] = useState<'game'|'system'>('game');

  const [rows,setRows] = useState(currentRows);
  const [cols,setCols] = useState(currentCols);

  const [mode,setMode] = useState<TargetSource>(currentMode);

  const [practiceSet,setPracticeSet] =
    useState<number[]>(currentPracticeSet);

  const [recipeText,setRecipeText] =
    useState(currentRecipe.join(','));

  function toggleMultiplier(m:number)
  {
    if(practiceSet.includes(m))
    {
      setPracticeSet(practiceSet.filter(x=>x!==m));
    }
    else
    {
      setPracticeSet([...practiceSet,m].sort((a,b)=>a-b));
    }
  }

  function parseRecipe(text:string):number[]
  {
    return text
      .split(',')
      .map(s=>parseInt(s.trim()))
      .filter(n=>!isNaN(n) && n>0);
  }

  const handleApply = () =>
  {
    const recipe = parseRecipe(recipeText);

    onRestart({
      rows,
      cols,
      mode,
      practiceSet: practiceSet.length
        ? practiceSet
        : DEFAULT_PRACTICE,
      recipe: recipe.length
        ? recipe
        : DEFAULT_RECIPE
    });
  };

  return(
  <div className="fixed inset-0 z-[2000] bg-black/80 flex items-center justify-center p-4">

    <div className="bg-[#1a1a1c] w-full max-w-2xl h-[80vh] rounded-3xl flex flex-col overflow-hidden shadow-2xl border border-white/5">

      <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#202022]">

        <h2 className="text-2xl font-black text-white">Configuration</h2>

        <button 
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 transition-colors"
        >✕</button>

      </div>

      <div className="flex border-b border-white/5 px-6 gap-6 bg-[#1a1a1c]">

        <button
          onClick={()=>setActiveTab('game')}
          className={
            activeTab==='game'
            ?'py-4 text-sm font-bold uppercase tracking-widest text-orange-500 border-b-2 border-orange-500'
            :'py-4 text-sm font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300'
          }>
          Gameplay
        </button>

        <button
          onClick={()=>setActiveTab('system')}
          className={
            activeTab==='system'
            ?'py-4 text-sm font-bold uppercase tracking-widest text-cyan-500 border-b-2 border-cyan-500'
            :'py-4 text-sm font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300'
          }>
          Logs
        </button>

      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-[#141416]">

      {activeTab==='game' && (

      <div className="space-y-8 max-w-md mx-auto pb-10">

      {/* Mode */}
      <div>

      <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2 block">
      Target Mode
      </label>

      <select
        value={mode}
        onChange={e=>setMode(e.target.value as TargetSource)}
        className="w-full bg-zinc-800 text-white p-3 rounded-xl border border-white/5 focus:border-orange-500 outline-none transition-colors">

        <option value={TargetSource.PRACTICE}>
        Practice Mode
        </option>

        <option value={TargetSource.RECIPE}>
        Recipe Mode
        </option>

        <option value={TargetSource.FREE_PLAY}>
        Free Play
        </option>

      </select>

      </div>

      {/* Practice selector */}
      {mode===TargetSource.PRACTICE && (

      <div className="animate-in fade-in slide-in-from-top-1 duration-300">

      <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2 block">
      Study Multiplication Groups
      </label>

      <div className="grid grid-cols-4 gap-2 mt-2">

      {MULTIPLIER_OPTIONS.map(m=>{

      const selected = practiceSet.includes(m);

      return(

      <button
        key={m}
        onClick={()=>toggleMultiplier(m)}
        className={
        selected
        ?"bg-orange-600 text-white py-3 rounded-xl font-black shadow-lg shadow-orange-900/20 ring-2 ring-orange-500"
        :"bg-zinc-800 text-zinc-500 py-3 rounded-xl font-bold hover:bg-zinc-700 transition-colors"
        }
      >

      {m}s

      </button>

      );

      })}

      </div>

      </div>

      )}

      {/* Recipe */}
      {mode===TargetSource.RECIPE && (

      <div className="animate-in fade-in slide-in-from-top-1 duration-300">

      <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2 block">
      Recipe Targets
      </label>

      <input
        value={recipeText}
        onChange={e=>setRecipeText(e.target.value)}
        className="w-full bg-zinc-800 text-white p-3 rounded-xl border border-white/5 focus:border-orange-500 outline-none transition-colors font-mono"
        placeholder="e.g. 12, 15, 24"
      />

      </div>

      )}

      {/* Grid */}
      <div className="space-y-4">

      <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 block">
      Grid Size (Rows: {rows} × Cols: {cols})
      </label>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-800/50 p-4 rounded-xl border border-white/5">
          <span className="text-[10px] text-zinc-600 font-bold uppercase block mb-2">Rows</span>
          <input
            type="range"
            min="4"
            max="9"
            value={rows}
            onChange={e=>setRows(Number(e.target.value))}
            className="w-full accent-orange-500"
          />
        </div>

        <div className="bg-zinc-800/50 p-4 rounded-xl border border-white/5">
          <span className="text-[10px] text-zinc-600 font-bold uppercase block mb-2">Columns</span>
          <input
            type="range"
            min="3"
            max="7"
            value={cols}
            onChange={e=>setCols(Number(e.target.value))}
            className="w-full accent-orange-500"
          />
        </div>
      </div>

      </div>

      <div className="pt-4">
        <button
          onClick={handleApply}
          className="w-full bg-orange-600 hover:bg-orange-500 text-white p-4 rounded-xl font-black uppercase tracking-widest shadow-xl transition-all active:scale-[0.98]">
          Apply & Restart
        </button>
        <p className="text-center mt-3 text-zinc-600 text-[10px] uppercase font-bold tracking-tighter">Resets current progress and applies new configuration</p>
      </div>

      </div>

      )}

      {activeTab==='system' && (

      <div className="h-full">
        <Logger
          events={events}
          onClear={onClearLogs}
        />
      </div>

      )}

      </div>

    </div>

  </div>
  );
};

export default SettingsModal;
