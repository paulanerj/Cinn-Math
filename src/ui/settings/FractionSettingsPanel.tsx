import React from 'react';
import { FractionSettings } from './fractionSettingsTypes';

interface Props {
  settings: FractionSettings;
  onChange: (patch: Partial<FractionSettings>) => void;
  onReset: () => void;
}

const AVAILABLE_DENOMINATORS = [2, 3, 4, 5, 6, 8, 10];

export default function FractionSettingsPanel({ settings, onChange, onReset }: Props) {
  function toggleDenominator(d: number) {
    const cur = settings.denominators;
    const next = cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d].sort((a, b) => a - b);
    onChange({ denominators: next });
  }

  return (
    <div className="p-4 bg-white rounded-2xl shadow gap-4 flex flex-col">
      <h3 className="font-bold text-gray-800 text-lg">Fraction Settings</h3>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={settings.enableFractions}
          onChange={e => onChange({ enableFractions: e.target.checked })}
          className="w-5 h-5 accent-indigo-600"
        />
        <span className="text-gray-700">Enable fractions</span>
      </label>

      {settings.enableFractions && (
        <>
          <div>
            <p className="text-sm text-gray-500 mb-2">Denominators</p>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_DENOMINATORS.map(d => (
                <button
                  key={d}
                  onClick={() => toggleDenominator(d)}
                  className={`px-3 py-1 rounded-lg text-sm font-semibold border
                    ${settings.denominators.includes(d)
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300'}`}
                >
                  /{d}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.simplifyRequired}
              onChange={e => onChange({ simplifyRequired: e.target.checked })}
              className="w-5 h-5 accent-indigo-600"
            />
            <span className="text-gray-700">Require simplified answers</span>
          </label>
        </>
      )}

      <button onClick={onReset} className="text-sm text-gray-400 underline self-start">Reset to defaults</button>
    </div>
  );
}
