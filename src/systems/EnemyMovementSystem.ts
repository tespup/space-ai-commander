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
import * as PIXI from 'pixi.js';

export function enemyMovementSystem(deltaMS: number, app: PIXI.Application) {
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
            Enemy.time[eid]++;
            if (Enemy.time[eid] > 120) {
                Enemy.time[eid] = 0;
                Enemy.targetX[eid] = 50 + Math.random() * (app.screen.width - 100);
                Enemy.targetY[eid] = 50 + Math.random() * (app.screen.height * 0.2 - 50);
            }

            const dx = Enemy.targetX[eid] - Position.x[eid];
            const dy = Enemy.targetY[eid] - Position.y[eid];
            const dist = Math.hypot(dx, dy);
            if (dist > 5) {
                Velocity.x[eid] += (dx / dist) * 0.05;
                Velocity.y[eid] += (dy / dist) * 0.05;
            }
            Velocity.x[eid] *= 0.92;
            Velocity.y[eid] *= 0.92;
            Position.x[eid] += Velocity.x[eid];
            Position.y[eid] += Velocity.y[eid];

            Enemy.shootTimer[eid] -= deltaMS;
            if (Enemy.shootTimer[eid] <= 0 && Enemy.burstQueue[eid] <= 0) {
                Enemy.shootTimer[eid] = 1000 + Math.random() * 500;
                // Количество пуль босса: 2 + количество убитых боссов
                Enemy.burstQueue[eid] = 2 + bossesDefeated;
                Enemy.burstTimer[eid] = 0;
            }

            if (Enemy.burstQueue[eid] > 0) {
                Enemy.burstTimer[eid] -= deltaMS;
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
            Enemy.shootTimer[eid] -= deltaMS;
            if (Enemy.shootTimer[eid] <= 0) {
                Enemy.shootTimer[eid] = 200 + Math.random() * 800;
                Enemy.shotsFired[eid]++;
                // Количество пуль за выстрел = количество убитых боссов
                for (let b = 0; b < bossesDefeated; b++) {
                    const offset = (b - (bossesDefeated - 1) / 2) * 15;
                    spawnEnemyBullet(Position.x[eid] + offset, Position.y[eid] + 20, app, false);
                }
            }
        }

        if (type === 0) {
            Enemy.speedTimer[eid] -= deltaMS;
            if (Enemy.speedTimer[eid] <= 0) {
                Enemy.targetSpeed[eid] = 1 + Math.random() * 5;
                Enemy.speedTimer[eid] = 500 + Math.random() * 1500;
            }
            Velocity.y[eid] += (Enemy.targetSpeed[eid] - Velocity.y[eid]) * 0.05;
            dx = Velocity.x[eid];
            dy = Velocity.y[eid];
            Position.x[eid] += dx;
            Position.y[eid] += dy;
        }
        else if (type === 1) {
            Enemy.time[eid] += deltaMS * 0.003;
            const amplitude = app.screen.width / 4;
            const newX = Enemy.startX[eid] + Math.sin(Enemy.time[eid]) * amplitude;
            dx = newX - Position.x[eid];
            Position.x[eid] = newX;
            Position.y[eid] += dy;
        }
        else if (type === 2) {
            const targetDx = px - Position.x[eid];
            const targetDy = py - Position.y[eid];
            const dist = Math.hypot(targetDx, targetDy);
            if (dist > 0) {
                const accel = 0.05;
                Velocity.x[eid] += (targetDx / dist) * accel;
                Velocity.y[eid] += (targetDy / dist) * accel;
            }
            Velocity.x[eid] *= 0.98;
            Velocity.y[eid] *= 0.98;
            if (Velocity.y[eid] < 1.5) Velocity.y[eid] = 1.5;
            dx = Velocity.x[eid];
            dy = Velocity.y[eid];
            Position.x[eid] += dx;
            Position.y[eid] += dy;
        }

        Enemy.rotation[eid] = Math.atan2(dy, dx) - Math.PI / 2;

        if (Position.y[eid] > app.screen.height + 150 || Position.x[eid] < -300 || Position.x[eid] > app.screen.width + 300) {
            removeEnemySprite(eid, app);
            removeEntity(world, eid);
            onEnemyDestroyed();
        }
    }
}