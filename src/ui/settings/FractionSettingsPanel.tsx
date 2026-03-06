
import React from 'react'
import type { FractionSettings } from './fractionSettingsTypes'

interface FractionSettingsPanelProps {
  fractionSettings: FractionSettings
  setFractionSettings: (settings: FractionSettings) => void
}

export function FractionSettingsPanel({ fractionSettings, setFractionSettings }: FractionSettingsPanelProps) {

  function toggleEnabled() {
    setFractionSettings({
      ...fractionSettings,
      enabled: !fractionSettings.enabled
    })
  }

  return (
    <div className="ts-settings-section">

      <label className="ts-settings-checkbox flex items-center gap-2 p-2 cursor-pointer hover:bg-gray-50 rounded">

        <input
          type="checkbox"
          checked={fractionSettings.enabled}
          onChange={toggleEnabled}
          className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
        />

        <span className="text-gray-700 font-medium">Enable Fraction Problems (Same Denominator)</span>

      </label>

    </div>
  )
}
