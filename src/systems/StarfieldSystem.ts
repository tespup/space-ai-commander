// ФАЙЛ: src/systems/StarfieldSystem.ts
import * as PIXI from 'pixi.js';
import { app } from '../core/Renderer';
import { levelState } from '../core/LevelManager';

const stars: { sprite: PIXI.Graphics; baseSpeed: number }[] = [];

export function initStarfield() {
  // Обычные звёзды
  for (let i = 0; i < 150; i++) {
    const star = new PIXI.Graphics().circle(0, 0, Math.random() * 2).fill(0xFFFFFF);
    star.x = Math.random() * app.screen.width;
    star.y = Math.random() * app.screen.height;
    star.alpha = Math.random();
    app.stage.addChild(star);
    stars.push({ sprite: star, baseSpeed: 1 + Math.random() * 4 });
  }

  // Космическая пыль (мелкие песчинки с затухающим свечением)
  for (let i = 0; i < 50; i++) {
    const dust = new PIXI.Graphics();
    const coreSize = 0.5 + Math.random() * 0.5;     // Очень маленькое ядро (песчинка)
    const glowSize = coreSize + 1.5 + Math.random() * 1.5; // Радиус свечения

    // Свечение (glow)
    dust.circle(0, 0, glowSize).fill({ color: 0x00f2ff, alpha: 0.15 });
    // Ядро (core)
    dust.circle(0, 0, coreSize).fill({ color: 0xffffff, alpha: 0.8 });

    dust.x = Math.random() * app.screen.width;
    dust.y = Math.random() * app.screen.height;
    app.stage.addChild(dust);
    stars.push({ sprite: dust, baseSpeed: 0.5 + Math.random() * 1.5 });
  }
}

/**
 * Обновление звёздного поля.
 * @param deltaFrames — количество "кадров при 60 FPS" прошедших за тик.
 *                      При 60 FPS = 1.0, при 30 FPS = 2.0.
 */
export function starfieldUpdate(deltaFrames: number) {
  // В главном меню звёзды и пыль стоят на месте (двигаются только параллаксом сцены)
  if (levelState === 'MENU') return;

  for (const s of stars) {
    // Было: s.sprite.y += s.baseSpeed (зависело от FPS)
    // Стало: умножаем на deltaFrames
    s.sprite.y += s.baseSpeed * deltaFrames;

    if (s.sprite.y > app.screen.height) {
      s.sprite.y = -5;
      s.sprite.x = Math.random() * app.screen.width;
    }
  }
}