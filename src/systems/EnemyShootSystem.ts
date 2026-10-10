// ФАЙЛ: src/systems/EnemyShootSystem.ts
import { addEntity, addComponent, query, removeEntity } from 'bitecs';
import { Position } from '../components/Position';
import { Velocity } from '../components/Velocity';
import { EnemyBullet } from '../components/EnemyBullet';
import { world } from '../core/world';
import { playEnemyShootSound, playBossShootSound } from '../core/AssetLoader';
import { time } from '../core/GameTime';
import * as PIXI from 'pixi.js';

const enemyBulletSprites = new Map<number, PIXI.Sprite>();

export function spawnEnemyBullet(x: number, y: number, app: PIXI.Application, isBoss: boolean) {
    const bullet = addEntity(world);
    addComponent(world, bullet, Position);
    addComponent(world, bullet, Velocity);
    addComponent(world, bullet, EnemyBullet);

    Position.x[bullet] = x;
    Position.y[bullet] = y;
    Velocity.x[bullet] = 0;
    
    Velocity.y[bullet] = isBoss ? 2.33 : 3.5; 
    EnemyBullet.isBoss[bullet] = isBoss ? 1 : 0;

    const graphics = new PIXI.Graphics();
    if (isBoss) {
        graphics.rect(-2, -10, 4, 20).fill(0xff0000); 
        playBossShootSound();
    } else {
        graphics.circle(0, 0, 4).fill(0xffaa00);
        playEnemyShootSound();
    }
    
    const texture = app.renderer.generateTexture(graphics);
    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5);
    app.stage.addChild(sprite);
    enemyBulletSprites.set(bullet, sprite);
    graphics.destroy();
}

export function enemyBulletMovementSystem(app: PIXI.Application) {
    const bullets = query(world, [EnemyBullet, Position, Velocity]);

    for (let i = 0; i < bullets.length; i++) {
        const eid = bullets[i];
        Position.y[eid] += Velocity.y[eid] * time.f;

        if (Position.y[eid] > app.screen.height + 50) {
            removeEnemyBulletSprite(eid, app);
            removeEntity(world, eid);
        }
    }
}

export function enemyBulletRenderSystem() {
    const bullets = query(world, [EnemyBullet, Position]);

    for (let i = 0; i < bullets.length; i++) {
        const eid = bullets[i];
        const sprite = enemyBulletSprites.get(eid);
        if (sprite) {
            sprite.x = Position.x[eid];
            sprite.y = Position.y[eid];
        }
    }
}

export function removeEnemyBulletSprite(eid: number, app: PIXI.Application) {
    const sprite = enemyBulletSprites.get(eid);
    if (sprite) {
        app.stage.removeChild(sprite);
        sprite.destroy();
        enemyBulletSprites.delete(eid);
    }
}

export function clearAllEnemyBullets(app: PIXI.Application) {
  const bullets = query(world, [EnemyBullet, Position]);
  for (const bullet of bullets) {
    removeEnemyBulletSprite(bullet, app);
    removeEntity(world, bullet);
  }
}