import React from 'react';
import { Theme } from '../types';
import { THEMES } from '../themes';

type ThemeScreenProps = {
    currentTheme: Theme;
    onSelectTheme: (theme: Theme) => void;
    onBack: () => void;
};

const THEME_CHOICES: Theme[] = ['classic', 'kuromi', 'helloKitty'];

export const ThemeScreen = ({ currentTheme, onSelectTheme, onBack }: ThemeScreenProps) => {
    const themeAssets = THEMES[currentTheme];
    
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <h1 className="text-5xl sm:text-6xl font-display mb-8 text-[var(--text-dark)]">Choose a Theme</h1>
            
            <div className="w-full max-w-sm space-y-4">
                {THEME_CHOICES.map((themeKey) => {
                    const theme = THEMES[themeKey];
                    const isSelected = currentTheme === themeKey;
                    
                    return (
                        <div 
                            key={themeKey}
                            onClick={() => onSelectTheme(themeKey)}
                            className={`flex items-center p-3 rounded-2xl cursor-pointer transition-all duration-200 w-full ${isSelected ? 'bg-white ring-4 ring-[var(--combo-bar)]' : 'bg-white/60 hover:bg-white/80'}`}
                            style={{ boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}
                        >
                            <div 
                                className="w-16 h-16 rounded-full flex items-center justify-center text-white text-3xl mr-4 flex-shrink-0"
                                style={{ backgroundColor: theme.iconColor }}
                            >
                                <i className={theme.icon}></i>
                            </div>
                            <span className="text-2xl font-display text-[var(--text-dark)] flex-grow text-left">{theme.displayName}</span>
                            {isSelected && (
                                <div className="text-xl text-green-500 font-bold mr-2">
                                    <i className="fas fa-check-circle"></i>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            
            <button 
                onClick={onBack} 
                className={`theme-button mt-12 bg-gray-500 hover:bg-gray-600 text-white py-3 px-10 text-xl shadow-lg ${themeAssets.ui.button}`}
            >
                Back
            </button>
        </div>
    );
};
