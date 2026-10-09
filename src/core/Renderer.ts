// src/core/Renderer.ts
import * as PIXI from 'pixi.js';

export const app = new PIXI.Application();

export async function initRenderer() {
  const container = document.getElementById('app');
  if (!container) return;

  await app.init({
    backgroundAlpha: 0, // Делаем холст прозрачным, чтобы видеть планету позади него
    resizeTo: container,
    antialias: true,
  });

  app.canvas.style.position = 'absolute';
  app.canvas.style.top = '0';
  app.canvas.style.left = '0';
  // Слой 1 — над фоном контейнера, но под UI-экранами
  app.canvas.style.zIndex = '1'; 
  
  container.prepend(app.canvas);

  // Принудительный сброс размеров под контейнер
  app.renderer.resize(container.clientWidth, container.clientHeight);
}