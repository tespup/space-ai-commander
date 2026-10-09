// ФАЙЛ: src/systems/ShipSystem.ts
import * as PIXI from 'pixi.js';
import { app } from '../core/Renderer';
import { query } from 'bitecs';
import { world } from '../core/world';
import { Position } from '../components/Position';
import { Player } from '../components/Player';
import { Abilities } from '../components/Abilities';
import { spawnThrusterFire, spawnWingTrail } from './VFXSystem';
import { levelState } from '../core/LevelManager';

const shipVisuals = new Map<number, { base: PIXI.Container, ship: PIXI.Sprite, armor: PIXI.Container, shield: PIXI.Graphics, ramArc: PIXI.Graphics, skinIndex: number }>();
const playerShakes = new Map<number, number>();

let cachedTextures: PIXI.Texture[] = [];
let cachedMasks: { engines: { x: number, y: number }[], wings: { x: number, y: number }[], mainGuns: { x: number, y: number }[], sideGuns: { x: number, y: number }[] }[] = [];

export function initPlayerTextures(textures: PIXI.Texture[], masks: any[]) {
  cachedTextures = textures;
  cachedMasks = masks;
}

export function shakePlayer(eid: number, intensity: number = 5) {
  playerShakes.set(eid, intensity);
}

export function getPlayerMasks(eid: number) {
  const vis = shipVisuals.get(eid);
  if (!vis) return null;
  return cachedMasks[vis.skinIndex];
}

export function removePlayerSprite(eid: number) {
  const visuals = shipVisuals.get(eid);
  if (visuals) {
    app.stage.removeChild(visuals.base);
    visuals.base.destroy({ children: true });
    shipVisuals.delete(eid);
  }
}

export function initShip(eid: number) {
  const container = new PIXI.Container();
  const armorContainer = new PIXI.Container();
  armorContainer.visible = false;
  container.addChild(armorContainer);

  const leftArcCyan = new PIXI.Graphics()
    .arc(0, 0, 60, Math.PI * 0.7, Math.PI * 1.3)
    .stroke({ color: 0x00f2ff, width: 2, alpha: 0.8 });
  leftArcCyan.x = -2;

  const leftArcRed = new PIXI.Graphics()
    .arc(0, 0, 60, Math.PI * 0.7, Math.PI * 1.3)
    .stroke({ color: 0xff0033, width: 2, alpha: 0.6 });
  leftArcRed.x = 2;
  leftArcRed.blendMode = 'add';

  armorContainer.addChild(leftArcCyan, leftArcRed);

  const rightArcCyan = new PIXI.Graphics()
    .arc(0, 0, 60, Math.PI * 1.7, Math.PI * 0.3)
    .stroke({ color: 0x00f2ff, width: 2, alpha: 0.8 });
  rightArcCyan.x = -2;

  const rightArcRed = new PIXI.Graphics()
    .arc(0, 0, 60, Math.PI * 1.7, Math.PI * 0.3)
    .stroke({ color: 0xff0033, width: 2, alpha: 0.6 });
  rightArcRed.x = 2;
  rightArcRed.blendMode = 'add';

  armorContainer.addChild(rightArcCyan, rightArcRed);

  const skinIndex = parseInt(localStorage.getItem('space_ai_ship_index') || '0');
  const shipSprite = new PIXI.Sprite(cachedTextures[skinIndex]);
  shipSprite.anchor.set(0.5);
  container.addChild(shipSprite);

  const shieldVisual = new PIXI.Graphics()
    .circle(0, 0, 55).fill({ color: 0x00ffff, alpha: 0.2 }).stroke({ color: 0x00ffff, width: 2 });
  shieldVisual.visible = false;
  container.addChild(shieldVisual);

  // === ЗАДАЧА 5: Дуга щита для Тарана ===
  const ramArc = new PIXI.Graphics()
    .arc(0, -10, 50, Math.PI * 1.2, Math.PI * 1.8)
    .stroke({ color: 0xff5500, width: 4, alpha: 0.9 });
  ramArc.visible = false;
  container.addChild(ramArc);

  app.stage.addChild(container);
  container.zIndex = 20;

  shipVisuals.set(eid, { base: container, ship: shipSprite, armor: armorContainer, shield: shieldVisual, ramArc, skinIndex });
}

/**
 * Обновление визуала корабля.
 * @param deltaFrames — множитель времени (1.0 при 60 мс, 2.0 при 30 мс)
 */
export function shipUpdate(deltaFrames: number) {
  const entities = query(world, [Player, Position, Abilities]);

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    const visuals = shipVisuals.get(eid);
    if (!visuals) continue;

    visuals.base.visible = levelState !== 'MENU';

    const savedIndex = parseInt(localStorage.getItem('space_ai_ship_index') || '0');
    if (visuals.skinIndex !== savedIndex) {
      visuals.skinIndex = savedIndex;
      visuals.ship.texture = cachedTextures[savedIndex];
    }

    const shake = playerShakes.get(eid) || 0;
    let ox = 0, oy = 0;
    if (shake > 0) {
      ox = (Math.random() - 0.5) * shake * 2;
      oy = (Math.random() - 0.5) * shake * 2;
      // ПЕРЕВОД НА ВРЕМЯ: было -0.5 за кадр
      playerShakes.set(eid, shake - 0.5 * deltaFrames);
    }

    visuals.base.x = Position.x[eid] + ox;
    visuals.base.y = Position.y[eid] + oy;
    visuals.base.rotation = 0;

    visuals.armor.visible = Abilities.armorTimer[eid] > 0;
    visuals.shield.visible = Abilities.shieldTimer[eid] > 0;

    // === ЗАДАЧА 5: Визуал дуги тарана ===
    visuals.ramArc.visible = Abilities.ramTimer[eid] > 0;
    if (visuals.ramArc.visible) {
      visuals.ramArc.alpha = 0.6 + Math.sin(Date.now() / 100) * 0.4;
    }

    if (visuals.shield.visible) {
      visuals.shield.alpha = 0.5 + Math.sin(Date.now() / 150) * 0.5;
    }

    const masks = cachedMasks[visuals.skinIndex];
    if (masks && visuals.base.visible) {
      // ПЕРЕВОД НА ВРЕМЯ: вероятностный спавн огня двигателей.
      // Было: > 0.2 за кадр = 80% шанс. Стало: шанс пропорционален времени.
      const fireChance = Math.min(1, 0.8 * deltaFrames);
      if (Math.random() < fireChance) {
        for (let j = 0; j < masks.engines.length; j++) {
          spawnThrusterFire(visuals.base.x + masks.engines[j].x, visuals.base.y + masks.engines[j].y);
        }
      }

      // ПЕРЕВОД НА ВРЕМЯ: вероятностный спавн следов крыльев.
      // Было: > 0.4 за кадр = 60% шанс. Стало: шанс пропорционален времени.
      const trailChance = Math.min(1, 0.6 * deltaFrames);
      if (Math.random() < trailChance) {
        for (let k = 0; k < masks.wings.length; k++) {
          spawnWingTrail(visuals.base.x + masks.wings[k].x, visuals.base.y + masks.wings[k].y);
        }
      }
    }
  }
}