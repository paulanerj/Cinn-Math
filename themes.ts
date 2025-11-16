import { Theme, ThemeAssets } from './types';

// This is your new centralized asset management file.
// To add a new theme:
// 1. Add the theme name to the `Theme` type in `types.ts`.
// 2. Create a new folder under `/public/assets/themes/yourThemeName/`.
// 3. Add `sfx` and `img` subfolders inside it.
// 4. Place your asset files (e.g., `select.mp3`, `background.png`) in the appropriate folders.
// 5. Add a new entry to this `THEMES` object below, mapping the hooks to your new file paths.

export const THEMES: Record<Theme, ThemeAssets> = {
    classic: {
        displayName: 'Cinnamoroll',
        icon: 'fas fa-cloud',
        iconColor: '#a0e9ff',
        colors: { '--bg-main': '#a0e9ff', '--bg-accent': '#fdf6e3', '--tile-main': '#ffffff', '--tile-selected': '#80d8ff', '--tile-time': '#fde488', '--text-dark': '#003d73', '--combo-bar': '#ff8fab' },
        sounds: {
            select: 'https://cdn.pixabay.com/audio/2022/03/15/audio_22d13a695d.mp3',
            match_L1: 'https://cdn.pixabay.com/audio/2022/11/17/audio_88f208c54d.mp3',
            match_L2: 'https://cdn.pixabay.com/audio/2022/11/17/audio_b721614263.mp3',
            match_L3: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c3b09232c6.mp3',
            match_L4: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c3b09232c6.mp3',
            combo: 'https://cdn.pixabay.com/audio/2022/10/17/audio_a035a92a0d.mp3',
            bonus: 'https://cdn.pixabay.com/audio/2022/10/17/audio_a035a92a0d.mp3',
            gameover: 'https://cdn.pixabay.com/audio/2022/03/10/audio_51888a3852.mp3',
            error: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c6f2c31499.mp3',
        },
        textures: {
            '--bg-main-texture': 'url("/assets/themes/classic/img/bg.png")',
            '--tile-main-texture': 'url("/assets/themes/classic/img/tile.png")',
        },
        images: {
            'time-tile-icon': '/assets/themes/classic/img/time-icon.svg',
        },
        ui: {
            button: 'theme-button-classic',
            modalContent: 'theme-modal-classic',
        }
    },
    sakura: {
        displayName: 'Sakura',
        icon: 'fas fa-fan',
        iconColor: '#ffc2d1',
        colors: { '--bg-main': '#ffc2d1', '--bg-accent': '#fff0f3', '--tile-main': '#ffffff', '--tile-selected': '#ff8fab', '--tile-time': '#d3f8e2', '--text-dark': '#5c2751', '--combo-bar': '#a0e9ff' },
        sounds: {
            select: '/assets/themes/sakura/sfx/select.mp3',
            match_L1: '/assets/themes/sakura/sfx/match1.mp3',
            bonus: '/assets/themes/sakura/sfx/bonus.mp3',
            error: '/assets/themes/sakura/sfx/error.mp3',
        },
        textures: {
            '--bg-main-texture': 'url("/assets/themes/sakura/img/bg.png")',
        },
        images: {
            'time-tile-icon': '/assets/themes/sakura/img/time-icon.svg',
        },
        ui: {
            button: 'theme-button-classic', // Reusing classic style
            modalContent: 'theme-modal-classic',
        }
    },
    ocean: {
        displayName: 'Ocean',
        icon: 'fas fa-water',
        iconColor: '#4ecdc4',
        colors: { '--bg-main': '#4ecdc4', '--bg-accent': '#f7fff7', '--tile-main': '#ffffff', '--tile-selected': '#29a0b1', '--tile-time': '#ffc2d1', '--text-dark': '#003459', '--combo-bar': '#fde488' },
        sounds: {
            select: '/assets/themes/ocean/sfx/select.mp3',
            match_L1: '/assets/themes/ocean/sfx/match1.mp3',
            bonus: '/assets/themes/ocean/sfx/bonus.mp3',
            error: '/assets/themes/ocean/sfx/error.mp3',
        },
        textures: {
             '--bg-main-texture': 'url("/assets/themes/ocean/img/bg.png")',
        },
        images: {
            'time-tile-icon': '/assets/themes/ocean/img/time-icon.svg',
        },
        ui: {
            button: 'theme-button-classic', // Reusing classic style
            modalContent: 'theme-modal-classic',
        }
    },
    kuromi: {
        displayName: 'Kuromi',
        icon: 'fas fa-ghost',
        iconColor: '#A288E2',
        colors: { '--bg-main': '#2d004f', '--bg-accent': '#f4b3d8', '--tile-main': '#ffffff', '--tile-selected': '#ff00a0', '--tile-time': '#ff9a00', '--text-dark': '#1e1e1e', '--combo-bar': '#ff00a0' },
        sounds: {
            select: '/assets/themes/kuromi/sfx/select.mp3',
            match_L1: '/assets/themes/kuromi/sfx/match1.mp3',
            bonus: '/assets/themes/kuromi/sfx/bonus.mp3',
            error: '/assets/themes/kuromi/sfx/error.mp3',
        },
        textures: {
            '--bg-main-texture': 'url("/assets/themes/kuromi/img/bg.png")',
        },
        images: {
            'time-tile-icon': '/assets/themes/kuromi/img/time-icon.svg',
        },
        ui: {
            button: 'theme-button-kuromi',
            modalContent: 'theme-modal-kuromi',
        }
    },
    helloKitty: {
        displayName: 'Hello Kitty',
        icon: 'fas fa-heart',
        iconColor: '#ff8fab',
        colors: { '--bg-main': '#fff0f3', '--bg-accent': '#d3e0dc', '--tile-main': '#ffffff', '--tile-selected': '#ff8fab', '--tile-time': '#fdfd96', '--text-dark': '#8b0000', '--combo-bar': '#a0e9ff' },
        sounds: {
             select: '/assets/themes/helloKitty/sfx/select.mp3',
            match_L1: '/assets/themes/helloKitty/sfx/match1.mp3',
            bonus: '/assets/themes/helloKitty/sfx/bonus.mp3',
            error: '/assets/themes/helloKitty/sfx/error.mp3',
        },
        textures: {
             '--bg-main-texture': 'url("/assets/themes/helloKitty/img/bg.png")',
        },
        images: {
            'time-tile-icon': '/assets/themes/helloKitty/img/time-icon.svg',
        },
        ui: {
            button: 'theme-button-classic', // Reusing classic style
            modalContent: 'theme-modal-classic',
        }
    },
};