
import React from 'react'
import { FractionSettingsPanel } from './FractionSettingsPanel'
import type { FractionSettings } from './fractionSettingsTypes'

interface SettingsMenuProps {
  difficulty: number
  setDifficulty: (d: number) => void
  onClose: () => void
  fractionSettings: FractionSettings
  setFractionSettings: (s: FractionSettings) => void
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({
  difficulty,
  setDifficulty,
  onClose,
  fractionSettings,
  setFractionSettings
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white p-6 rounded-2xl shadow-xl w-96 max-w-[90vw] transform transition-all">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Settings</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Difficulty Section */}
          <div className="ts-settings-section">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Difficulty Level: <span className="text-blue-600">{difficulty}</span>
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Easy</span>
              <span>Master</span>
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          {/* Fraction Settings */}
          <FractionSettingsPanel 
            fractionSettings={fractionSettings}
            setFractionSettings={setFractionSettings}
          />
        </div>

        <button
          onClick={onClose}
          className="mt-8 w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-lg shadow-blue-200"
        >
          Done
        </button>
      </div>
    </div>
  )
}
