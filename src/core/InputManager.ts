// ФАЙЛ: src/core/InputManager.ts
import { levelState } from './LevelManager';
import { time } from './GameTime';

export let targetParallaxX = 0;
export let targetParallaxY = 0;
export let currentParallaxX = 0;
export let currentParallaxY = 0;

export function initInputManager() {
    window.addEventListener('mousemove', (e) => {
        if (levelState !== 'MENU') return;

        targetParallaxX = (e.clientX / window.innerWidth) * 2 - 1;
        targetParallaxY = (e.clientY / window.innerHeight) * 2 - 1;
    });

    window.addEventListener('deviceorientation', (e) => {
        if (levelState !== 'MENU') return;

        if (e.gamma !== null && e.beta !== null) {
            targetParallaxX = Math.max(-1, Math.min(1, e.gamma / 45));
            targetParallaxY = Math.max(-1, Math.min(1, (e.beta - 45) / 45));
        }
    });
}

export function updateParallax() {
    const k = 1 - Math.pow(1 - 0.05, time.f);

    currentParallaxX += (targetParallaxX - currentParallaxX) * k;
    currentParallaxY += (targetParallaxY - currentParallaxY) * k;
}

export function resetParallax() {
    currentParallaxX = 0;
    currentParallaxY = 0;
}