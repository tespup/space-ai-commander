// ФАЙЛ: src/systems/PlayerControlSystem.ts
import { query } from 'bitecs';
import { world } from '../core/world';
import { Position } from '../components/Position';
import { Velocity } from '../components/Velocity';
import { Attributes } from '../components/Attributes';
import { app } from '../core/Renderer';
import { levelState } from '../core/LevelManager';
import { getActiveEnemies } from './EnemySpawnSystem';

let targetX = 0;
let targetY = 0;
let timerMS = 0;
const TARGET_CHANGE_MS = 1500;

export function initPlayerControl() {
  targetX = app.screen.width / 2;
  targetY = app.screen.height - 100;
}

export function playerControlSystem(deltaMS: number, deltaFrames: number) {
  const entities = query(world, [Position, Velocity, Attributes]);

  if (levelState === 'FIREWORKS' || levelState === 'POST_LEVEL' || (levelState === 'WAITING' && getActiveEnemies() <= 0)) {
    const centerX = app.screen.width / 2;
    const centerY = app.screen.height * 0.75;
    for (let i = 0; i < entities.length; i++) {
      const eid = entities[i];
      const dx = centerX - Position.x[eid];
      const dy = centerY - Position.y[eid];
      // ИСПРАВЛЕНИЕ: убираем lerpPerFrame, используем линейное приближение
      Velocity.x[eid] = dx * 0.05;
      Velocity.y[eid] = dy * 0.05;
    }
    return;
  }

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    if (levelState === 'COUNTDOWN') {
      const centerX = app.screen.width / 2;
      const centerY = app.screen.height * 0.65;
      const dx = centerX - Position.x[eid];
      const dy = centerY - Position.y[eid];
      Velocity.x[eid] = dx * 0.05;
      Velocity.y[eid] = dy * 0.05;
      timerMS = TARGET_CHANGE_MS;
      targetX = Position.x[eid];
      targetY = Position.y[eid];
      continue;
    }

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
      // ИСПРАВЛЕНИЕ: убираем lerpPerFrame, используем линейное ускорение
      Velocity.x[eid] = (Velocity.x[eid] || 0) + (dx / dist) * accel;
      Velocity.y[eid] = (Velocity.y[eid] || 0) + (dy / dist) * accel;
    }
  }
}