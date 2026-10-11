// ФАЙЛ: src/systems/EnemyMovementSystem.ts
import { query, removeEntity } from 'bitecs';
import { Enemy } from '../components/Enemy';
import { Position } from '../components/Position';
import { Velocity } from '../components/Velocity';
import { Player } from '../components/Player';
import { world } from '../core/world';
import { removeEnemySprite } from './EnemyRenderSystem';
import { onEnemyDestroyed } from './EnemySpawnSystem';
import { spawnEnemyBullet } from './EnemyShootSystem';
import { bossesDefeated } from '../core/LevelManager';
import { time } from '../core/GameTime';
import { dampPerFrame, lerpPerFrame } from '../core/TimeUtils';
import * as PIXI from 'pixi.js';

export function enemyMovementSystem(app: PIXI.Application) {
    const enemies = query(world, [Enemy, Position, Velocity]);
    const players = query(world, [Player, Position]);

    let px = app.screen.width / 2;
    let py = app.screen.height;
    if (players.length > 0) {
        px = Position.x[players[0]];
        py = Position.y[players[0]];
    }

    for (let i = 0; i < enemies.length; i++) {
        const eid = enemies[i];

        if (Enemy.isBoss[eid]) {
            Enemy.time[eid] += time.ms;
            if (Enemy.time[eid] > 2000) {
                Enemy.time[eid] = 0;
                Enemy.targetX[eid] = 50 + Math.random() * (app.screen.width - 100);
                Enemy.targetY[eid] = 50 + Math.random() * (app.screen.height * 0.2 - 50);
            }

            const dx = Enemy.targetX[eid] - Position.x[eid];
            const dy = Enemy.targetY[eid] - Position.y[eid];
            const dist = Math.hypot(dx, dy);
            if (dist > 5) {
                Velocity.x[eid] += (dx / dist) * 0.05 * time.f;
                Velocity.y[eid] += (dy / dist) * 0.05 * time.f;
            }
            
            const damp = dampPerFrame(0.92, time.f);
            Velocity.x[eid] *= damp;
            Velocity.y[eid] *= damp;
            Position.x[eid] += Velocity.x[eid] * time.f;
            Position.y[eid] += Velocity.y[eid] * time.f;

            Enemy.shootTimer[eid] -= time.ms;
            if (Enemy.shootTimer[eid] <= 0 && Enemy.burstQueue[eid] <= 0) {
                Enemy.shootTimer[eid] = 1000 + Math.random() * 500;
                Enemy.burstQueue[eid] = 2 + bossesDefeated;
                Enemy.burstTimer[eid] = 0;
            }

            if (Enemy.burstQueue[eid] > 0) {
                Enemy.burstTimer[eid] -= time.ms;
                if (Enemy.burstTimer[eid] <= 0) {
                    spawnEnemyBullet(Position.x[eid], Position.y[eid] + 50, app, true);
                    Enemy.burstQueue[eid]--;
                    Enemy.burstTimer[eid] = 150;
                }
            }

            Enemy.rotation[eid] = 0;
            continue;
        }

        // === ОБЫЧНЫЕ ВРАГИ ===
        const type = Enemy.type[eid];
        let dx = 0;
        let dy = Velocity.y[eid];

        const zoneLimit = app.screen.height * 0.3;
        if (Position.y[eid] > 0 && Position.y[eid] < zoneLimit && Enemy.shotsFired[eid] < Enemy.maxShots[eid]) {
            Enemy.shootTimer[eid] -= time.ms;
            if (Enemy.shootTimer[eid] <= 0) {
                Enemy.shootTimer[eid] = 200 + Math.random() * 800;
                Enemy.shotsFired[eid]++;
                for (let b = 0; b < bossesDefeated; b++) {
                    const offset = (b - (bossesDefeated - 1) / 2) * 15;
                    spawnEnemyBullet(Position.x[eid] + offset, Position.y[eid] + 20, app, false);
                }
            }
        }

        if (type === 0) {
            Enemy.speedTimer[eid] -= time.ms;
            if (Enemy.speedTimer[eid] <= 0) {
                // Увеличили лимиты скорости для врагов меняющих скорость
                Enemy.targetSpeed[eid] = 3 + Math.random() * 6; 
                Enemy.speedTimer[eid] = 500 + Math.random() * 1500;
            }
            Velocity.y[eid] += (Enemy.targetSpeed[eid] - Velocity.y[eid]) * lerpPerFrame(0.05, time.f);
            dx = Velocity.x[eid];
            dy = Velocity.y[eid];
            Position.x[eid] += dx * time.f;
            Position.y[eid] += dy * time.f;
        }
        else if (type === 1) {
            Enemy.time[eid] += time.ms * 0.003;
            const amplitude = app.screen.width / 4;
            const newX = Enemy.startX[eid] + Math.sin(Enemy.time[eid]) * amplitude;
            dx = newX - Position.x[eid];
            Position.x[eid] = newX;
            Position.y[eid] += dy * time.f;
        }
        else if (type === 2) {
            const targetDx = px - Position.x[eid];
            const targetDy = py - Position.y[eid];
            const dist = Math.hypot(targetDx, targetDy);
            if (dist > 0) {
                // Увеличили ускорение преследователя в 3 раза
                const accel = 0.15; 
                Velocity.x[eid] += (targetDx / dist) * accel * time.f;
                Velocity.y[eid] += (targetDy / dist) * accel * time.f;
            }
            const damp = dampPerFrame(0.98, time.f);
            Velocity.x[eid] *= damp;
            Velocity.y[eid] *= damp;
            // Увеличили минимальную скорость движения вниз, чтобы он не зависал
            if (Velocity.y[eid] < 3.0) Velocity.y[eid] = 3.0; 
            dx = Velocity.x[eid];
            dy = Velocity.y[eid];
            Position.x[eid] += dx * time.f;
            Position.y[eid] += dy * time.f;
        }

        Enemy.rotation[eid] = Math.atan2(dy, dx) - Math.PI / 2;

        if (Position.y[eid] > app.screen.height + 150 || Position.x[eid] < -300 || Position.x[eid] > app.screen.width + 300) {
            removeEnemySprite(eid, app);
            removeEntity(world, eid);
            onEnemyDestroyed();
        }
    }
}