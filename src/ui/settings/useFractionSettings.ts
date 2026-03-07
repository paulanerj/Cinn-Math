import { useState, useCallback } from 'react';
import { FractionSettings, DEFAULT_FRACTION_SETTINGS } from './fractionSettingsTypes';

const STORAGE_KEY = 'cinnmath_fraction_settings';

function load(): FractionSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_FRACTION_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_FRACTION_SETTINGS;
}

function save(settings: FractionSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

export function useFractionSettings() {
  const [settings, setSettings] = useState<FractionSettings>(load);

  const updateSettings = useCallback((patch: Partial<FractionSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      save(next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    save(DEFAULT_FRACTION_SETTINGS);
    setSettings(DEFAULT_FRACTION_SETTINGS);
  }, []);

  return { settings, updateSettings, resetSettings };
}
