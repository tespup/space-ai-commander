// ФАЙЛ: src/systems/CollisionSystem.ts
import { query, removeEntity } from 'bitecs';
import { Position } from '../components/Position';
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
import { gameScheduler } from '../core/GameTime';
import * as PIXI from 'pixi.js';

const ENEMY_SIZE = 30;
const BOSS_SIZE = 80;
const PLAYER_SIZE = 30;
const BULLET_SIZE = 6;
const ROCKET_SIZE = 10;

export function collisionSystem(app: PIXI.Application) {
    const enemies = query(world, [Enemy, Position, Health]);
    const bullets = query(world, [Bullet, Position]);
    const rockets = query(world, [Rocket, Position]);
    const enemyBullets = query(world, [EnemyBullet, Position]);
    const players = query(world, [Player, Position, Attributes, Abilities, Health]);
    if (players.length === 0) return;

    const player = players[0];
    const px = Position.x[player];
    const py = Position.y[player];
    const isRamActive = Abilities.ramTimer[player] > 0;

    // === ПУЛИ ВРАГОВ ПО ИГРОКУ ===
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];
        const bx = Position.x[bullet];
        const by = Position.y[bullet];
        const dist = Math.hypot(px - bx, py - by);
        if (dist < PLAYER_SIZE / 2 + 10) {
            removeEnemyBulletSprite(bullet, app);
            removeEntity(world, bullet);
            if (Abilities.shieldTimer[player] > 0 || isRamActive) continue;
            const isBossBullet = EnemyBullet.isBoss[bullet] === 1;
            const bulletDamage = isBossBullet ? 100 : 50 * Math.pow(1.2, currentCombatTier);
            Health.value[player] -= bulletDamage;
            spawnHitImpact(px, py);
            if (Health.value[player] <= 0) {
                handlePlayerDeath(player, px, py);
                return;
            }
        }
    }

    // === РАКЕТЫ ПО ВРАГАМ ===
    for (let i = rockets.length - 1; i >= 0; i--) {
        const rocket = rockets[i];
        const rx = Position.x[rocket];
        const ry = Position.y[rocket];
        let rocketHit = false;

        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            if (Health.value[enemy] <= 0) continue;
            const ex = Position.x[enemy];
            const ey = Position.y[enemy];
            const size = Enemy.isBoss[enemy] ? BOSS_SIZE : ENEMY_SIZE;
            const dist = Math.hypot(rx - ex, ry - ey);

            if (dist < size / 2 + ROCKET_SIZE / 2) {
                rocketHit = true;
                removeRocketSprite(rocket, app);
                removeEntity(world, rocket);
                spawnExplosion(rx, ry, 0.8);

                if (Enemy.isBoss[enemy]) {
                    const baseDamage = 100 + (Attributes.weapons[player] || 0) * 15;
                    const rocketDamage = Math.floor(baseDamage * 1.25);
                    Health.value[enemy] -= rocketDamage;
                    flashEnemy(enemy);
                    if (Health.value[enemy] <= 0) {
                        handleBossDeath(enemy, ex, ey, player, app);
                    }
                } else {
                    spawnDeathShake(enemy, app);
                    spawnExplosion(ex, ey);
                    const reward = Math.floor(10 * Math.pow(1.15, currentCombatTier));
                    Attributes.credits[player] += reward;
                    spawnFloatingText('+' + reward, ex, ey, 0x00ff00);
                    removeEnemySprite(enemy, app);
                    removeEntity(world, enemy);
                    onEnemyDestroyed();
                }
                break;
            }
        }
        if (rocketHit) continue;
    }

    // === ПУЛИ ИГРОКА ПО ВРАГАМ ===
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        const bx = Position.x[bullet];
        const by = Position.y[bullet];
        let bulletDestroyed = false;

        for (let k = enemyBullets.length - 1; k >= 0; k--) {
            const eBullet = enemyBullets[k];
            const ebx = Position.x[eBullet];
            const eby = Position.y[eBullet];
            const eDist = Math.hypot(bx - ebx, by - eby);
            if (eDist < BULLET_SIZE / 2 + 5) {
                removeEnemyBulletSprite(eBullet, app);
                removeEntity(world, eBullet);
                removeBulletSprite(bullet, app);
                removeEntity(world, bullet);
                spawnHitImpact(bx, by);
                bulletDestroyed = true;
                break;
            }
        }
        if (bulletDestroyed) continue;

        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            if (Health.value[enemy] <= 0) continue;
            const ex = Position.x[enemy];
            const ey = Position.y[enemy];
            const size = Enemy.isBoss[enemy] ? BOSS_SIZE : ENEMY_SIZE;
            const dist = Math.hypot(bx - ex, by - ey);
            if (dist < size / 2 + BULLET_SIZE / 2) {
                const damage = 100 + (Attributes.weapons[player] || 0) * 15;
                Health.value[enemy] -= damage;
                removeBulletSprite(bullet, app);
                removeEntity(world, bullet);
                spawnHitImpact(bx, by);
                flashEnemy(enemy);
                if (Health.value[enemy] <= 0) {
                    if (Enemy.isBoss[enemy]) {
                        handleBossDeath(enemy, ex, ey, player, app);
                    } else {
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
                break;
            }
        }
    }

    // === ТАРАН — СТОЛКНОВЕНИЕ ИГРОКА С ВРАГАМИ ===
    if (isRamActive) {
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (Health.value[enemy] <= 0) continue;
            const ex = Position.x[enemy];
            const ey = Position.y[enemy];
            const size = Enemy.isBoss[enemy] ? BOSS_SIZE : ENEMY_SIZE;
            const dist = Math.hypot(px - ex, py - ey);

            if (dist < PLAYER_SIZE / 2 + size / 2 + 20) {
                if (Enemy.isBoss[enemy]) continue;
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
    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        if (Health.value[enemy] <= 0) continue;
        const ex = Position.x[enemy];
        const ey = Position.y[enemy];
        const size = Enemy.isBoss[enemy] ? BOSS_SIZE : ENEMY_SIZE;
        const dist = Math.hypot(px - ex, py - ey);
        if (dist < PLAYER_SIZE / 2 + size / 2) {
            shakePlayer(player, 8);
            shakeEnemy(enemy, 5);
            if (Abilities.shieldTimer[player] > 0) {
                if (!Enemy.isBoss[enemy]) {
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
                spawnDeathShake(enemy, app);
                removeEnemySprite(enemy, app);
                removeEntity(world, enemy);
                onEnemyDestroyed();
            }
            if (Health.value[player] <= 0) {
                handlePlayerDeath(player, px, py);
                return;
            }
        }
    }

    function handleBossDeath(enemy: number, ex: number, ey: number, playerEid: number, appRef: PIXI.Application) {
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
                spawnExplosion(x + (Math.random() * 50 - 25), y + (Math.random() * 50 - 25), 1.5 + Math.random());
            });
        }
        removePlayerSprite(playerEid);
        Health.value[playerEid] = 0;
        gameScheduler.after(1500, () => { triggerPlayerDeath(); });
    }
}