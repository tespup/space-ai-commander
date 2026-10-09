// ФАЙЛ: src/systems/MovementSystem.ts
import { query } from 'bitecs';
import { world } from '../core/world';
import { Position } from '../components/Position';
import { Velocity } from '../components/Velocity';
import { Player } from '../components/Player';
import { Abilities } from '../components/Abilities';
import { app } from '../core/Renderer';
import { time } from '../core/GameTime';

let ramPhase: 'idle' | 'up' | 'down' = 'idle';
let ramTime = 0;
let ramTargetY = 0;

export function movementSystem() {
    const entities = query(world, [Player, Position, Velocity, Abilities]);

    for (let i = 0; i < entities.length; i++) {
        const eid = entities[i];

        if (Abilities.ramTimer[eid] > 0) {
            if (ramPhase === 'idle') {
                ramPhase = 'up';
                ramTime = 0;
                ramTargetY = app.screen.height * 0.75;
            }

            const ramSpeed = 6;

            if (ramPhase === 'up') {
                ramTime += 0.15 * time.f;

                const zigzagAmplitude = 60;
                const zigzagFreq = 0.3;

                Position.y[eid] -= ramSpeed * time.f;
                Position.x[eid] += Math.sin(ramTime * zigzagFreq) * zigzagAmplitude * 0.1 * time.f;

                const margin = 20;
                if (Position.x[eid] < margin) Position.x[eid] = margin;
                if (Position.x[eid] > app.screen.width - margin) Position.x[eid] = app.screen.width - margin;

                if (Position.y[eid] <= 0) {
                    Position.y[eid] = 0;
                    ramPhase = 'down';
                }
            } else if (ramPhase === 'down') {
                Position.y[eid] += ramSpeed * time.f;

                const returnK = 1 - Math.pow(1 - 0.03, time.f);
                Position.x[eid] += (app.screen.width / 2 - Position.x[eid]) * returnK;

                if (Position.y[eid] >= ramTargetY) {
                    Position.y[eid] = ramTargetY;
                    Abilities.ramTimer[eid] = 0;
                    ramPhase = 'idle';
                    ramTime = 0;
                }
            }

            continue;
        } else {
            if (ramPhase !== 'idle') {
                ramPhase = 'idle';
                ramTime = 0;
            }
        }

        Position.x[eid] += (Velocity.x[eid] || 0) * time.f;
        Position.y[eid] += (Velocity.y[eid] || 0) * time.f;

        const damp = Math.pow(0.95, time.f);
        Velocity.x[eid] = (Velocity.x[eid] || 0) * damp;
        Velocity.y[eid] = (Velocity.y[eid] || 0) * damp;

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