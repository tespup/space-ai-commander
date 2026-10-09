// ФАЙЛ: src/systems/PlayerControlSystem.ts
import { query } from 'bitecs';
import { world } from '../core/world';
import { Position } from '../components/Position';
import { Velocity } from '../components/Velocity';
import { Attributes } from '../components/Attributes';
import { app } from '../core/Renderer';
import { levelState } from '../core/LevelManager';
import { getActiveEnemies } from './EnemySpawnSystem';
import { lerpPerFrame } from '../core/TimeUtils';

let targetX = 0;
let targetY = 0;
// ПЕРЕВОД НА ВРЕМЯ: было 90 кадров = 1500 мс при 60 FPS
let timerMS = 0;
const TARGET_CHANGE_MS = 1500;

export function initPlayerControl() {
  targetX = app.screen.width / 2;
  targetY = app.screen.height - 100;
}

export function playerControlSystem(deltaMS: number, deltaFrames: number) {
  const entities = query(world, [Position, Velocity, Attributes]);

  // Выравнивание по центру экрана, когда уровень завершён и врагов нет
  if (levelState === 'FIREWORKS' || levelState === 'POST_LEVEL' || (levelState === 'WAITING' && getActiveEnemies() <= 0)) {
    const centerX = app.screen.width / 2;
    const centerY = app.screen.height * 0.75;
    for (let i = 0; i < entities.length; i++) {
      const eid = entities[i];
      const dx = centerX - Position.x[eid];
      const dy = centerY - Position.y[eid];
      // ПЕРЕВОД НА ВРЕМЯ: было ×0.05 за кадр
      const lerp = lerpPerFrame(0.05, deltaFrames);
      Velocity.x[eid] = dx * lerp;
      Velocity.y[eid] = dy * lerp;
    }
    return;
  }

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    // ЗАДАЧА 5: Плавный вылет корабля в центр во время отсчёта
    if (levelState === 'COUNTDOWN') {
      const centerX = app.screen.width / 2;
      const centerY = app.screen.height * 0.65;
      const dx = centerX - Position.x[eid];
      const dy = centerY - Position.y[eid];
      // ПЕРЕВОД НА ВРЕМЯ: было ×0.05 за кадр
      const lerp = lerpPerFrame(0.05, deltaFrames);
      Velocity.x[eid] = dx * lerp;
      Velocity.y[eid] = dy * lerp;
      timerMS = TARGET_CHANGE_MS;
      targetX = Position.x[eid];
      targetY = Position.y[eid];
      continue;
    }

    // ПЕРЕВОД НА ВРЕМЯ: было ++ (90 кадров), стало += мс (1500 мс)
    timerMS += deltaMS;
    if (timerMS > TARGET_CHANGE_MS) {
      timerMS = 0;
      targetX = Math.random() * app.screen.width;
      const safeZoneHeight = app.screen.height * 0.4;
      targetY = app.screen.height - (Math.random() * safeZoneHeight);
    }

    const dx = targetX - Position.x[eid];
    const dy = targetY - Position.y[eid];
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 5) {
      const accel = Attributes.speed[eid] || 0.1;
      // ПЕРЕВОД НА ВРЕМЯ: ускорение было за кадр, стало за время
      Velocity.x[eid] = (Velocity.x[eid] || 0) + (dx / dist) * accel * deltaFrames;
      Velocity.y[eid] = (Velocity.y[eid] || 0) + (dy / dist) * accel * deltaFrames;
    }
  }
}