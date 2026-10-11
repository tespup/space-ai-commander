// ФАЙЛ: src/ui/ScreenManager.ts
import { switchMusicForScreen, loadBgImages, menuBgImages } from '../core/AssetLoader';

export function showToast(message: string, isError: boolean = false) {
    const toast = document.createElement('div');
    toast.innerText = message;
    toast.style.position = 'absolute';
    toast.style.top = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    
    const color = isError ? '#ff0033' : '#00f2ff';
    const bg = isError ? 'rgba(255, 0, 51, 0.2)' : 'rgba(0, 242, 255, 0.2)';
    
    toast.style.background = bg;
    toast.style.border = `1px solid ${color}`;
    toast.style.color = color;
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '8px';
    toast.style.zIndex = '1000';
    toast.style.fontFamily = '"Courier New", monospace';
    toast.style.fontWeight = 'bold';
    toast.style.textShadow = `0 0 5px ${color}`;
    toast.style.boxShadow = `0 0 10px ${bg}`;
    toast.style.pointerEvents = 'none';
    toast.style.transition = 'opacity 0.3s ease';
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

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
        'star-map-screen',
        'exit-confirm-screen',
        'game-over-screen' // ИСПРАВЛЕНИЕ: Добавлен экран Game Over
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