
import React from 'react';

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  currentOperator: 'addition' | 'multiplication';
  onOperatorChange: (op: 'addition' | 'multiplication') => void;
}

const SettingsMenu: React.FC<SettingsMenuProps> = ({ isOpen, onClose, currentOperator, onOperatorChange }) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-[100]">
      <div className="bg-sky-900 p-8 rounded-3xl border border-sky-500/30 w-full max-w-sm shadow-2xl">
        <h2 className="text-2xl font-black text-white mb-6 uppercase tracking-widest text-center">Settings</h2>
        
        <div className="mb-8">
          <label className="text-sky-300 text-xs font-bold uppercase tracking-widest mb-3 block">Operator Mode</label>
          <div className="flex gap-2">
            <button 
              onClick={() => onOperatorChange('addition')}
              className={`flex-1 py-3 rounded-xl font-bold transition-all ${currentOperator === 'addition' ? 'bg-amber-500 text-black shadow-lg' : 'bg-sky-950 text-sky-400 hover:bg-sky-800'}`}
            >
              Addition (+)
            </button>
            <button 
              onClick={() => onOperatorChange('multiplication')}
              className={`flex-1 py-3 rounded-xl font-bold transition-all ${currentOperator === 'multiplication' ? 'bg-amber-500 text-black shadow-lg' : 'bg-sky-950 text-sky-400 hover:bg-sky-800'}`}
            >
              Multiply (×)
            </button>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full bg-white/10 hover:bg-white/20 text-white py-4 rounded-xl font-black uppercase tracking-widest transition-colors"
        >
          Resume
        </button>
      </div>
    </div>
  );
};

export default SettingsMenu;
