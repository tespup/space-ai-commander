// ФАЙЛ: src/systems/PlayerShootSystem.ts
import { addEntity, addComponent, query, removeEntity } from 'bitecs';
import { Position } from '../components/Position';
import { Velocity } from '../components/Velocity';
import { Bullet } from '../components/Bullet';
import { Rocket } from '../components/Rocket';
import { Player } from '../components/Player';
import { Abilities } from '../components/Abilities';
import { Enemy } from '../components/Enemy';
import { Health } from '../components/Health';
import { world } from '../core/world';
import { spawnMuzzleFlash } from './VFXSystem';
import { levelState, getBossesDefeated } from '../core/LevelManager';
import { getPlayerMasks } from './ShipSystem';
import { playPlayerShootSound, playPlayerShootDopSound } from '../core/AssetLoader';
import { getActiveEnemies } from './EnemySpawnSystem';
import { dampPerFrame, lerpPerFrame } from '../core/TimeUtils';
import * as PIXI from 'pixi.js';

// ПЕРЕВОД НА ВРЕМЯ: кулдауны теперь в миллисекундах
let shootCooldown = 0;
let rocketCooldown = 0;

// ПЕРЕВОД НА ВРЕМЯ: было 20 кадров = 333.33 мс, 10 кадров = 166.67 мс
const SHOOT_COOLDOWN_MS = 1000 / 3;       // 333.33 мс (20 кадров при 60 мс)
const SHOOT_COOLDOWN_RAPID_MS = 1000 / 6; // 166.67 мс (10 кадров при 60 мс)

// ПЕРЕВОД НА ВРЕМЯ: было 80/40 кадров = 1333.33 / 666.67 мс
const ROCKET_COOLDOWN_MS = 1333.33;       // 80 кадров
const ROCKET_COOLDOWN_RAPID_MS = 666.67;  // 40 кадров

const bulletSprites = new Map<number, PIXI.Sprite>();
const rocketSprites = new Map<number, PIXI.Sprite>();
let cachedMainTex: PIXI.Texture | null = null;
let cachedPierceTex: PIXI.Texture | null = null;
let cachedRocketTex: PIXI.Texture | null = null;
let lastBossStage = -1;

const bulletTypeMap = new Map<number, number>();
const rocketLifeMap = new Map<number, number>();
// ПЕРЕВОД НА ВРЕМЯ: было 600 кадров = 10000 мс
const ROCKET_MAX_LIFE_MS = 10000;

// ============================================================
// СТИЛИ ПО СТАДИЯМ БОССОВ (без изменений)
// ============================================================
interface StageStyle {
  glowOuter: number;
  glowOuterA: number;
  glowInner: number;
  glowInnerA: number;
  blade: number;
  bladeA: number;
  core: number;
  coreA: number;
  tip: number;
  trailColor: number;
}

function getStageStyle(bossStage: number): StageStyle {
  if (bossStage <= 0) {
    return { glowOuter: 0x00f2ff, glowOuterA: 0.0, glowInner: 0x00f2ff, glowInnerA: 0.0, blade: 0x00f2ff, bladeA: 0.8, core: 0xffffff, coreA: 0.9, tip: 0xffffff, trailColor: 0x00f2ff };
  } else if (bossStage === 1) {
    return { glowOuter: 0x00f2ff, glowOuterA: 0.2, glowInner: 0x44ffff, glowInnerA: 0.15, blade: 0x00f2ff, bladeA: 0.8, core: 0xffffff, coreA: 0.9, tip: 0xffffff, trailColor: 0x00f2ff };
  } else if (bossStage === 2) {
    return { glowOuter: 0xffcc44, glowOuterA: 0.25, glowInner: 0xffdd88, glowInnerA: 0.2, blade: 0x00f2ff, bladeA: 0.8, core: 0xffffff, coreA: 0.9, tip: 0xffffff, trailColor: 0xffcc44 };
  } else if (bossStage === 3) {
    return { glowOuter: 0xff9933, glowOuterA: 0.3, glowInner: 0xffbb55, glowInnerA: 0.25, blade: 0xffcc00, bladeA: 0.8, core: 0xffffff, coreA: 0.9, tip: 0xffffff, trailColor: 0xff9933 };
  } else if (bossStage === 4) {
    return { glowOuter: 0xff0000, glowOuterA: 0.3, glowInner: 0xff3333, glowInnerA: 0.35, blade: 0xff4444, bladeA: 0.85, core: 0xffaaaa, coreA: 0.9, tip: 0xffffff, trailColor: 0xff3333 };
  } else if (bossStage === 5) {
    return { glowOuter: 0x8800ff, glowOuterA: 0.25, glowInner: 0xff0000, glowInnerA: 0.35, blade: 0xff2222, bladeA: 0.85, core: 0xff8888, coreA: 0.9, tip: 0xffffff, trailColor: 0xaa44ff };
  } else if (bossStage === 6) {
    return { glowOuter: 0xaa00ff, glowOuterA: 0.35, glowInner: 0x8800ff, glowInnerA: 0.45, blade: 0xff0000, bladeA: 0.85, core: 0xff4444, coreA: 0.9, tip: 0xffffff, trailColor: 0xaa00ff };
  } else {
    return { glowOuter: 0xaa00ff, glowOuterA: 0.4, glowInner: 0x8800ff, glowInnerA: 0.5, blade: 0xffffff, bladeA: 0.95, core: 0xffffff, coreA: 1.0, tip: 0xffffff, trailColor: 0xaa00ff };
  }
}

let currentTrailColor = 0x00f2ff;

// ============================================================
// ГЕНЕРАЦИЯ ТЕКСТУР (без изменений)
// ============================================================
function generateMainBulletTexture(app: PIXI.Application, s: StageStyle): PIXI.Texture {
  const g = new PIXI.Graphics();
  if (s.glowOuterA > 0) g.ellipse(0, 0, 7, 20).fill({ color: s.glowOuter, alpha: s.glowOuterA });
  if (s.glowInnerA > 0) g.ellipse(0, 0, 5, 17).fill({ color: s.glowInner, alpha: s.glowInnerA });
  g.poly([0, -16, 2.5, -4, 1.5, 8, 0, 13, -1.5, 8, -2.5, -4]).fill({ color: s.blade, alpha: s.bladeA });
  g.poly([0, -14, 1.2, -4, 0.7, 6, 0, 10, -0.7, 6, -1.2, -4]).fill({ color: s.core, alpha: s.coreA });
  g.poly([-2.5, -2, -5, 2, -2.5, 4]).fill({ color: s.blade, alpha: s.bladeA * 0.6 });
  g.poly([2.5, -2, 5, 2, 2.5, 4]).fill({ color: s.blade, alpha: s.bladeA * 0.6 });
  g.poly([0, -16, 0.8, -12, -0.8, -12]).fill(s.tip);
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

function generatePierceBulletTexture(app: PIXI.Application, s: StageStyle): PIXI.Texture {
  const g = new PIXI.Graphics();
  if (s.glowOuterA > 0) g.ellipse(0, 0, 6, 18).fill({ color: s.glowOuter, alpha: s.glowOuterA });
  if (s.glowInnerA > 0) g.ellipse(0, 0, 4, 15).fill({ color: s.glowInner, alpha: s.glowInnerA });
  g.poly([0, -15, 2.5, -3, 1.5, 8, 0, 12, -1.5, 8, -2.5, -3]).fill({ color: s.blade, alpha: s.bladeA * 0.9 });
  g.poly([0, -13, 1.2, -3, 0.7, 6, 0, 9, -0.7, 6, -1.2, -3]).fill({ color: s.core, alpha: s.coreA * 0.5 });
  g.rect(-0.8, -8.4, 1.6, 0.8).fill({ color: s.tip, alpha: 0.7 });
  g.rect(-0.6, -5.4, 1.2, 0.8).fill({ color: s.tip, alpha: 0.7 });
  g.rect(-0.8, -2.4, 1.6, 0.8).fill({ color: s.tip, alpha: 0.7 });
  g.rect(-0.6, 0.6, 1.2, 0.8).fill({ color: s.tip, alpha: 0.7 });
  g.rect(-0.5, 3.6, 1.0, 0.8).fill({ color: s.tip, alpha: 0.7 });
  g.circle(0, -10, 0.8).fill({ color: s.tip, alpha: 0.8 });
  g.poly([0, -15, 0.7, -11, -0.7, -11]).fill(s.tip);
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

function generateRocketTexture(app: PIXI.Application, s: StageStyle): PIXI.Texture {
  const g = new PIXI.Graphics();
  if (s.glowOuterA > 0) g.ellipse(0, 0, 4, 22).fill({ color: s.glowOuter, alpha: s.glowOuterA });
  if (s.glowInnerA > 0) g.ellipse(0, 0, 3, 19).fill({ color: s.glowInner, alpha: s.glowInnerA });
  g.poly([0, -18, 1.2, -4, 0.8, 10, 0, 15, -0.8, 10, -1.2, -4]).fill({ color: s.blade, alpha: s.bladeA });
  g.poly([0, -16, 0.6, -4, 0.4, 8, 0, 12, -0.4, 8, -0.6, -4]).fill({ color: s.core, alpha: s.coreA });
  g.rect(-2.5, -8, 0.8, 14).fill({ color: s.blade, alpha: 0.5 });
  g.rect(1.7, -8, 0.8, 14).fill({ color: s.blade, alpha: 0.5 });
  g.poly([0, -18, 0.5, -14, -0.5, -14]).fill(s.tip);
  const tex = app.renderer.generateTexture(g);
  g.destroy();
  return tex;
}

function ensureTextures(app: PIXI.Application) {
  const bossStage = getBossesDefeated();
  if (lastBossStage === bossStage && cachedMainTex) return;
  if (cachedMainTex) { try { cachedMainTex.destroy(); } catch (e) {} }
  if (cachedPierceTex) { try { cachedPierceTex.destroy(); } catch (e) {} }
  if (cachedRocketTex) { try { cachedRocketTex.destroy(); } catch (e) {} }
  const style = getStageStyle(bossStage);
  cachedMainTex = generateMainBulletTexture(app, style);
  cachedPierceTex = generatePierceBulletTexture(app, style);
  cachedRocketTex = generateRocketTexture(app, style);
  currentTrailColor = style.trailColor;
  lastBossStage = bossStage;
}

// ============================================================
// ШЛЕЙФЫ
// ============================================================
interface TrailParticle {
  gfx: PIXI.Graphics;
  vx: number;
  vy: number;
  life: number; // в кадрах при 60 мс
  scaleSpeed: number;
  alphaSpeed: number;
}

const trailParticles: TrailParticle[] = [];
// ПЕРЕВОД НА ВРЕМЯ: было ++ и % 2 (каждые 2 кадра = 33.33 мс)
let trailSpawnAccumulatorMS = 0;
const TRAIL_SPAWN_INTERVAL_MS = 33.33;

function spawnEnergyTrail(app: PIXI.Application, x: number, y: number) {
  const c = new PIXI.Graphics().circle(0, 0, 2 + Math.random() * 2).fill({ color: currentTrailColor, alpha: 0.5 });
  c.x = x + (Math.random() - 0.5) * 3;
  c.y = y;
  app.stage.addChild(c);
  trailParticles.push({ gfx: c, vx: (Math.random() - 0.5) * 0.3, vy: 1.5 + Math.random(), life: 20, scaleSpeed: 0.9, alphaSpeed: 0.03 });
}

function spawnSparkTrail(app: PIXI.Application, x: number, y: number) {
  const s = new PIXI.Graphics().circle(0, 0, 0.8 + Math.random() * 0.8).fill({ color: currentTrailColor, alpha: 0.8 });
  s.x = x;
  s.y = y;
  const a = Math.random() * Math.PI * 2;
  const sp = 1 + Math.random() * 2;
  app.stage.addChild(s);
  trailParticles.push({ gfx: s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 1, life: 15, scaleSpeed: 0.88, alphaSpeed: 0.06 });
}

function spawnGhostTrail(app: PIXI.Application, x: number, y: number) {
  const s = 1.5 + Math.random();
  const gh = new PIXI.Graphics().poly([0, -s * 2, s, 0, 0, s * 2, -s, 0]).fill({ color: currentTrailColor, alpha: 0.2 });
  gh.x = x;
  gh.y = y;
  app.stage.addChild(gh);
  trailParticles.push({ gfx: gh, vx: 0, vy: 2, life: 20, scaleSpeed: 0.95, alphaSpeed: 0.025 });
}

/**
 * Обновление шлейфов.
 * @param deltaFrames — множитель времени (1.0 при 60 мс)
 */
function updateTrails(app: PIXI.Application, deltaFrames: number) {
  for (let i = trailParticles.length - 1; i >= 0; i--) {
    const p = trailParticles[i];
    // ПЕРЕВОД НА ВРЕМЯ: движение и затухание масштабируется
    p.gfx.x += p.vx * deltaFrames;
    p.gfx.y += p.vy * deltaFrames;
    p.gfx.scale.set(p.gfx.scale.x * Math.pow(p.scaleSpeed, deltaFrames));
    p.gfx.alpha -= p.alphaSpeed * deltaFrames;
    p.life -= deltaFrames;
    if (p.life <= 0 || p.gfx.alpha <= 0) {
      app.stage.removeChild(p.gfx);
      p.gfx.destroy();
      trailParticles.splice(i, 1);
    }
  }
}

// ============================================================
// СТРЕЛЬБА
// ============================================================
export function playerShootSystem(app: PIXI.Application, deltaMS: number, deltaFrames: number) {
  if (levelState === 'FIREWORKS' || levelState === 'MENU' || levelState === 'COUNTDOWN' || levelState === 'POST_LEVEL') return;
  if (levelState === 'WAITING' && getActiveEnemies() <= 0) return;

  const players = query(world, [Player, Position, Abilities]);
  if (players.length === 0) return;
  const playerEid = players[0];
  const px = Position.x[playerEid];
  const py = Position.y[playerEid];

  if (Abilities.rocketsTimer[playerEid] > 0) {
    // ПЕРЕВОД НА ВРЕМЯ: было -- (кадры), стало -= мс
    rocketCooldown -= deltaMS;
    if (rocketCooldown <= 0) {
      rocketCooldown = Abilities.rapidTimer[playerEid] > 0 ? ROCKET_COOLDOWN_RAPID_MS : ROCKET_COOLDOWN_MS;
      spawnRockets(app, playerEid);
    }
    return;
  }

  // ПЕРЕВОД НА ВРЕМЯ: было -- (кадры), стало -= мс
  shootCooldown -= deltaMS;
  if (shootCooldown > 0) return;

  const masks = getPlayerMasks(playerEid);
  if (!masks) return;

  ensureTextures(app);

  let firedMain = false;
  let firedSide = false;

  const spawnBullet = (offsetX: number, offsetY: number, isMain: boolean) => {
    const bullet = addEntity(world);
    addComponent(world, bullet, Position);
    addComponent(world, bullet, Velocity);
    addComponent(world, bullet, Bullet);
    Position.x[bullet] = px + offsetX;
    Position.y[bullet] = py + offsetY;
    Velocity.x[bullet] = 0;
    // Скорость не меняем: -10 пикселей за кадр при 60 мс
    Velocity.y[bullet] = -10;
    spawnMuzzleFlash(px + offsetX, py + offsetY - 10);
    bulletTypeMap.set(bullet, isMain ? 0 : 1);
    const tex = isMain ? cachedMainTex : cachedPierceTex;
    if (tex) {
      const sprite = new PIXI.Sprite(tex);
      sprite.anchor.set(0.5);
      app.stage.addChild(sprite);
      bulletSprites.set(bullet, sprite);
    }
  };

  for (const gun of masks.mainGuns) {
    spawnBullet(gun.x, gun.y, true);
    firedMain = true;
  }

  if (Abilities.pierceTimer[playerEid] > 0) {
    for (const gun of masks.sideGuns) {
      spawnBullet(gun.x, gun.y, false);
      firedSide = true;
    }
  }

  if (firedSide) {
    playPlayerShootDopSound();
    shootCooldown = Abilities.rapidTimer[playerEid] > 0 ? SHOOT_COOLDOWN_RAPID_MS : SHOOT_COOLDOWN_MS;
  } else if (firedMain) {
    playPlayerShootSound();
    shootCooldown = Abilities.rapidTimer[playerEid] > 0 ? SHOOT_COOLDOWN_RAPID_MS : SHOOT_COOLDOWN_MS;
  }
}

// ============================================================
// РАКЕТЫ
// ============================================================
function spawnRockets(app: PIXI.Application, playerEid: number) {
  const px = Position.x[playerEid];
  const py = Position.y[playerEid];
  const masks = getPlayerMasks(playerEid);
  if (!masks) return;

  ensureTextures(app);

  const allGuns = [...masks.mainGuns, ...masks.sideGuns];
  if (allGuns.length === 0) return;

  const enemies = query(world, [Enemy, Position, Health]);
  const aliveEnemies = enemies.filter(e => Health.value[e] > 0);

  for (let i = 0; i < allGuns.length; i++) {
    const gun = allGuns[i];
    const rocket = addEntity(world);
    addComponent(world, rocket, Position);
    addComponent(world, rocket, Velocity);
    addComponent(world, rocket, Rocket);
    Position.x[rocket] = px + gun.x;
    Position.y[rocket] = py + gun.y;
    const spreadAngle = (i - (allGuns.length - 1) / 2) * 0.3;
    const speed = 3.5;
    Velocity.x[rocket] = Math.sin(spreadAngle) * speed;
    Velocity.y[rocket] = -Math.cos(spreadAngle) * speed;

    if (aliveEnemies.length > 0) {
      const targetIdx = i % aliveEnemies.length;
      Rocket.targetId[rocket] = aliveEnemies[targetIdx];
    } else {
      Rocket.targetId[rocket] = -1;
    }

    rocketLifeMap.set(rocket, 0);

    if (cachedRocketTex) {
      const sprite = new PIXI.Sprite(cachedRocketTex);
      sprite.anchor.set(0.5);
      sprite.zIndex = 15;
      app.stage.addChild(sprite);
      rocketSprites.set(rocket, sprite);
    }
  }
}

export function rocketMovementSystem(app: PIXI.Application, deltaMS: number, deltaFrames: number) {
  const rockets = query(world, [Rocket, Position, Velocity]);
  const enemies = query(world, [Enemy, Position, Health]);
  const aliveEnemies = enemies.filter(e => Health.value[e] > 0);
  const rocketsWithoutTarget: number[] = [];

  for (let i = rockets.length - 1; i >= 0; i--) {
    const eid = rockets[i];

    // ПЕРЕВОД НА ВРЕМЯ: было +1 за кадр, стало + мс
    const life = (rocketLifeMap.get(eid) || 0) + deltaMS;
    rocketLifeMap.set(eid, life);
    if (life > ROCKET_MAX_LIFE_MS) {
      removeRocketSprite(eid, app);
      rocketLifeMap.delete(eid);
      removeEntity(world, eid);
      continue;
    }

    const targetId = Rocket.targetId[eid];
    let targetAlive = false;
    if (targetId >= 0 && Health.value[targetId] !== undefined && Health.value[targetId] > 0) {
      targetAlive = true;
    }

    if (!targetAlive && targetId >= 0) {
      Rocket.targetId[eid] = -1;
    }

    if (Rocket.targetId[eid] === -1) {
      rocketsWithoutTarget.push(eid);
    }

    const currentTarget = Rocket.targetId[eid];
    if (currentTarget >= 0 && Health.value[currentTarget] !== undefined && Health.value[currentTarget] > 0) {
      // Наведение на цель
      const dx = Position.x[currentTarget] - Position.x[eid];
      const dy = Position.y[currentTarget] - Position.y[eid];
      const dist = Math.hypot(dx, dy);
      if (dist > 1) {
        const speed = 4.5;
        const turnRate = 0.15;
        const targetVx = (dx / dist) * speed;
        const targetVy = (dy / dist) * speed;
        // ПЕРЕВОД НА ВРЕМЯ: поворот масштабируется
        const lerp = lerpPerFrame(turnRate, deltaFrames);
        Velocity.x[eid] += (targetVx - Velocity.x[eid]) * lerp;
        Velocity.y[eid] += (targetVy - Velocity.y[eid]) * lerp;
      }
    } else {
      // Без цели: принудительно направляем вверх
      // ПЕРЕВОД НА ВРЕМЯ: затухание и приближение масштабируются
      Velocity.x[eid] *= dampPerFrame(0.95, deltaFrames);
      Velocity.y[eid] += (-4.5 - Velocity.y[eid]) * lerpPerFrame(0.1, deltaFrames);
    }

    // ПЕРЕВОД НА ВРЕМЯ: движение масштабируется
    Position.x[eid] += Velocity.x[eid] * deltaFrames;
    Position.y[eid] += Velocity.y[eid] * deltaFrames;

    if (Position.y[eid] < -100 || Position.y[eid] > app.screen.height + 100 ||
        Position.x[eid] < -100 || Position.x[eid] > app.screen.width + 100) {
      removeRocketSprite(eid, app);
      rocketLifeMap.delete(eid);
      removeEntity(world, eid);
    }
  }

  if (rocketsWithoutTarget.length > 0 && aliveEnemies.length > 0) {
    const assignedTargets = new Set<number>();
    for (const r of rockets) {
      if (Rocket.targetId[r] >= 0) {
        assignedTargets.add(Rocket.targetId[r]);
      }
    }
    const unassignedEnemies = aliveEnemies.filter(e => !assignedTargets.has(e));
    for (let i = 0; i < rocketsWithoutTarget.length && i < unassignedEnemies.length; i++) {
      Rocket.targetId[rocketsWithoutTarget[i]] = unassignedEnemies[i];
    }
  }
}

export function rocketRenderSystem() {
  const rockets = query(world, [Rocket, Position, Velocity]);
  for (const eid of rockets) {
    const sprite = rocketSprites.get(eid);
    if (sprite) {
      sprite.x = Position.x[eid];
      sprite.y = Position.y[eid];
      sprite.rotation = Math.atan2(Velocity.y[eid], Velocity.x[eid]) + Math.PI / 2;
    }
  }
}

export function removeRocketSprite(eid: number, app: PIXI.Application) {
  const sprite = rocketSprites.get(eid);
  if (sprite) {
    app.stage.removeChild(sprite);
    sprite.destroy();
    rocketSprites.delete(eid);
  }
}

// ============================================================
// ДВИЖЕНИЕ И РЕНДЕР ПУЛЬ
// ============================================================
export function bulletMovementSystem(app: PIXI.Application, deltaFrames: number) {
  const bullets = query(world, [Bullet, Position, Velocity]);
  for (let i = 0; i < bullets.length; i++) {
    const eid = bullets[i];
    // ПЕРЕВОД НА ВРЕМЯ: было += без множителя
    Position.y[eid] += Velocity.y[eid] * deltaFrames;
    if (Position.y[eid] < -50) {
      removeBulletSprite(eid, app);
      bulletTypeMap.delete(eid);
      removeEntity(world, eid);
    }
  }
}

export function bulletRenderSystem() {
  const bullets = query(world, [Bullet, Position]);
  for (let i = 0; i < bullets.length; i++) {
    const eid = bullets[i];
    const sprite = bulletSprites.get(eid);
    if (sprite) {
      sprite.x = Position.x[eid];
      sprite.y = Position.y[eid];
    }
  }
}

// ============================================================
// ШЛЕЙФЫ (система)
// ============================================================
export function bulletTrailSystem(app: PIXI.Application, deltaMS: number, deltaFrames: number) {
  // ПЕРЕВОД НА ВРЕМЯ: было ++ и % 2, стало аккумулятор мс
  trailSpawnAccumulatorMS += deltaMS;
  if (trailSpawnAccumulatorMS < TRAIL_SPAWN_INTERVAL_MS) {
    // Всё равно обновляем существующие шлейфы каждый тик
    updateTrails(app, deltaFrames);
    return;
  }
  trailSpawnAccumulatorMS -= TRAIL_SPAWN_INTERVAL_MS;

  const bullets = query(world, [Bullet, Position]);
  for (const eid of bullets) {
    const type = bulletTypeMap.get(eid) || 0;
    const x = Position.x[eid];
    const y = Position.y[eid] + 14;
    if (type === 0) {
      spawnEnergyTrail(app, x, y);
    } else {
      spawnGhostTrail(app, x, y);
    }
  }

  const rockets = query(world, [Rocket, Position]);
  for (const eid of rockets) {
    spawnSparkTrail(app, Position.x[eid], Position.y[eid] + 16);
  }

  updateTrails(app, deltaFrames);
}

// ============================================================
// УДАЛЕНИЕ
// ============================================================
export function removeBulletSprite(eid: number, app: PIXI.Application) {
  const sprite = bulletSprites.get(eid);
  if (sprite) {
    app.stage.removeChild(sprite);
    sprite.destroy();
    bulletSprites.delete(eid);
  }
}

export function clearAllBullets(app: PIXI.Application) {
  const bullets = query(world, [Bullet, Position]);
  for (const bullet of bullets) {
    removeBulletSprite(bullet, app);
    bulletTypeMap.delete(bullet);
    removeEntity(world, bullet);
  }
  const rockets = query(world, [Rocket, Position]);
  for (const rocket of rockets) {
    removeRocketSprite(rocket, app);
    rocketLifeMap.delete(rocket);
    removeEntity(world, rocket);
  }
  for (const p of trailParticles) {
    app.stage.removeChild(p.gfx);
    p.gfx.destroy();
  }
  trailParticles.length = 0;
  trailSpawnAccumulatorMS = 0;
}