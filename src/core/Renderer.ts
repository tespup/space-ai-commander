// src/core/Renderer.ts
import * as PIXI from 'pixi.js';

export const app = new PIXI.Application();

export async function initRenderer() {
  const container = document.getElementById('app');
  if (!container) return;

  await app.init({
    backgroundAlpha: 0, 
    resizeTo: container,
    // ИСПРАВЛЕНИЕ: Ограничение разрешения для оптимизации FPS на смартфонах
    resolution: Math.min(window.devicePixelRatio || 1, 2), 
    autoDensity: true,
    antialias: false, // ИСПРАВЛЕНИЕ: Отключение сглаживания для повышения производительности
  });

  app.canvas.style.position = 'absolute';
  app.canvas.style.top = '0';
  app.canvas.style.left = '0';
  app.canvas.style.zIndex = '1'; 
  
  container.prepend(app.canvas);

  app.renderer.resize(container.clientWidth, container.clientHeight);
}