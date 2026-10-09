// ФАЙЛ: src/systems/EnemyRenderSystem.ts
import { query } from 'bitecs';
import { Position } from '../components/Position';
import { Velocity } from '../components/Velocity';
import { Enemy } from '../components/Enemy';
import { Health } from '../components/Health';
import { world } from '../core/world';
import { spawnEnemyTrail } from './VFXSystem';
import { time } from '../core/GameTime';
import * as PIXI from 'pixi.js';

const enemySprites = new Map<number, PIXI.Sprite>();
const enemyShakes = new Map<number, number>();

interface DeathGhost {
    sprite: PIXI.Sprite;
    shake: number;
    life: number;
}
const deathGhosts: DeathGhost[] = [];

export function addEnemySprite(eid: number, texture: PIXI.Texture, app: PIXI.Application) {
    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.zIndex = 10;
    app.stage.addChild(sprite);
    enemySprites.set(eid, sprite);
}

export function flashEnemy(eid: number) {
    const sprite = enemySprites.get(eid);
    if (sprite) {
        sprite.tint = 0xff0000;
        setTimeout(() => {
            if (!sprite.destroyed) sprite.tint = 0xffffff;
        }, 50);
    }
}

export function shakeEnemy(eid: number, intensity: number = 5) {
    enemyShakes.set(eid, intensity);
}

export function spawnDeathShake(eid: number, app: PIXI.Application) {
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

    app.stage.addChild(ghost);

    const shake = isBoss ? 8 : 4;
    const life = isBoss ? 500 : 250; // 30 и 15 кадров соответственно

    deathGhosts.push({ sprite: ghost, shake, life });
}

export function enemyRenderSystem() {
    // Обновление призраков смерти
    for (let i = deathGhosts.length - 1; i >= 0; i--) {
        const g = deathGhosts[i];
        g.sprite.x += (Math.random() - 0.5) * g.shake * time.f;
        g.sprite.y += (Math.random() - 0.5) * g.shake * time.f;
        g.sprite.alpha -= 0.05 * time.f;
        g.life -= time.ms;
        
        if (g.life <= 0 || g.sprite.alpha <= 0) {
            if (g.sprite.parent) g.sprite.parent.removeChild(g.sprite);
            g.sprite.destroy();
            deathGhosts.splice(i, 1);
        }
    }

    const enemies = query(world, [Enemy, Position, Velocity]);

    for (let i = 0; i < enemies.length; i++) {
        const eid = enemies[i];
        const sprite = enemySprites.get(eid);
        if (sprite) {
            const shake = enemyShakes.get(eid) || 0;
            let ox = 0, oy = 0;
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

            // Вероятность спавна шлейфа (эквивалент Math.random() > 0.4 при 60 FPS)
            if (Math.random() < 1 - Math.pow(0.4, time.f) && !Enemy.isBoss[eid]) {
                const tailX = sprite.x - Math.cos(sprite.rotation - Math.PI / 2) * 20;
                const tailY = sprite.y - Math.sin(sprite.rotation - Math.PI / 2) * 20;
                spawnEnemyTrail(tailX, tailY, Enemy.trailOuter[eid], Enemy.trailInner[eid]);
            }
        }
    }
}

export function removeEnemySprite(eid: number, app: PIXI.Application) {
    const sprite = enemySprites.get(eid);
    if (sprite) {
        app.stage.removeChild(sprite);
        sprite.destroy();
        enemySprites.delete(eid);
        enemyShakes.delete(eid);
    }
}