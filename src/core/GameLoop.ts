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
import { playerShootSystem, bulletMovementSystem, bulletRenderSystem, bulletTrailSystem, rocketMovementSystem, rocketRenderSystem } from '../systems/PlayerShootSystem';
import { enemyBulletMovementSystem, enemyBulletRenderSystem } from '../systems/EnemyShootSystem';
import { enemySpawnSystem } from '../systems/EnemySpawnSystem';
import { enemyMovementSystem } from '../systems/EnemyMovementSystem';
import { enemyRenderSystem } from '../systems/EnemyRenderSystem';
import { collisionSystem } from '../systems/CollisionSystem';
import { abilitySystem, updateAbilityHud } from '../systems/AbilitySystem';
import { updateVFX } from '../systems/VFXSystem';
import { currentParallaxX, currentParallaxY, updateParallax, resetParallax } from './InputManager';
import { setStep, gameScheduler } from './GameTime';

let gamePaused = false;
export function setGamePaused(val: boolean) { gamePaused = val; }
export function isGamePaused(): boolean { return gamePaused; }

// Пишем в DOM только когда значения реально изменились
let elHpFill: HTMLElement | null = null;
let elHpText: HTMLElement | null = null;
let elLives: HTMLElement | null = null;
let lastHpPct = -1;
let lastHpColorMode = -1;
let lastHpText = '';
let lastLives = -1;

function updatePlayerHPBar() {
    const players = query(world, [Player, Health]);
    if (players.length === 0) return;
    const p = players[0];
    const hp = Math.max(0, Health.value[p]);
    const maxHp = Health.max[p];
    const percent = Math.min(100, (hp / maxHp) * 100);
    if (!elHpFill) elHpFill = document.getElementById('hp-bar-fill');
    if (!elHpText) elHpText = document.getElementById('hp-bar-text');
    if (elHpFill) {
        if (percent !== lastHpPct) {
            lastHpPct = percent;
            elHpFill.style.width = `${percent}%`;
        }
        const mode = percent > 50 ? 0 : percent > 20 ? 1 : 2;
        if (mode !== lastHpColorMode) {
            lastHpColorMode = mode;
            if (mode === 0) elHpFill.style.background = 'linear-gradient(90deg, #00ffaa, #00ff88)';
            else if (mode === 1) elHpFill.style.background = 'linear-gradient(90deg, #ffff00, #ffcc00)';
            else elHpFill.style.background = 'linear-gradient(90deg, #ff0033, #ff4455)';
        }
    }
    if (elHpText) {
        const t = `${Math.floor(hp)} / ${Math.floor(maxHp)}`;
        if (t !== lastHpText) {
            lastHpText = t;
            elHpText.textContent = t;
        }
    }
}

function updateLivesDisplay() {
    const lives = getPlayerLives();
    if (lives === lastLives) return;
    lastLives = lives;
    if (!elLives) elLives = document.getElementById('hud-lives');
    if (elLives) elLives.textContent = lives.toString();
}

const MAX_FRAME_MS = 100;
const MAX_STEP_MS = 33.3;

export function startGameLoop() {
    app.ticker.add((ticker) => {
        if (gamePaused) return;

        const frameMs = Math.min(ticker.deltaMS, MAX_FRAME_MS);

        // --- Симуляция: подшагами ---
        let rest = frameMs;
        while (rest > 0.001) {
            const step = Math.min(rest, MAX_STEP_MS);
            setStep(step);

            updateLevel(step);
            enemySpawnSystem(step);
            abilitySystem(step);
            playerControlSystem();
            movementSystem();
            playerShootSystem(app);
            bulletMovementSystem(app);
            rocketMovementSystem(app);
            
            if (levelState !== 'MENU' && levelState !== 'POST_LEVEL' && levelState !== 'GAME_OVER') {
                enemyMovementSystem(app);
            }
            
            enemyBulletMovementSystem(app);
            collisionSystem(app);
            gameScheduler.update(step);

            rest -= step;
        }

        // --- Визуальная часть: один раз за кадр на полный dt ---
        setStep(frameMs);
        updateAbilityHud();
        
        const bg = document.getElementById('menu-bg');
        if (levelState === 'MENU') {
            if (bg && !bg.classList.contains('active')) bg.classList.add('active');
            updateParallax();
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

        starfieldUpdate();
        shipUpdate();
        enemyRenderSystem();
        updateVFX();
        bulletRenderSystem();
        rocketRenderSystem();
        enemyBulletRenderSystem();
        bulletTrailSystem(app);

        if (levelState === 'PLAYING' || levelState === 'WAITING' || levelState === 'FIREWORKS') {
            updatePlayerHPBar();
            updateLivesDisplay();
        }
    });
}