// ФАЙЛ: src/systems/EnemyRenderSystem.ts
import { query } from 'bitecs';
import { Position } from '../components/Position';
import { Velocity } from '../components/Velocity';
import { Enemy } from '../components/Enemy';
import { Health } from '../components/Health';
import { world } from '../core/world';
import { spawnEnemyTrail } from './VFXSystem';
import * as PIXI from 'pixi.js';

const enemySprites = new Map<number, PIXI.Sprite>();
const enemyShakes = new Map<number, number>();

// ПЕРЕВОД НА ВРЕМЯ: предсмертная тряска теперь обновляется через основной цикл,
// а не через отдельный PIXI.Ticker
interface DeathGhost {
  sprite: PIXI.Sprite;
  shakeIntensity: number;
  framesLeft: number; // в кадрах при 60 мс
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

/**
 * Создаёт "призрачный" спрайт для предсмертной тряски.
 * ПЕРЕВОД НА ВРЕМЯ: больше не создаёт отдельный PIXI.Ticker.
 * Обновление происходит в enemyRenderSystem через основной игровой цикл.
 */
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

  // ПЕРЕВОД НА ВРЕМЯ: было 30/15 кадров, оставляем в кадрах,
  // но обновляем через основной цикл с дельтой
  const shakeIntensity = isBoss ? 8 : 4;
  const framesLeft = isBoss ? 30 : 15;
  deathGhosts.push({ sprite: ghost, shakeIntensity, framesLeft });
}

/**
 * Обновление предсмертных призраков.
 * Вызывается из enemyRenderSystem.
 */
function updateDeathGhosts(app: PIXI.Application, deltaFrames: number) {
  for (let i = deathGhosts.length - 1; i >= 0; i--) {
    const ghost = deathGhosts[i];
    ghost.framesLeft -= deltaFrames;
    ghost.sprite.x += (Math.random() - 0.5) * ghost.shakeIntensity * deltaFrames;
    ghost.sprite.y += (Math.random() - 0.5) * ghost.shakeIntensity * deltaFrames;
    // ПЕРЕВОД НА ВРЕМЯ: было -0.05 за кадр
    ghost.sprite.alpha -= 0.05 * deltaFrames;

    if (ghost.framesLeft <= 0 || ghost.sprite.alpha <= 0) {
      app.stage.removeChild(ghost.sprite);
      ghost.sprite.destroy();
      deathGhosts.splice(i, 1);
    }
  }
}

export function enemyRenderSystem(deltaFrames: number) {
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
        // ПЕРЕВОД НА ВРЕМЯ: было -0.5 за кадр
        enemyShakes.set(eid, shake - 0.5 * deltaFrames);
      }
      sprite.x = Position.x[eid] + ox;
      sprite.y = Position.y[eid] + oy;
      sprite.rotation = Enemy.rotation[eid] || 0;

      const hp = Health.value[eid];
      const maxHp = Health.max[eid];

      // Легкое покраснение босса в зависимости от потерянного HP
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

      // ПЕРЕВОД НА ВРЕМЯ: вероятностный спавн хвостов.
      // Было: > 0.4 за кадр = 60% шанс. Стало: шанс пропорционален времени.
      const trailChance = Math.min(1, 0.6 * deltaFrames);
      if (Math.random() < trailChance && !Enemy.isBoss[eid]) {
        const tailX = sprite.x - Math.cos(sprite.rotation - Math.PI / 2) * 20;
        const tailY = sprite.y - Math.sin(sprite.rotation - Math.PI / 2) * 20;
        spawnEnemyTrail(tailX, tailY, Enemy.trailOuter[eid], Enemy.trailInner[eid]);
      }
    }
  }

  // Обновляем предсмертные призраки через основной цикл
  updateDeathGhosts(app, deltaFrames);
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

/**
 * Очистка всех предсмертных призраков (при сбросе уровня).
 */
export function clearDeathGhosts(app: PIXI.Application) {
  for (const ghost of deathGhosts) {
    app.stage.removeChild(ghost.sprite);
    ghost.sprite.destroy();
  }
  deathGhosts.length = 0;
}