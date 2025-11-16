import React from 'react';
import { ModalWrapper } from './ModalWrapper';
import { Theme, SelectionMode, ThemeAssets } from '../types';

type MenuModalProps = {
    show: boolean;
    onResume: () => void;
    onRestart: () => void;
    onReturnToMenu: () => void;
    volume: number;
    onVolumeChange: (v: number) => void;
    onGoToThemes: () => void;
    selectionMode: SelectionMode | null;
    showValueIndicator: boolean;
    onShowValueIndicatorChange: (v: boolean) => void;
    themeAssets: ThemeAssets;
};

export const MenuModal = ({ show, onResume, onRestart, onReturnToMenu, volume, onVolumeChange, onGoToThemes, selectionMode, showValueIndicator, onShowValueIndicatorChange, themeAssets }: MenuModalProps) => {
    
    const buttonClasses = `theme-button py-3 px-8 text-lg shadow-md w-full ${themeAssets.ui.button}`;
    
    return (
        <ModalWrapper show={show} modalContentClass={themeAssets.ui.modalContent}>
            <h2 className="text-4xl sm:text-5xl font-display mb-6 text-gray-700">PAUSED</h2>
            <div className="flex flex-col space-y-3">
                <button onClick={onResume} className={`${buttonClasses} bg-green-500 hover:bg-green-600 text-white`}>RESUME</button>
                <button onClick={onRestart} className={`${buttonClasses} bg-blue-500 hover:bg-blue-600 text-white`}>RESTART</button>
                
                <div className="pt-2">
                     <label className="block text-sm font-bold text-gray-600 mb-2">SETTINGS</label>
                     {selectionMode === 'drag' && (
                        <div className="flex items-center justify-between bg-white/50 p-2 rounded-lg mb-2">
                            <label htmlFor="value-indicator-toggle" className="text-sm font-bold text-gray-600">Show Value Indicator</label>
                            <button onClick={() => onShowValueIndicatorChange(!showValueIndicator)} className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${showValueIndicator ? 'bg-green-400' : 'bg-gray-300'}`}>
                                <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${showValueIndicator ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                    )}
                    <label className="block text-sm font-bold text-gray-600 mb-2">VOLUME</label>
                    <div className="flex items-center space-x-2">
                        <i className="fas fa-volume-mute text-lg text-gray-500"></i>
                        <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => onVolumeChange(parseFloat(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                        <i className="fas fa-volume-up text-lg text-gray-500"></i>
                    </div>
                </div>
                 <div className="pt-2">
                     <button onClick={onGoToThemes} className={`${buttonClasses} bg-purple-500 hover:bg-purple-600 text-white`}>CHANGE THEME</button>
                </div>
                <button onClick={onReturnToMenu} className={`${buttonClasses} bg-gray-500 hover:bg-gray-600 text-white mt-2`}>MAIN MENU</button>
            </div>
        </ModalWrapper>
    );
};
