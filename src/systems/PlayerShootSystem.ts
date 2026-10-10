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
import { time } from '../core/GameTime';
import { dampPerFrame, lerpPerFrame } from '../core/TimeUtils';
import * as PIXI from 'pixi.js';

let shootCooldown = 0;
let rocketCooldown = 0;

const bulletSprites = new Map<number, PIXI.Sprite>();
const rocketSprites = new Map<number, PIXI.Sprite>();

let cachedMainTex: PIXI.Texture | null = null;
let cachedPierceTex: PIXI.Texture | null = null;
let cachedRocketTex: PIXI.Texture | null = null;

let lastBossStage = -1;

const bulletTypeMap = new Map<number, number>();
const rocketLifeMap = new Map<number, number>();

const ROCKET_MAX_LIFE_MS = 10000; // 600 кадров * 16.667

interface StageStyle {
    glowOuter: number; glowOuterA: number;
    glowInner: number; glowInnerA: number;
    blade: number; bladeA: number;
    core: number; coreA: number;
    tip: number; trailColor: number;
}

function getStageStyle(bossStage: number): StageStyle {
    if (bossStage <= 0) return { glowOuter: 0x00f2ff, glowOuterA: 0.0, glowInner: 0x00f2ff, glowInnerA: 0.0, blade: 0x00f2ff, bladeA: 0.8, core: 0xffffff, coreA: 0.9, tip: 0xffffff, trailColor: 0x00f2ff };
    else if (bossStage === 1) return { glowOuter: 0x00f2ff, glowOuterA: 0.2, glowInner: 0x44ffff, glowInnerA: 0.15, blade: 0x00f2ff, bladeA: 0.8, core: 0xffffff, coreA: 0.9, tip: 0xffffff, trailColor: 0x00f2ff };
    else if (bossStage === 2) return { glowOuter: 0xffcc44, glowOuterA: 0.25, glowInner: 0xffdd88, glowInnerA: 0.2, blade: 0x00f2ff, bladeA: 0.8, core: 0xffffff, coreA: 0.9, tip: 0xffffff, trailColor: 0xffcc44 };
    else if (bossStage === 3) return { glowOuter: 0xff9933, glowOuterA: 0.3, glowInner: 0xffbb55, glowInnerA: 0.25, blade: 0xffcc00, bladeA: 0.8, core: 0xffffff, coreA: 0.9, tip: 0xffffff, trailColor: 0xff9933 };
    else if (bossStage === 4) return { glowOuter: 0xff0000, glowOuterA: 0.3, glowInner: 0xff3333, glowInnerA: 0.35, blade: 0xff4444, bladeA: 0.85, core: 0xffaaaa, coreA: 0.9, tip: 0xffffff, trailColor: 0xff3333 };
    else if (bossStage === 5) return { glowOuter: 0x8800ff, glowOuterA: 0.25, glowInner: 0xff0000, glowInnerA: 0.35, blade: 0xff2222, bladeA: 0.85, core: 0xff8888, coreA: 0.9, tip: 0xffffff, trailColor: 0xaa44ff };
    else if (bossStage === 6) return { glowOuter: 0xaa00ff, glowOuterA: 0.35, glowInner: 0x8800ff, glowInnerA: 0.45, blade: 0xff0000, bladeA: 0.85, core: 0xff4444, coreA: 0.9, tip: 0xffffff, trailColor: 0xaa00ff };
    else return { glowOuter: 0xaa00ff, glowOuterA: 0.4, glowInner: 0x8800ff, glowInnerA: 0.5, blade: 0xffffff, bladeA: 0.95, core: 0xffffff, coreA: 1.0, tip: 0xffffff, trailColor: 0xaa00ff };
}

let currentTrailColor = 0x00f2ff;

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

interface TrailParticle {
    gfx: PIXI.Graphics;
    vx: number; vy: number;
    life: number;
    scaleSpeed: number; alphaSpeed: number;
}

const trailParticles: TrailParticle[] = [];
let trailAcc = 0;

function spawnEnergyTrail(app: PIXI.Application, x: number, y: number) {
    const c = new PIXI.Graphics().circle(0, 0, 2 + Math.random() * 2).fill({ color: currentTrailColor, alpha: 0.5 });
    c.x = x + (Math.random() - 0.5) * 3;
    c.y = y;
    app.stage.addChild(c);

    trailParticles.push({ gfx: c, vx: (Math.random() - 0.5) * 0.3, vy: 1.5 + Math.random(), life: 333, scaleSpeed: 0.9, alphaSpeed: 0.03 });
}

function spawnSparkTrail(app: PIXI.Application, x: number, y: number) {
    const s = new PIXI.Graphics().circle(0, 0, 0.8 + Math.random() * 0.8).fill({ color: currentTrailColor, alpha: 0.8 });
    s.x = x;
    s.y = y;

    const a = Math.random() * Math.PI * 2;
    const sp = 1 + Math.random() * 2;

    app.stage.addChild(s);

    trailParticles.push({ gfx: s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 1, life: 250, scaleSpeed: 0.88, alphaSpeed: 0.06 });
}

function spawnGhostTrail(app: PIXI.Application, x: number, y: number) {
    const s = 1.5 + Math.random();
    const gh = new PIXI.Graphics().poly([0, -s * 2, s, 0, 0, s * 2, -s, 0]).fill({ color: currentTrailColor, alpha: 0.2 });
    gh.x = x;
    gh.y = y;
    app.stage.addChild(gh);

    trailParticles.push({ gfx: gh, vx: 0, vy: 2, life: 333, scaleSpeed: 0.95, alphaSpeed: 0.025 });
}

function updateTrails(app: PIXI.Application) {
    for (let i = trailParticles.length - 1; i >= 0; i--) {
        const p = trailParticles[i];

        p.gfx.x += p.vx * time.f;
        p.gfx.y += p.vy * time.f;

        const s = dampPerFrame(p.scaleSpeed, time.f);
        p.gfx.scale.set(p.gfx.scale.x * s);

        p.gfx.alpha -= p.alphaSpeed * time.f;
        p.life -= time.ms;

        if (p.life <= 0 || p.gfx.alpha <= 0) {
            app.stage.removeChild(p.gfx);
            p.gfx.destroy();
            trailParticles.splice(i, 1);
        }
    }
}

export function playerShootSystem(app: PIXI.Application) {
    if (levelState === 'FIREWORKS' || levelState === 'MENU' || levelState === 'COUNTDOWN' || levelState === 'POST_LEVEL') return;
    if (levelState === 'WAITING' && getActiveEnemies() <= 0) return;

    const players = query(world, [Player, Position, Abilities]);
    if (players.length === 0) return;

    const playerEid = players[0];
    const px = Position.x[playerEid];
    const py = Position.y[playerEid];

    if (Abilities.rocketsTimer[playerEid] > 0) {
        rocketCooldown -= time.ms;

        if (rocketCooldown <= 0) {
            rocketCooldown = Abilities.rapidTimer[playerEid] > 0 ? 667 : 1333;
            spawnRockets(app, playerEid);
        }

        return;
    }

    shootCooldown -= time.ms;
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
        Velocity.y[bullet] = -40;

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
        shootCooldown = Abilities.rapidTimer[playerEid] > 0 ? 100 : 200;
    } else if (firedMain) {
        playPlayerShootSound();
        shootCooldown = Abilities.rapidTimer[playerEid] > 0 ? 100 : 200;
    }
}

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

export function rocketMovementSystem(app: PIXI.Application) {
    const rockets = query(world, [Rocket, Position, Velocity]);
    const enemies = query(world, [Enemy, Position, Health]);
    const aliveEnemies = enemies.filter(e => Health.value[e] > 0);
    const rocketsWithoutTarget: number[] = [];

    for (let i = rockets.length - 1; i >= 0; i--) {
        const eid = rockets[i];

        const life = (rocketLifeMap.get(eid) || 0) + time.ms;
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
            const dx = Position.x[currentTarget] - Position.x[eid];
            const dy = Position.y[currentTarget] - Position.y[eid];
            const dist = Math.hypot(dx, dy);

            if (dist > 1) {
                const speed = 4.5;

                const targetVx = (dx / dist) * speed;
                const targetVy = (dy / dist) * speed;

                const k = lerpPerFrame(0.15, time.f);

                Velocity.x[eid] += (targetVx - Velocity.x[eid]) * k;
                Velocity.y[eid] += (targetVy - Velocity.y[eid]) * k;
            }
        } else {
            Velocity.x[eid] *= dampPerFrame(0.95, time.f);
            Velocity.y[eid] += (-4.5 - Velocity.y[eid]) * lerpPerFrame(0.1, time.f);
        }

        const stepX = Velocity.x[eid] * time.f;
        const stepY = Velocity.y[eid] * time.f;

        Position.x[eid] += stepX;
        Position.y[eid] += stepY;

        const prevX = Position.x[eid] - stepX;
        const prevY = Position.y[eid] - stepY;

        const outTop = Position.y[eid] < -100 && prevY <= -100;
        const outBottom = Position.y[eid] > app.screen.height + 100 && prevY >= app.screen.height + 100;
        const outLeft = Position.x[eid] < -100 && prevX <= -100;
        const outRight = Position.x[eid] > app.screen.width + 100 && prevX >= app.screen.width + 100;

        if (outTop || outBottom || outLeft || outRight) {
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

export function bulletMovementSystem(app: PIXI.Application) {
    const bullets = query(world, [Bullet, Position, Velocity]);

    for (let i = 0; i < bullets.length; i++) {
        const eid = bullets[i];

        const stepY = Velocity.y[eid] * time.f;
        Position.y[eid] += stepY;

        const prevY = Position.y[eid] - stepY;

        // Удаляем пулю только если она уже гарантированно ушла за верхнюю границу.
        // Если за один подшаг она пересекла границу, сначала даём отработать коллизиям.
        if (Position.y[eid] < -50 && prevY <= -50) {
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

export function bulletTrailSystem(app: PIXI.Application) {
    trailAcc += time.ms;

    while (trailAcc >= 33.3) {
        trailAcc -= 33.3;

        const bullets = query(world, [Bullet, Position]);

        for (const eid of bullets) {
            const x = Position.x[eid];
            const y = Position.y[eid];

            if (y < -50) continue;

            const type = bulletTypeMap.get(eid) || 0;

            if (type === 0) {
                spawnEnergyTrail(app, x, y + 14);
            } else {
                spawnGhostTrail(app, x, y + 14);
            }
        }

        const rockets = query(world, [Rocket, Position]);

        for (const eid of rockets) {
            spawnSparkTrail(app, Position.x[eid], Position.y[eid] + 16);
        }
    }

    updateTrails(app);
}

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
}