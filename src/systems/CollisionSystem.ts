// ФАЙЛ: src/systems/CollisionSystem.ts
import { query, removeEntity } from 'bitecs';
import { Position } from '../components/Position';
import { Velocity } from '../components/Velocity';
import { Health } from '../components/Health';
import { Enemy } from '../components/Enemy';
import { Bullet } from '../components/Bullet';
import { Rocket } from '../components/Rocket';
import { EnemyBullet } from '../components/EnemyBullet';
import { Player } from '../components/Player';
import { Attributes } from '../components/Attributes';
import { Abilities } from '../components/Abilities';
import { world } from '../core/world';
import { onEnemyDestroyed } from './EnemySpawnSystem';
import { removeEnemySprite, flashEnemy, shakeEnemy, spawnDeathShake } from './EnemyRenderSystem';
import { removeBulletSprite, removeRocketSprite } from './PlayerShootSystem';
import { removeEnemyBulletSprite } from './EnemyShootSystem';
import { shakePlayer, removePlayerSprite } from './ShipSystem';
import { spawnHitImpact, spawnExplosion, spawnFloatingText } from './VFXSystem';
import { currentCombatTier, triggerPlayerDeath, addLife } from '../core/LevelManager';
import { gameScheduler, time } from '../core/GameTime';
import * as PIXI from 'pixi.js';

const ENEMY_SIZE = 30;
const BOSS_SIZE = 80;
const PLAYER_SIZE = 30;
const BULLET_SIZE = 6;
const ROCKET_SIZE = 10;

function segmentCircleHit(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    cx: number,
    cy: number,
    radius: number
): number {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy;

    let t = 0;
    if (len2 > 0.000001) {
        t = ((cx - x0) * dx + (cy - y0) * dy) / len2;
        if (t < 0) t = 0;
        else if (t > 1) t = 1;
    }

    const closestX = x0 + dx * t;
    const closestY = y0 + dy * t;
    const distX = cx - closestX;
    const distY = cy - closestY;

    return (distX * distX + distY * distY) <= radius * radius ? t : -1;
}

export function collisionSystem(app: PIXI.Application) {
    const enemies = query(world, [Enemy, Position, Health]);
    const bullets = query(world, [Bullet, Position]);
    const rockets = query(world, [Rocket, Position]);
    const enemyBullets = query(world, [EnemyBullet, Position]);
    const players = query(world, [Player, Position, Attributes, Abilities, Health]);

    if (players.length === 0) return;

    const player = players[0];
    let isPlayerDead = !Number.isFinite(Health.value[player]) || Health.value[player] <= 0;

    const px = Position.x[player];
    const py = Position.y[player];
    const isRamActive = Abilities.ramTimer[player] > 0;

    const destroyedEnemies = new Set<number>();
    const destroyedEnemyBullets = new Set<number>();

    // === ПУЛИ ВРАГОВ ПО ИГРОКУ ===
    if (!isPlayerDead) {
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
            const bullet = enemyBullets[i];
            if (!Number.isFinite(bullet) || destroyedEnemyBullets.has(bullet)) continue;

            const bx = Position.x[bullet];
            const by = Position.y[bullet];

            if (!Number.isFinite(bx) || !Number.isFinite(by)) {
                destroyedEnemyBullets.add(bullet);
                continue;
            }

            const bvx = Velocity.x[bullet] || 0;
            const bvy = Velocity.y[bullet] || 0;

            const prevX = bx - bvx * time.f;
            const prevY = by - bvy * time.f;

            const hitT = segmentCircleHit(
                prevX,
                prevY,
                bx,
                by,
                px,
                py,
                PLAYER_SIZE / 2 + 10
            );

            if (hitT >= 0) {
                const isBossBullet = EnemyBullet.isBoss[bullet] === 1;

                destroyedEnemyBullets.add(bullet);
                removeEnemyBulletSprite(bullet, app);
                removeEntity(world, bullet);

                if (Abilities.shieldTimer[player] > 0 || isRamActive) continue;

                const bulletDamage = isBossBullet ? 100 : 50 * Math.pow(1.2, currentCombatTier);
                Health.value[player] -= bulletDamage;

                const impactX = prevX + (bx - prevX) * hitT;
                const impactY = prevY + (by - prevY) * hitT;

                spawnHitImpact(impactX, impactY);

                if (Health.value[player] <= 0) {
                    isPlayerDead = true;
                    handlePlayerDeath(player, px, py);
                    break;
                }
            }
        }
    }

    // === РАКЕТЫ ПО ВРАГАМ ===
    for (let i = rockets.length - 1; i >= 0; i--) {
        const rocket = rockets[i];
        if (!Number.isFinite(rocket)) continue;

        const rx = Position.x[rocket];
        const ry = Position.y[rocket];

        if (!Number.isFinite(rx) || !Number.isFinite(ry)) continue;

        const rvx = Velocity.x[rocket] || 0;
        const rvy = Velocity.y[rocket] || 0;

        const prevX = rx - rvx * time.f;
        const prevY = ry - rvy * time.f;

        let bestEnemy = -1;
        let bestT = Infinity;
        let bestHitX = rx;
        let bestHitY = ry;
        let bestEx = 0;
        let bestEy = 0;

        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            if (!Number.isFinite(enemy) || destroyedEnemies.has(enemy)) continue;

            const hp = Health.value[enemy];
            if (!Number.isFinite(hp) || hp <= 0) continue;

            const ex = Position.x[enemy];
            const ey = Position.y[enemy];

            if (!Number.isFinite(ex) || !Number.isFinite(ey)) continue;

            const size = Enemy.isBoss[enemy] ? BOSS_SIZE : ENEMY_SIZE;
            const radius = size / 2 + ROCKET_SIZE / 2;

            const t = segmentCircleHit(prevX, prevY, rx, ry, ex, ey, radius);

            if (t >= 0 && t < bestT) {
                bestT = t;
                bestEnemy = enemy;
                bestHitX = prevX + (rx - prevX) * t;
                bestHitY = prevY + (ry - prevY) * t;
                bestEx = ex;
                bestEy = ey;
            }
        }

        if (bestEnemy >= 0) {
            removeRocketSprite(rocket, app);
            removeEntity(world, rocket);

            spawnExplosion(bestHitX, bestHitY, 0.8);

            if (Enemy.isBoss[bestEnemy]) {
                const baseDamage = 100 + (Attributes.weapons[player] || 0) * 15;
                const rocketDamage = Math.floor(baseDamage * 1.25);

                Health.value[bestEnemy] -= rocketDamage;
                flashEnemy(bestEnemy);

                if (Health.value[bestEnemy] <= 0) {
                    handleBossDeath(bestEnemy, bestEx, bestEy, player, app);
                }
            } else {
                destroyedEnemies.add(bestEnemy);
                Health.value[bestEnemy] = 0;

                spawnDeathShake(bestEnemy, app);
                spawnExplosion(bestEx, bestEy);

                const reward = Math.floor(10 * Math.pow(1.15, currentCombatTier));
                Attributes.credits[player] += reward;

                spawnFloatingText('+' + reward, bestEx, bestEy, 0x00ff00);

                removeEnemySprite(bestEnemy, app);
                removeEntity(world, bestEnemy);
                onEnemyDestroyed();
            }
        }
    }

    // === ПУЛИ ИГРОКА ПО ВРАГАМ ===
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        if (!Number.isFinite(bullet)) continue;

        const bx = Position.x[bullet];
        const by = Position.y[bullet];

        if (!Number.isFinite(bx) || !Number.isFinite(by)) continue;

        const bvx = Velocity.x[bullet] || 0;
        const bvy = Velocity.y[bullet] || 0;

        const prevX = bx - bvx * time.f;
        const prevY = by - bvy * time.f;

        let bulletDestroyed = false;

        // Сначала проверяем перехват вражеских пуль, как в оригинальной логике.
        let bestEnemyBullet = -1;
        let bestEnemyBulletT = Infinity;
        let bestEnemyBulletHitX = bx;
        let bestEnemyBulletHitY = by;

        for (let k = enemyBullets.length - 1; k >= 0; k--) {
            const eBullet = enemyBullets[k];
            if (!Number.isFinite(eBullet) || destroyedEnemyBullets.has(eBullet)) continue;

            const ebx = Position.x[eBullet];
            const eby = Position.y[eBullet];

            if (!Number.isFinite(ebx) || !Number.isFinite(eby)) {
                destroyedEnemyBullets.add(eBullet);
                continue;
            }

            const t = segmentCircleHit(
                prevX,
                prevY,
                bx,
                by,
                ebx,
                eby,
                BULLET_SIZE / 2 + 5
            );

            if (t >= 0 && t < bestEnemyBulletT) {
                bestEnemyBulletT = t;
                bestEnemyBullet = eBullet;
                bestEnemyBulletHitX = prevX + (bx - prevX) * t;
                bestEnemyBulletHitY = prevY + (by - prevY) * t;
            }
        }

        if (bestEnemyBullet >= 0) {
            destroyedEnemyBullets.add(bestEnemyBullet);

            removeEnemyBulletSprite(bestEnemyBullet, app);
            removeEntity(world, bestEnemyBullet);

            removeBulletSprite(bullet, app);
            removeEntity(world, bullet);

            spawnHitImpact(bestEnemyBulletHitX, bestEnemyBulletHitY);

            bulletDestroyed = true;
        }

        if (bulletDestroyed) continue;

        let bestEnemy = -1;
        let bestT = Infinity;
        let bestHitX = bx;
        let bestHitY = by;
        let bestEx = 0;
        let bestEy = 0;

        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            if (!Number.isFinite(enemy) || destroyedEnemies.has(enemy)) continue;

            const hp = Health.value[enemy];
            if (!Number.isFinite(hp) || hp <= 0) continue;

            const ex = Position.x[enemy];
            const ey = Position.y[enemy];

            if (!Number.isFinite(ex) || !Number.isFinite(ey)) continue;

            const size = Enemy.isBoss[enemy] ? BOSS_SIZE : ENEMY_SIZE;
            const radius = size / 2 + BULLET_SIZE / 2;

            const t = segmentCircleHit(prevX, prevY, bx, by, ex, ey, radius);

            if (t >= 0 && t < bestT) {
                bestT = t;
                bestEnemy = enemy;
                bestHitX = prevX + (bx - prevX) * t;
                bestHitY = prevY + (by - prevY) * t;
                bestEx = ex;
                bestEy = ey;
            }
        }

        if (bestEnemy >= 0) {
            const damage = 100 + (Attributes.weapons[player] || 0) * 15;
            Health.value[bestEnemy] -= damage;

            removeBulletSprite(bullet, app);
            removeEntity(world, bullet);

            spawnHitImpact(bestHitX, bestHitY);
            flashEnemy(bestEnemy);

            if (Health.value[bestEnemy] <= 0) {
                if (Enemy.isBoss[bestEnemy]) {
                    handleBossDeath(bestEnemy, bestEx, bestEy, player, app);
                } else {
                    destroyedEnemies.add(bestEnemy);
                    Health.value[bestEnemy] = 0;

                    spawnDeathShake(bestEnemy, app);
                    spawnExplosion(bestEx, bestEy);

                    const reward = Math.floor(10 * Math.pow(1.15, currentCombatTier));
                    Attributes.credits[player] += reward;

                    spawnFloatingText('+' + reward, bestEx, bestEy, 0x00ff00);

                    removeEnemySprite(bestEnemy, app);
                    removeEntity(world, bestEnemy);
                    onEnemyDestroyed();
                }
            }
        }
    }

    // === ТАРАН — СТОЛКНОВЕНИЕ ИГРОКА С ВРАГАМИ ===
    if (isRamActive && !isPlayerDead) {
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (!Number.isFinite(enemy) || destroyedEnemies.has(enemy)) continue;

            const hp = Health.value[enemy];
            if (!Number.isFinite(hp) || hp <= 0) continue;

            const ex = Position.x[enemy];
            const ey = Position.y[enemy];

            if (!Number.isFinite(ex) || !Number.isFinite(ey)) continue;

            const size = Enemy.isBoss[enemy] ? BOSS_SIZE : ENEMY_SIZE;
            const dist = Math.hypot(px - ex, py - ey);

            if (dist < PLAYER_SIZE / 2 + size / 2 + 20) {
                if (Enemy.isBoss[enemy]) continue;

                destroyedEnemies.add(enemy);
                Health.value[enemy] = 0;

                spawnDeathShake(enemy, app);
                spawnExplosion(ex, ey);

                const reward = Math.floor(10 * Math.pow(1.15, currentCombatTier));
                Attributes.credits[player] += reward;

                spawnFloatingText('+' + reward, ex, ey, 0x00ff00);

                removeEnemySprite(enemy, app);
                removeEntity(world, enemy);
                onEnemyDestroyed();
            }
        }

        return;
    }

    // === СТОЛКНОВЕНИЕ ИГРОКА С ВРАГАМИ (обычное) ===
    if (!isPlayerDead) {
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            if (!Number.isFinite(enemy) || destroyedEnemies.has(enemy)) continue;

            const hp = Health.value[enemy];
            if (!Number.isFinite(hp) || hp <= 0) continue;

            const ex = Position.x[enemy];
            const ey = Position.y[enemy];

            if (!Number.isFinite(ex) || !Number.isFinite(ey)) continue;

            const size = Enemy.isBoss[enemy] ? BOSS_SIZE : ENEMY_SIZE;
            const dist = Math.hypot(px - ex, py - ey);

            if (dist < PLAYER_SIZE / 2 + size / 2) {
                shakePlayer(player, 8);
                shakeEnemy(enemy, 5);

                if (Abilities.shieldTimer[player] > 0) {
                    if (!Enemy.isBoss[enemy]) {
                        destroyedEnemies.add(enemy);
                        Health.value[enemy] = 0;

                        spawnDeathShake(enemy, app);
                        spawnExplosion(ex, ey);

                        removeEnemySprite(enemy, app);
                        removeEntity(world, enemy);
                        onEnemyDestroyed();
                    }

                    continue;
                }

                const collisionDamage = 100 + currentCombatTier * 10;
                Health.value[player] -= collisionDamage;

                spawnExplosion(ex, ey);

                if (!Enemy.isBoss[enemy]) {
                    destroyedEnemies.add(enemy);
                    Health.value[enemy] = 0;

                    spawnDeathShake(enemy, app);

                    removeEnemySprite(enemy, app);
                    removeEntity(world, enemy);
                    onEnemyDestroyed();
                }

                if (Health.value[player] <= 0) {
                    isPlayerDead = true;
                    handlePlayerDeath(player, px, py);
                    break;
                }
            }
        }
    }

    function handleBossDeath(
        enemy: number,
        ex: number,
        ey: number,
        playerEid: number,
        appRef: PIXI.Application
    ) {
        destroyedEnemies.add(enemy);
        Health.value[enemy] = 0;

        spawnDeathShake(enemy, appRef);

        for (let k = 0; k < 6; k++) {
            gameScheduler.after(k * 200, () => {
                const ox = ex + (Math.random() * 100 - 50);
                const oy = ey + (Math.random() * 100 - 50);
                const scale = 1 + Math.random() * 1.5;
                const rot = (Math.random() * 180) * (Math.PI / 180);
                spawnExplosion(ox, oy, scale, rot);
            });
        }

        const reward = Math.floor(300 * Math.pow(1.5, currentCombatTier));
        Attributes.credits[playerEid] += reward;

        spawnFloatingText('+' + reward, ex, ey, 0x00ff00);

        addLife(1);
        spawnFloatingText('+1 ❤️', ex, ey - 40, 0xff3366);

        removeEnemySprite(enemy, appRef);
        removeEntity(world, enemy);
        onEnemyDestroyed();
    }

    function handlePlayerDeath(playerEid: number, x: number, y: number) {
        spawnExplosion(x, y, 2.5);

        for (let k = 1; k <= 3; k++) {
            gameScheduler.after(k * 200, () => {
                spawnExplosion(
                    x + (Math.random() * 50 - 25),
                    y + (Math.random() * 50 - 25),
                    1.5 + Math.random()
                );
            });
        }

        removePlayerSprite(playerEid);
        Health.value[playerEid] = 0;

        gameScheduler.after(1500, () => {
            triggerPlayerDeath();
        });
    }
}