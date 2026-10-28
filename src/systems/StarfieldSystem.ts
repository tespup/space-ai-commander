// ФАЙЛ: src/systems/StarfieldSystem.ts
import * as PIXI from 'pixi.js';
import { app } from '../core/Renderer';
import { levelState } from '../core/LevelManager';
import { time } from '../core/GameTime';
import { texCircle8, texDust } from '../core/Textures';

const stars: { sprite: PIXI.Sprite; baseSpeed: number }[] = [];

export function initStarfield() {
  // Общие текстуры вместо 200 индивидуальных Graphics — тот же вид, меньше draw call'ов
  const starTex = texCircle8();
  const dustTex = texDust();

  for (let i = 0; i < 150; i++) {
    const star = new PIXI.Sprite(starTex);
    star.anchor.set(0.5);
    star.scale.set((Math.random() * 2) / 8);
    star.x = Math.random() * app.screen.width;
    star.y = Math.random() * app.screen.height;
    star.alpha = Math.random();
    app.stage.addChild(star);
    stars.push({ sprite: star, baseSpeed: 1 + Math.random() * 4 });
  }

  for (let i = 0; i < 50; i++) {
    const dust = new PIXI.Sprite(dustTex);
    dust.anchor.set(0.5);
    dust.scale.set(0.5 + Math.random() * 0.5);
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