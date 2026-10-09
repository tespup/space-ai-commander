// ФАЙЛ: src/core/LevelManager.ts
import { showScreen } from '../ui/ScreenManager';
import { getActiveEnemies, resetBossSpawn, clearAllEnemies } from '../systems/EnemySpawnSystem';
import { clearAllBullets } from '../systems/PlayerShootSystem';
import { clearAllEnemyBullets } from '../systems/EnemyShootSystem';
import { spawnFirework } from '../systems/VFXSystem';
import { refreshHangar } from '../ui/HangarManager';
import { app } from './Renderer';
import { query } from 'bitecs';
import { world } from '../core/world';
import { Player } from '../components/Player';
import { Health } from '../components/Health';
import { playSaluteSound, fadeOutMusicOverTime } from './AssetLoader';
import { gameScheduler } from './GameTime';
import { clearDeathGhosts } from '../systems/EnemyRenderSystem';

export let currentLevel = 1;
export let currentLevelIsBoss = false;
export let completedLevelCount = 0;

export let playerLives = 5;
export let bossesDefeated = 0;
export let currentCombatTier = 0;

export function setCombatTier(tier: number) {
    currentCombatTier = Number.isFinite(tier)
        ? Math.max(0, Math.floor(tier))
        : 0;
}

export function getCurrentCombatTier(): number {
    return currentCombatTier;
}

export let levelState:
    | 'MENU'
    | 'COUNTDOWN'
    | 'PLAYING'
    | 'WAITING'
    | 'FIREWORKS'
    | 'POST_LEVEL'
    | 'GAME_OVER' = 'MENU';

let levelTimer = 0;
let fireworksTimer = 0;
let fireworkSpawnTimer = 0;
let postLevelTimer = 0;
let waitingTimer = 0;
let countdownTimer = 0;
let countdownValue = 3;

const LEVEL_DURATION = 30000;
const FIREWORKS_DURATION = 7000;

let onLevelCompleteCallback: (() => void) | null = null;
let onPlayerDeathCallback: (() => void) | null = null;
let onGameOverCallback: (() => void) | null = null;

export function setOnLevelComplete(cb: () => void) {
    onLevelCompleteCallback = cb;
}

export function setOnPlayerDeath(cb: () => void) {
    onPlayerDeathCallback = cb;
}

export function setOnGameOver(cb: () => void) {
    onGameOverCallback = cb;
}

export function getPlayerLives(): number {
    return playerLives;
}

export function setPlayerLives(val: number) {
    playerLives = Number.isFinite(val) ? Math.max(0, Math.floor(val)) : 0;
}

export function getBossesDefeated(): number {
    return bossesDefeated;
}

export function setBossesDefeated(val: number) {
    bossesDefeated = Number.isFinite(val)
        ? Math.max(0, Math.floor(val))
        : 0;

    currentCombatTier = bossesDefeated;
}

export function addLife(count: number = 1) {
    playerLives += count;
}

export function loseLife(): boolean {
    playerLives--;

    if (playerLives <= 0) {
        playerLives = 0;
        return true;
    }

    return false;
}

export function triggerPlayerDeath() {
    const isGameOver = loseLife();

    if (isGameOver) {
        levelState = 'GAME_OVER';

        if (onGameOverCallback) {
            onGameOverCallback();
        }
    } else {
        if (onPlayerDeathCallback) {
            onPlayerDeathCallback();
        }
    }
}

export function resetAfterDeath() {
    gameScheduler.clear();
    clearDeathGhosts();

    clearAllEnemies();
    clearAllBullets(app);
    clearAllEnemyBullets(app);

    const players = query(world, [Player, Health]);

    if (players.length > 0) {
        const p = players[0];
        Health.value[p] = Health.max[p];
    }

    levelState = 'MENU';

    const cdScreen = document.getElementById('countdown-screen');
    if (cdScreen) cdScreen.classList.add('hidden');
}

export function setLevel(lvl: number) {
    currentLevel = lvl;
}

export function setBossLevel(boss: boolean) {
    currentLevelIsBoss = boss;
}

export function setCompletedLevelCount(count: number) {
    completedLevelCount = count;
}

export function startLevel() {
    gameScheduler.clear();
    clearDeathGhosts();

    levelState = 'COUNTDOWN';

    countdownTimer = 0;
    countdownValue = 3;

    levelTimer = 0;
    waitingTimer = 0;

    resetBossSpawn();

    const players = query(world, [Player, Health]);

    if (players.length > 0) {
        const pid = players[0];
        Health.value[pid] = Health.max[pid];
    }

    const panel = document.getElementById('level-upgrade-panel');

    if (panel) {
        panel.style.opacity = '0';
        panel.style.pointerEvents = 'none';
    }

    const hudLvl = document.getElementById('hud-level');
    if (hudLvl) hudLvl.innerText = currentLevel.toString();

    const cdScreen = document.getElementById('countdown-screen');
    const cdText = document.getElementById('countdown-text');

    if (cdScreen) cdScreen.classList.remove('hidden');
    if (cdText) cdText.innerText = '3';

    showScreen('game-hud');
}

export function exitToMenu() {
    gameScheduler.clear();
    clearDeathGhosts();

    levelState = 'MENU';

    const cdScreen = document.getElementById('countdown-screen');
    if (cdScreen) cdScreen.classList.add('hidden');

    showScreen('main-menu');
}

export function updateLevel(deltaMS: number) {
    if (levelState === 'COUNTDOWN') {
        countdownTimer += deltaMS;

        if (countdownTimer >= 1000) {
            countdownTimer -= 1000;
            countdownValue--;

            const cdText = document.getElementById('countdown-text');

            if (countdownValue > 0) {
                if (cdText) cdText.innerText = countdownValue.toString();
            } else if (countdownValue === 0) {
                if (cdText) cdText.innerText = 'GO!';
            } else {
                levelState = 'PLAYING';

                const cdScreen = document.getElementById('countdown-screen');
                if (cdScreen) cdScreen.classList.add('hidden');
            }
        }
    } else if (levelState === 'PLAYING') {
        levelTimer += deltaMS;

        if (levelTimer >= LEVEL_DURATION) {
            levelState = 'WAITING';
            waitingTimer = 0;
        } else if (currentLevelIsBoss && levelTimer > 1000 && getActiveEnemies() <= 0) {
            levelState = 'WAITING';
            waitingTimer = 0;
        }
    } else if (levelState === 'WAITING') {
        if (getActiveEnemies() <= 0) {
            waitingTimer += deltaMS;

            if (waitingTimer >= 2000) {
                levelState = 'FIREWORKS';

                fireworksTimer = 0;
                fireworkSpawnTimer = 0;

                playSaluteSound();
                fadeOutMusicOverTime(FIREWORKS_DURATION);
            }
        }
    } else if (levelState === 'FIREWORKS') {
        fireworksTimer += deltaMS;
        fireworkSpawnTimer -= deltaMS;

        if (fireworkSpawnTimer <= 0) {
            const x = Math.random() * app.screen.width;
            const y = Math.random() * (app.screen.height * 0.7);

            spawnFirework(x, y);

            fireworkSpawnTimer = 150 + Math.random() * 200;
        }

        if (fireworksTimer >= FIREWORKS_DURATION) {
            levelState = 'POST_LEVEL';
            postLevelTimer = 0;

            completedLevelCount++;

            if (currentLevelIsBoss) {
                setBossesDefeated(bossesDefeated + 1);
            }

            const lvlNumDisplay = document.getElementById('level-complete-num');
            if (lvlNumDisplay) lvlNumDisplay.innerText = currentLevel.toString();

            refreshHangar();

            if (onLevelCompleteCallback) {
                onLevelCompleteCallback();
            }
        }
    }
}