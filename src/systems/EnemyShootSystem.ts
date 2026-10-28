// ФАЙЛ: src/systems/EnemyShootSystem.ts
import { addEntity, addComponent, query, removeEntity } from 'bitecs';
import { Position } from '../components/Position';
import { Velocity } from '../components/Velocity';
import { EnemyBullet } from '../components/EnemyBullet';
import { world } from '../core/world';
import { playEnemyShootSound, playBossShootSound } from '../core/AssetLoader';
import { time } from '../core/GameTime';
import * as PIXI from 'pixi.js';
import { texEnemyBullet, texEnemyBulletBoss, acquire, release } from '../core/Textures';

const enemyBulletSprites = new Map<number, PIXI.Sprite>();

export function spawnEnemyBullet(x: number, y: number, app: PIXI.Application, isBoss: boolean) {
    const bullet = addEntity(world);
    addComponent(world, bullet, Position);
    addComponent(world, bullet, Velocity);
    addComponent(world, bullet, EnemyBullet);

    Position.x[bullet] = x;
    Position.y[bullet] = y;
    Velocity.x[bullet] = 0;
    
    Velocity.y[bullet] = isBoss ? 10.33 : 10.5; 
    EnemyBullet.isBoss[bullet] = isBoss ? 1 : 0;

    const sprite = acquire(isBoss ? texEnemyBulletBoss() : texEnemyBullet(), isBoss ? 'ebulletBoss' : 'ebullet');
    app.stage.addChild(sprite);
    enemyBulletSprites.set(bullet, sprite);

    if (isBoss) playBossShootSound();
    else playEnemyShootSound();
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
        release(sprite);
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