// src/core/Renderer.ts
import * as PIXI from 'pixi.js';

export const app = new PIXI.Application();

export async function initRenderer() {
    const container = document.getElementById('app');

    if (!container) return;

    await app.init({
        backgroundAlpha: 0,
        resizeTo: container,

        // Ограничение разрешения для оптимизации FPS на смартфонах
        resolution: Math.min(window.devicePixelRatio || 1, 2),

        autoDensity: true,

        // Отключение сглаживания для повышения производительности
        antialias: false,
    });

    // Ограничение частоты кадров: не более 60 FPS
    app.ticker.maxFPS = 60;

    // Дополнительно ограничиваем общий Ticker, если он используется в проекте
    PIXI.Ticker.shared.maxFPS = 60;

    app.canvas.style.position = 'absolute';
    app.canvas.style.top = '0';
    app.canvas.style.left = '0';
    app.canvas.style.zIndex = '1';

    container.prepend(app.canvas);

    app.renderer.resize(container.clientWidth, container.clientHeight);
}