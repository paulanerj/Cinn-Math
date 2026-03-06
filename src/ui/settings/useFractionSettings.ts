
import { useState } from 'react'
import type { FractionSettings } from './fractionSettingsTypes'

export function useFractionSettings() {
  const [settings, setSettings] = useState<FractionSettings>({
    enabled: false,
    sameDenominator: true
  })

  return {
    fractionSettings: settings,
    setFractionSettings: setSettings
  }
}
