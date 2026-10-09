// ФАЙЛ: src/systems/EnemySpawnSystem.ts
import { addEntity, addComponent, query, removeEntity } from 'bitecs';
import { world } from '../core/world';
import { Position } from '../components/Position';
import { Velocity } from '../components/Velocity';
import { Health } from '../components/Health';
import { Enemy } from '../components/Enemy';
import { app } from '../core/Renderer';
import { addEnemySprite } from './EnemyRenderSystem';
import { removeEnemySprite } from './EnemyRenderSystem';
import { levelState, currentLevelIsBoss, currentCombatTier } from '../core/LevelManager';
import { playBossEnterSound } from '../core/AssetLoader';
import * as PIXI from 'pixi.js';

let enemyTextures: PIXI.Texture[] = [];
let bossTextures: PIXI.Texture[] = [];
let activeEnemies = 0;
let spawnTimer = 0;
let nextSpawnInterval = 1000;
let bossSpawned = false;

const MAX_ENEMIES = 50;
const SHIP_SIZE = 100;
const SHIP_SPACING = SHIP_SIZE + 5;

let spawnPoints: { x: number, y: number }[] = [];
let pointsInitialized = false;

function initSpawnPoints(screenWidth: number) {
    spawnPoints = [];
    const startX1 = SHIP_SIZE / 2;
    const endX = screenWidth - (SHIP_SIZE / 2);
    const y1 = -(SHIP_SIZE * 2);
    for (let x = startX1; x <= endX; x += SHIP_SPACING) {
        spawnPoints.push({ x, y: y1 });
    }
    const y2 = -(SHIP_SIZE * 3);
    const startX2 = startX1 + (SHIP_SPACING / 2);
    for (let x = startX2; x <= endX; x += SHIP_SPACING) {
        spawnPoints.push({ x, y: y2 });
    }
    pointsInitialized = true;
}

export function initEnemyTextures(textures: PIXI.Texture[]) { enemyTextures = textures; }
export function initBossTextures(textures: PIXI.Texture[]) { bossTextures = textures; }
export function getActiveEnemies() { return activeEnemies; }
export function resetBossSpawn() { bossSpawned = false; }

export function enemySpawnSystem(deltaMS: number) {
    if (enemyTextures.length === 0) return;
    if (!pointsInitialized) initSpawnPoints(app.screen.width);
    if (levelState !== 'PLAYING') return;

    if (currentLevelIsBoss) {
        if (!bossSpawned && bossTextures.length > 0 && activeEnemies === 0) {
            spawnBoss();
            bossSpawned = true;
        }
        return;
    }

    bossSpawned = false;
    spawnTimer += deltaMS;

    if (spawnTimer >= nextSpawnInterval && activeEnemies < MAX_ENEMIES) {
        spawnTimer = 0;
        nextSpawnInterval = 1000 + Math.random() * 1000;

        const idx = Math.floor(Math.random() * enemyTextures.length);
        const texture = enemyTextures[idx];
        if (!texture) return;

        const pointIdx = Math.floor(Math.random() * spawnPoints.length);
        const point = spawnPoints[pointIdx];

        const eid = addEntity(world);
        addComponent(world, eid, Position);
        addComponent(world, eid, Velocity);
        addComponent(world, eid, Health);
        addComponent(world, eid, Enemy);

        Position.x[eid] = point.x;
        Position.y[eid] = point.y;

        const moveType = Math.floor(Math.random() * 3);
        Enemy.type[eid] = moveType;
        Enemy.isBoss[eid] = 0;
        Enemy.startX[eid] = point.x;
        Enemy.time[eid] = 0;
        Enemy.rotation[eid] = 0;
        Enemy.burstQueue[eid] = 0;
        Enemy.burstTimer[eid] = 0;

        const trailPalettes = [[0x8b0000, 0xff5555], [0x4b0082, 0xbb55ff], [0x00008b, 0x5555ff], [0x006400, 0x55ff55]];
        const p = trailPalettes[Math.floor(Math.random() * trailPalettes.length)];
        Enemy.trailOuter[eid] = p[0];
        Enemy.trailInner[eid] = p[1];

        // === ЛОКАЛЬНАЯ СЛОЖНОСТЬ: HP врагов по текущей сетке ===
        const baseHp = 100 + currentCombatTier * 15;

        // === СТРЕЛЬБА: кол-во пуль = кол-во боссов в текущей сетке ===
        Enemy.maxShots[eid] = currentCombatTier;
        Enemy.shotsFired[eid] = 0;
        Enemy.shootTimer[eid] = 0;

        const baseSpeed = 3;
        Velocity.x[eid] = 0;
        if (moveType === 0) {
            Velocity.y[eid] = baseSpeed;
            Enemy.targetSpeed[eid] = baseSpeed;
            Enemy.speedTimer[eid] = 500 + Math.random() * 1000;
        } else if (moveType === 1) {
            Velocity.y[eid] = baseSpeed * 1.2;
        } else if (moveType === 2) {
            Velocity.y[eid] = baseSpeed * 0.8;
        }

        Health.value[eid] = baseHp;
        Health.max[eid] = baseHp;

        addEnemySprite(eid, texture, app);
        activeEnemies++;
    }
}

function spawnBoss() {
    const eid = addEntity(world);
    addComponent(world, eid, Position);
    addComponent(world, eid, Velocity);
    addComponent(world, eid, Health);
    addComponent(world, eid, Enemy);

    Position.x[eid] = app.screen.width / 2;
    Position.y[eid] = -150;
    Velocity.x[eid] = 0;
    Velocity.y[eid] = 15;

    Enemy.isBoss[eid] = 1;
    Enemy.type[eid] = 3;
    Enemy.targetX[eid] = app.screen.width / 2;
    Enemy.targetY[eid] = app.screen.height * 0.1;
    Enemy.time[eid] = 0;
    Enemy.shootTimer[eid] = 1000;
    Enemy.burstQueue[eid] = 0;
    Enemy.burstTimer[eid] = 0;

    // === HP БОССА: растёт с каждой сеткой ===
    const hp = 3000 * Math.pow(2, currentCombatTier);
    Health.max[eid] = hp;
    Health.value[eid] = hp;

    const trailPalettes = [[0x8b0000, 0xff5555], [0x4b0082, 0xbb55ff], [0x00008b, 0x5555ff], [0x006400, 0x55ff55]];
    const p = trailPalettes[Math.floor(Math.random() * trailPalettes.length)];
    Enemy.trailOuter[eid] = p[0];
    Enemy.trailInner[eid] = p[1];

    const idx = Math.floor(Math.random() * bossTextures.length);
    addEnemySprite(eid, bossTextures[idx], app);
    activeEnemies++;
    playBossEnterSound();
}

export function onEnemyDestroyed() {
    if (activeEnemies > 0) activeEnemies--;
}

export function clearAllEnemies() {
    const enemies = query(world, [Enemy, Position, Health]);
    for (const enemy of enemies) {
        removeEnemySprite(enemy, app);
        removeEntity(world, enemy);
    }
    activeEnemies = 0;
}