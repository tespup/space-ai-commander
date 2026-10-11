// ФАЙЛ: src/systems/StarfieldSystem.ts
import * as PIXI from 'pixi.js';
import { app } from '../core/Renderer';
import { levelState } from '../core/LevelManager';
import { time } from '../core/GameTime';

const stars: { sprite: PIXI.Graphics; baseSpeed: number }[] = [];

export function initStarfield() {
  for (let i = 0; i < 150; i++) {
    const star = new PIXI.Graphics().circle(0, 0, Math.random() * 2).fill(0xFFFFFF);
    star.x = Math.random() * app.screen.width;
    star.y = Math.random() * app.screen.height;
    star.alpha = Math.random();
    app.stage.addChild(star);
    stars.push({ sprite: star, baseSpeed: 1 + Math.random() * 4 });
  }

  for (let i = 0; i < 50; i++) {
    const dust = new PIXI.Graphics();
    const coreSize = 0.5 + Math.random() * 0.5;
    const glowSize = coreSize + 1.5 + Math.random() * 1.5;
    
    dust.circle(0, 0, glowSize).fill({ color: 0x00f2ff, alpha: 0.15 });
    dust.circle(0, 0, coreSize).fill({ color: 0xffffff, alpha: 0.8 });
    
    dust.x = Math.random() * app.screen.width;
    dust.y = Math.random() * app.screen.height;
    app.stage.addChild(dust);
    stars.push({ sprite: dust, baseSpeed: 0.5 + Math.random() * 1.5 });
  }
}

export function starfieldUpdate() {
  if (levelState === 'MENU') return;

  stars.forEach((s) => {
    s.sprite.y += s.baseSpeed * time.f;
    if (s.sprite.y > app.screen.height) {
      s.sprite.y = -5;
      s.sprite.x = Math.random() * app.screen.width;
    }
  });
}