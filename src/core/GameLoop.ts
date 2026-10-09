// ФАЙЛ: src/core/GameLoop.ts
import { app } from './Renderer';
import { query } from 'bitecs';
import { world } from './world';
import { Player } from '../components/Player';
import { Health } from '../components/Health';
import { updateLevel, levelState, getPlayerLives } from './LevelManager';
import { playerControlSystem } from '../systems/PlayerControlSystem';
import { movementSystem } from '../systems/MovementSystem';
import { starfieldUpdate } from '../systems/StarfieldSystem';
import { shipUpdate } from '../systems/ShipSystem';
import {
  playerShootSystem,
  bulletMovementSystem,
  bulletRenderSystem,
  bulletTrailSystem,
  rocketMovementSystem,
  rocketRenderSystem,
} from '../systems/PlayerShootSystem';
import { enemyBulletMovementSystem, enemyBulletRenderSystem } from '../systems/EnemyShootSystem';
import { enemySpawnSystem } from '../systems/EnemySpawnSystem';
import { enemyMovementSystem } from '../systems/EnemyMovementSystem';
import { enemyRenderSystem } from '../systems/EnemyRenderSystem';
import { collisionSystem } from '../systems/CollisionSystem';
import { abilitySystem } from '../systems/AbilitySystem';
import { updateVFX } from '../systems/VFXSystem';
import { currentParallaxX, currentParallaxY, updateParallax, resetParallax } from './InputManager';
import { clampDeltaMS, frameFromDeltaMS } from './TimeUtils';

// === ЗАДАЧА 8: Пауза ===
let gamePaused = false;
export function setGamePaused(val: boolean) { gamePaused = val; }
export function isGamePaused(): boolean { return gamePaused; }

function updatePlayerHPBar() {
  const players = query(world, [Player, Health]);
  if (players.length === 0) return;
  const p = players[0];
  const hp = Math.max(0, Health.value[p]);
  const maxHp = Health.max[p];
  const percent = Math.min(100, (hp / maxHp) * 100);
  const fill = document.getElementById('hp-bar-fill');
  const text = document.getElementById('hp-bar-text');
  if (fill) {
    fill.style.width = `${percent}%`;
    if (percent > 50) fill.style.background = 'linear-gradient(90deg, #00ffaa, #00ff88)';
    else if (percent > 20) fill.style.background = 'linear-gradient(90deg, #ffff00, #ffcc00)';
    else fill.style.background = 'linear-gradient(90deg, #ff0033, #ff4455)';
  }
  if (text) {
    text.innerText = `${Math.floor(hp)} / ${Math.floor(maxHp)}`;
  }
}

function updateLivesDisplay() {
  const lives = getPlayerLives();
  const hudLives = document.getElementById('hud-lives');
  if (hudLives) hudLives.innerText = lives.toString();
}

export function startGameLoop() {
  app.ticker.add((ticker) => {
    // === ЗАДАЧА 8: При паузе не обновляем игровые системы ===
    if (gamePaused) return;

    // === ЕДИНОЕ ПРАВИЛО ВРЕМЕНИ ===
    // Получаем реальное время кадра в миллисекундах и ограничиваем скачки.
    const rawDeltaMS = ticker.deltaMS;
    const deltaMS = clampDeltaMS(rawDeltaMS);
    // Коэффициент «кадров при 60 FPS» для скоростей и инерции.
    const deltaFrames = frameFromDeltaMS(deltaMS);

    updateLevel(deltaMS);

    const bg = document.getElementById('menu-bg');
    if (levelState === 'MENU') {
      if (bg && !bg.classList.contains('active')) bg.classList.add('active');
      updateParallax(deltaFrames);
      if (bg) bg.style.transform = `translate(${currentParallaxX * 20}px, ${currentParallaxY * 20}px)`;
      const ui = document.getElementById('menu-ui-wrapper');
      if (ui) ui.style.transform = `translate(${currentParallaxX * -5}px, ${currentParallaxY * -5}px)`;
      app.stage.x = currentParallaxX * 15;
      app.stage.y = currentParallaxY * 15;
    } else {
      if (bg && bg.classList.contains('active')) bg.classList.remove('active');
      app.stage.x = 0;
      app.stage.y = 0;
      resetParallax();
    }

    playerControlSystem(deltaMS, deltaFrames);
    movementSystem(deltaFrames);
    starfieldUpdate(deltaFrames);
    shipUpdate(deltaFrames);
    playerShootSystem(app, deltaMS, deltaFrames);
    bulletMovementSystem(app, deltaFrames);
    bulletRenderSystem();
    rocketMovementSystem(app, deltaMS, deltaFrames);
    rocketRenderSystem();
    bulletTrailSystem(app, deltaMS, deltaFrames);
    enemyBulletMovementSystem(app, deltaFrames);
    enemyBulletRenderSystem();
    enemySpawnSystem(deltaMS);

    if (levelState !== 'MENU' && levelState !== 'POST_LEVEL' && levelState !== 'GAME_OVER') {
      enemyMovementSystem(deltaMS, deltaFrames, app);
    }

    enemyRenderSystem(deltaFrames);
    collisionSystem(app, deltaMS);
    abilitySystem(deltaMS);
    updateVFX(deltaFrames);

    if (levelState === 'PLAYING' || levelState === 'WAITING' || levelState === 'FIREWORKS') {
      updatePlayerHPBar();
      updateLivesDisplay();
    }
  });
}