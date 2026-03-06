
import React from 'react';
import { GameEvent } from '../types';

interface LoggerProps {
  events: GameEvent[];
  onClear: () => void;
}

const Logger: React.FC<LoggerProps> = ({ events, onClear }) => {
  return (
    <div className="flex flex-col h-full text-xs font-mono">
      <div className="flex justify-between items-center p-4 border-b border-white/10">
        <h3 className="text-zinc-400 font-bold uppercase">System Logs</h3>
        <button onClick={onClear} className="text-red-400 hover:text-red-300">Clear</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {events.slice().reverse().map((e, i) => (
          <div key={i} className="border-b border-white/5 pb-1">
            <span className="text-zinc-500">[{new Date(e.timestamp || Date.now()).toLocaleTimeString()}]</span>
            <span className="text-orange-400 font-bold ml-2">{e.type}</span>
            <div className="text-zinc-300 pl-4">{e.description}</div>
            {e.matrix && <div className="text-zinc-600 pl-4 text-[10px] truncate">{e.matrix}</div>}
          </div>
        ))}
        {events.length === 0 && <div className="text-zinc-600 italic">No events logged.</div>}
      </div>
    </div>
  );
};

export default Logger;
