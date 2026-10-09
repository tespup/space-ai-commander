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
let timer = 0;

export function initPlayerControl() {
  targetX = app.screen.width / 2;
  targetY = app.screen.height - 100;
}

export function playerControlSystem() {
  const entities = query(world, [Position, Velocity, Attributes]);

  // Выравнивание по центру экрана, когда уровень завершен и врагов нет
  if (levelState === 'FIREWORKS' || levelState === 'POST_LEVEL' || (levelState === 'WAITING' && getActiveEnemies() <= 0)) {
      const centerX = app.screen.width / 2;
      const centerY = app.screen.height * 0.75; // Центр экрана по горизонтали, чуть выше панели кредитов
      
      for (let i = 0; i < entities.length; i++) {
          const eid = entities[i];
          const dx = centerX - Position.x[eid];
          const dy = centerY - Position.y[eid];
          
          Velocity.x[eid] = dx * 0.05; 
          Velocity.y[eid] = dy * 0.05;
      }
      return;
  }

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    // ЗАДАЧА 5: Плавный вылет корабля в центр во время отсчета
    if (levelState === 'COUNTDOWN') {
        const centerX = app.screen.width / 2;
        const centerY = app.screen.height * 0.65; 
        
        const dx = centerX - Position.x[eid];
        const dy = centerY - Position.y[eid];
        
        Velocity.x[eid] = dx * 0.05; 
        Velocity.y[eid] = dy * 0.05;
        
        timer = 90; 
        targetX = Position.x[eid];
        targetY = Position.y[eid];
        continue;
    }

    timer++;
    if (timer > 90) {
      timer = 0;
      targetX = Math.random() * app.screen.width;
      const safeZoneHeight = app.screen.height * 0.4;
      targetY = app.screen.height - (Math.random() * safeZoneHeight);
    }

    const dx = targetX - Position.x[eid];
    const dy = targetY - Position.y[eid];
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 5) {
      const accel = Attributes.speed[eid] || 0.1;
      Velocity.x[eid] = (Velocity.x[eid] || 0) + (dx / dist) * accel;
      Velocity.y[eid] = (Velocity.y[eid] || 0) + (dy / dist) * accel;
    }
  }
}