import React, { useState } from 'react';
import FractionSettingsPanel from './FractionSettingsPanel';
import { useFractionSettings } from './useFractionSettings';

interface Props {
  onClose: () => void;
}

export default function SettingsMenu({ onClose }: Props) {
  const { settings, updateSettings, resetSettings } = useFractionSettings();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50 overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-4 bg-white border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-800">Settings</h2>
        <button onClick={onClose} className="text-gray-500 active:opacity-60 font-medium">Close ✕</button>
      </div>

      <div className="p-4 flex flex-col gap-4">
        <FractionSettingsPanel settings={settings} onChange={updateSettings} onReset={resetSettings} />
      </div>
    </div>
  );
}
