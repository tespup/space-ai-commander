// ФАЙЛ: src/ui/ScreenManager.ts
import { switchMusicForScreen, loadBgImages, menuBgImages } from '../core/AssetLoader';

export function showScreen(screenId: string): void {
    const screens = [
        'loader-screen',
        'main-menu',
        'dev-menu',
        'load-screen',
        'settings-screen',
        'casting-screen',
        'library-screen',
        'game-hud',
        'level-complete-screen',
        'ship-select-screen',
        'star-map-screen',      // <-- добавлена звёздная карта
        'exit-confirm-screen'
    ];

    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === screenId) {
                el.classList.remove('hidden');
                el.style.display = id === 'ship-select-screen' ? 'flex' : '';
            } else {
                if (id !== 'exit-confirm-screen' || screenId !== 'exit-confirm-screen') {
                    el.classList.add('hidden');
                }
                if (id === 'ship-select-screen') el.style.display = 'none';
            }
        }
    });

    // Логика установки случайных фонов
    const targetEl = document.getElementById(screenId);
    if (targetEl) {
        if (screenId === 'load-screen' && loadBgImages.length > 0) {
            const bg = loadBgImages[Math.floor(Math.random() * loadBgImages.length)];
            targetEl.style.background = `linear-gradient(rgba(0, 5, 10, 0.7), rgba(0, 5, 10, 0.9)), url("${bg}") center/cover no-repeat`;
        } else if (screenId === 'settings-screen' && menuBgImages.length > 0) {
            const bg = menuBgImages[Math.floor(Math.random() * menuBgImages.length)];
            targetEl.style.background = `linear-gradient(rgba(0, 5, 10, 0.7), rgba(0, 5, 10, 0.9)), url("${bg}") center/cover no-repeat`;
        }
    }

    if (screenId !== 'exit-confirm-screen') {
        switchMusicForScreen(screenId);
    }
}