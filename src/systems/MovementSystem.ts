// ФАЙЛ: src/systems/MovementSystem.ts
import { query } from 'bitecs';
import { world } from '../core/world';
import { Position } from '../components/Position';
import { Velocity } from '../components/Velocity';
import { Player } from '../components/Player';
import { Abilities } from '../components/Abilities';
import { app } from '../core/Renderer';
import { dampPerFrame, lerpPerFrame } from '../core/TimeUtils';

// === ПРАВКА 1: Фазы тарана ===
let ramPhase: 'idle' | 'up' | 'down' = 'idle';
let ramTime = 0;
let ramTargetY = 0;

export function movementSystem(deltaFrames: number) {
  const entities = query(world, [Player, Position, Velocity, Abilities]);

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    // === ПРАВКА 1: Таран с фазами вверх/вниз ===
    if (Abilities.ramTimer[eid] > 0) {
      // Инициализация при активации
      if (ramPhase === 'idle') {
        ramPhase = 'up';
        ramTime = 0;
        ramTargetY = app.screen.height * 0.75;
      }

      const ramSpeed = 6; // Пикселей за кадр при 60 FPS

      if (ramPhase === 'up') {
        ramTime += 0.15 * deltaFrames;
        const zigzagAmplitude = 60;
        const zigzagFreq = 0.3;

        Position.y[eid] -= ramSpeed * deltaFrames;
        Position.x[eid] += Math.sin(ramTime * zigzagFreq) * zigzagAmplitude * 0.1 * deltaFrames;

        const margin = 20;
        if (Position.x[eid] < margin) Position.x[eid] = margin;
        if (Position.x[eid] > app.screen.width - margin) Position.x[eid] = app.screen.width - margin;

        // Достигли верха — разворачиваемся вниз
        if (Position.y[eid] <= 0) {
          Position.y[eid] = 0;
          ramPhase = 'down';
        }
      } else if (ramPhase === 'down') {
        // ПРАВКА 1: Возврат вниз, тоже бессмертен (ramTimer > 0)
        Position.y[eid] += ramSpeed * deltaFrames;

        // Плавно возвращаемся к центру по X
        const lerpX = lerpPerFrame(0.03, deltaFrames);
        Position.x[eid] += (app.screen.width / 2 - Position.x[eid]) * lerpX;

        if (Position.y[eid] >= ramTargetY) {
          Position.y[eid] = ramTargetY;
          Abilities.ramTimer[eid] = 0; // Завершаем таран
          ramPhase = 'idle';
          ramTime = 0;
        }
      }
      continue; // Пропускаем обычное движение
    } else {
      // Сброс фазы если таран был прерван извне
      if (ramPhase !== 'idle') {
        ramPhase = 'idle';
        ramTime = 0;
      }
    }

    // === Обычное движение ===
    Position.x[eid] += (Velocity.x[eid] || 0) * deltaFrames;
    Position.y[eid] += (Velocity.y[eid] || 0) * deltaFrames;

    // Инерция: затухание 0.95 за кадр при 60 FPS
    const damp = dampPerFrame(0.95, deltaFrames);
    Velocity.x[eid] = (Velocity.x[eid] || 0) * damp;
    Velocity.y[eid] = (Velocity.y[eid] || 0) * damp;

    // Ограничение игровой зоны
    const margin = 20;
    const topLimit = app.screen.height * 0.4;

    if (Position.x[eid] < margin) {
      Position.x[eid] = margin;
      Velocity.x[eid] = 0;
    }
    if (Position.x[eid] > app.screen.width - margin) {
      Position.x[eid] = app.screen.width - margin;
      Velocity.x[eid] = 0;
    }
    if (Position.y[eid] < topLimit) {
      Position.y[eid] = topLimit;
      Velocity.y[eid] = 0;
    }
    if (Position.y[eid] > app.screen.height - margin) {
      Position.y[eid] = app.screen.height - margin;
      Velocity.y[eid] = 0;
    }
  }
}