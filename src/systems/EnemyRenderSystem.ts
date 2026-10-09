// ФАЙЛ: src/systems/EnemyRenderSystem.ts
import { query } from 'bitecs';
import { Position } from '../components/Position';
import { Velocity } from '../components/Velocity';
import { Enemy } from '../components/Enemy';
import { Health } from '../components/Health';
import { world } from '../core/world';
import { spawnEnemyTrail } from './VFXSystem';
import { app } from '../core/Renderer';
import { time, gameScheduler } from '../core/GameTime';
import * as PIXI from 'pixi.js';

const enemySprites = new Map<number, PIXI.Sprite>();
const enemyShakes = new Map<number, number>();

interface DeathGhost {
    sprite: PIXI.Sprite;
    shakeIntensity: number;
    lifeMS: number;
}

const deathGhosts: DeathGhost[] = [];

export function addEnemySprite(eid: number, texture: PIXI.Texture, appRef: PIXI.Application) {
    const sprite = new PIXI.Sprite(texture);

    sprite.anchor.set(0.5);
    sprite.zIndex = 10;

    appRef.stage.addChild(sprite);
    enemySprites.set(eid, sprite);
}

export function flashEnemy(eid: number) {
    const sprite = enemySprites.get(eid);

    if (!sprite) return;

    sprite.tint = 0xff0000;

    gameScheduler.after(50, () => {
        if (!sprite.destroyed) sprite.tint = 0xffffff;
    });
}

export function shakeEnemy(eid: number, intensity: number = 5) {
    enemyShakes.set(eid, intensity);
}

export function spawnDeathShake(eid: number, appRef: PIXI.Application) {
    const originalSprite = enemySprites.get(eid);

    if (!originalSprite) return;

    const isBoss = Enemy.isBoss[eid];

    const ghost = new PIXI.Sprite(originalSprite.texture);

    ghost.anchor.set(0.5);
    ghost.x = originalSprite.x;
    ghost.y = originalSprite.y;
    ghost.rotation = originalSprite.rotation;

    if (isBoss) {
        ghost.tint = 0xffaaaa;
    } else {
        ghost.tint = originalSprite.tint;
    }

    appRef.stage.addChild(ghost);

    deathGhosts.push({
        sprite: ghost,
        shakeIntensity: isBoss ? 8 : 4,
        lifeMS: isBoss ? 500 : 250
    });
}

function updateDeathGhosts() {
    for (let i = deathGhosts.length - 1; i >= 0; i--) {
        const g = deathGhosts[i];

        g.lifeMS -= time.ms;

        g.sprite.x += (Math.random() - 0.5) * g.shakeIntensity * time.f;
        g.sprite.y += (Math.random() - 0.5) * g.shakeIntensity * time.f;
        g.sprite.alpha -= 0.05 * time.f;

        if (g.lifeMS <= 0 || g.sprite.alpha <= 0) {
            app.stage.removeChild(g.sprite);
            g.sprite.destroy();
            deathGhosts.splice(i, 1);
        }
    }
}

export function enemyRenderSystem() {
    const enemies = query(world, [Enemy, Position, Velocity]);

    for (let i = 0; i < enemies.length; i++) {
        const eid = enemies[i];
        const sprite = enemySprites.get(eid);

        if (!sprite) continue;

        const shake = enemyShakes.get(eid) || 0;
        let ox = 0;
        let oy = 0;

        if (shake > 0) {
            ox = (Math.random() - 0.5) * shake * 2;
            oy = (Math.random() - 0.5) * shake * 2;
            enemyShakes.set(eid, shake - 0.5 * time.f);
        }

        sprite.x = Position.x[eid] + ox;
        sprite.y = Position.y[eid] + oy;
        sprite.rotation = Enemy.rotation[eid] || 0;

        const hp = Health.value[eid];
        const maxHp = Health.max[eid];

        if (Enemy.isBoss[eid] && hp !== undefined && maxHp !== undefined) {
            if (sprite.tint !== 0xff0000) {
                const ratio = Math.max(0, hp / maxHp);
                const gb = Math.floor(255 * (0.6 + 0.4 * ratio));
                sprite.tint = (255 << 16) | (gb << 8) | gb;
            }
        }

        if (hp !== undefined && maxHp !== undefined && hp / maxHp <= 0.3) {
            sprite.alpha = 0.7 + Math.sin(Date.now() / 100) * 0.3;
        } else {
            sprite.alpha = 1;
        }

        if (Math.random() < 1 - Math.pow(0.4, time.f) && !Enemy.isBoss[eid]) {
            const tailX = sprite.x - Math.cos(sprite.rotation - Math.PI / 2) * 20;
            const tailY = sprite.y - Math.sin(sprite.rotation - Math.PI / 2) * 20;

            spawnEnemyTrail(tailX, tailY, Enemy.trailOuter[eid], Enemy.trailInner[eid]);
        }
    }

    updateDeathGhosts();
}

export function removeEnemySprite(eid: number, appRef: PIXI.Application) {
    const sprite = enemySprites.get(eid);

    if (sprite) {
        appRef.stage.removeChild(sprite);
        sprite.destroy();

        enemySprites.delete(eid);
        enemyShakes.delete(eid);
    }
}

export function clearDeathGhosts() {
    for (const ghost of deathGhosts) {
        app.stage.removeChild(ghost.sprite);
        ghost.sprite.destroy();
    }

    deathGhosts.length = 0;
}