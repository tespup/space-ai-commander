import { query } from 'bitecs';
import { world } from '../core/world';
import { Position } from '../components/Position';
import { Velocity } from '../components/Velocity';
import { Player } from '../components/Player';
import { Abilities } from '../components/Abilities';
import { app } from '../core/Renderer';

// === ПРАВКА 1: Фазы тарана ===
let ramPhase: 'idle' | 'up' | 'down' = 'idle';
let ramTime = 0;
let ramTargetY = 0;

export function movementSystem() {
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

            const ramSpeed = 6; // ПРАВКА 1: в 2 раза медленнее (было 12)

            if (ramPhase === 'up') {
                ramTime += 0.15;
                const zigzagAmplitude = 60;
                const zigzagFreq = 0.3;

                Position.y[eid] -= ramSpeed;
                Position.x[eid] += Math.sin(ramTime * zigzagFreq) * zigzagAmplitude * 0.1;

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
                Position.y[eid] += ramSpeed;
                // Плавно возвращаемся к центру по X
                Position.x[eid] += (app.screen.width / 2 - Position.x[eid]) * 0.03;

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

        // Обычное движение
        Position.x[eid] += (Velocity.x[eid] || 0);
        Position.y[eid] += (Velocity.y[eid] || 0);
        Velocity.x[eid] = (Velocity.x[eid] || 0) * 0.95;
        Velocity.y[eid] = (Velocity.y[eid] || 0) * 0.95;

        const margin = 20;
        const topLimit = app.screen.height * 0.4;
        if (Position.x[eid] < margin) { Position.x[eid] = margin; Velocity.x[eid] = 0; }
        if (Position.x[eid] > app.screen.width - margin) { Position.x[eid] = app.screen.width - margin; Velocity.x[eid] = 0; }
        if (Position.y[eid] < topLimit) { Position.y[eid] = topLimit; Velocity.y[eid] = 0; }
        if (Position.y[eid] > app.screen.height - margin) { Position.y[eid] = app.screen.height - margin; Velocity.y[eid] = 0; }
    }
}