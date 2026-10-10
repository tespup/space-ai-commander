// ФАЙЛ: src/main.ts
import './style.css';
import { addEntity, addComponent } from 'bitecs';
import { world } from './core/world';
import { showScreen } from './ui/ScreenManager';
import { startLoader } from './core/Loader';
import { Attributes } from './components/Attributes';
import { Position } from './components/Position';
import { Velocity } from './components/Velocity';
import { Player } from './components/Player';
import { Abilities } from './components/Abilities';
import { Health } from './components/Health';
import { initRenderer, app } from './core/Renderer';
import { initStarfield } from './systems/StarfieldSystem';
import { initShip } from './systems/ShipSystem';
import { initHangar, showHangarFromMap } from './ui/HangarManager';
import { initPlayerControl } from './systems/PlayerControlSystem';
import { useAbility } from './systems/AbilitySystem';
import { initShipSelectionUI } from './ui/ShipSelectionManager';
import {
    startLevel,
    exitToMenu,
    setOnLevelComplete,
    setOnPlayerDeath,
    resetAfterDeath,
    setBossLevel,
    setOnGameOver
} from './core/LevelManager';
import {
    initStarMap,
    completeCurrentNode,
    showStarMap,
    initStarMapEvents,
    revertCurrentNode,
    startStandardBattle,
    resolveAutoBattle,
    hideAutoBattleResult
} from './ui/StarMapManager';
import {
    loadAllAssets,
    playerImageSrc,
    playRandomButtonSound,
    playStartButtonSound,
    setMusicVolume,
    setSfxVolume
} from './core/AssetLoader';
import { initInputManager } from './core/InputManager';
import { startGameLoop, setGamePaused } from './core/GameLoop';
import {
    handleSaveGame,
    handleLoadGame,
    handleContinueGame,
    handleDeleteSave,
    loadSavesList,
    setSelectedSaveId
} from './core/SaveManager';

declare const Telegram: any;

async function bootstrap() {
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        Telegram.WebApp.ready();
        Telegram.WebApp.expand();
        
        // === ИСТИННЫЙ ПОЛНОЭКРАННЫЙ РЕЖИМ TELEGRAM ===
        try {
            if (Telegram.WebApp.requestFullscreen) {
                Telegram.WebApp.requestFullscreen();
            }
            if (Telegram.WebApp.disableVerticalSwipes) {
                Telegram.WebApp.disableVerticalSwipes();
            }
        } catch (e) {
            console.warn('Fullscreen API not supported in this Telegram version', e);
        }
    }

    showScreen('loader-screen');

    try {
        await initRenderer();
        await loadAllAssets();

        initShipSelectionUI(playerImageSrc, (difficulty) => {
            initStarMap(difficulty);
        });

        const player = addEntity(world);
        addComponent(world, player, Player);
        addComponent(world, player, Attributes);
        addComponent(world, player, Abilities);
        addComponent(world, player, Position);
        addComponent(world, player, Velocity);
        addComponent(world, player, Health);

        Attributes.credits[player] = 0;
        Attributes.speed[player] = 0.35; // Увеличена базовая скорость корабля
        Attributes.armor[player] = 0;
        Attributes.weapons[player] = 0;
        Health.max[player] = 150;
        Health.value[player] = 150;
        Abilities.armorTimer[player] = 0;
        Abilities.shieldTimer[player] = 0;
        Abilities.pierceTimer[player] = 0;
        Abilities.rapidTimer[player] = 0;
        Abilities.ramTimer[player] = 0;
        Abilities.rocketsTimer[player] = 0;

        Position.x[player] = app.screen.width / 2;
        Position.y[player] = app.screen.height - 100;
        Velocity.x[player] = 0;
        Velocity.y[player] = 0;

        initStarfield();
        initShip(player);
        initHangar(player, () => 0);
        initPlayerControl();
        initInputManager();
        initStarMapEvents();

        setOnLevelComplete(() => {
            completeCurrentNode();
        });

        setOnPlayerDeath(() => {
            resetAfterDeath();
            revertCurrentNode();
            initShip(player);
            showStarMap();
        });

        setOnGameOver(() => {
            resetAfterDeath();
            showScreen('game-over-screen');
        });

        await startLoader();
        app.stage.sortableChildren = true;
        startGameLoop();
    } catch (e) {
        console.error('Boot error:', e);
        showScreen('main-menu');
    }

    document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const button = target.tagName === 'BUTTON'
            ? target
            : target.closest('button');
        if (button) {
            if (button.id === 'btn-new-game' || button.id === 'btn-start') {
                playStartButtonSound();
            } else {
                playRandomButtonSound();
            }
        }
    });

    const bind = (id: string, callback: () => void) => {
        const el = document.getElementById(id);
        if (el) el.onclick = callback;
    };

    bind('btn-new-game', () => {
        window.dispatchEvent(new Event('ship-select-opened'));
        showScreen('ship-select-screen');
    });

    bind('btn-start', () => {
        handleContinueGame();
    });

    bind('btn-next-level', () => {
        setBossLevel(false);
        startLevel();
    });

    bind('btn-level-exit', exitToMenu);
    bind('btn-level-save', handleSaveGame);

    bind('btn-load-menu', () => {
        setSelectedSaveId(null);
        loadSavesList();
        showScreen('load-screen');
    });

    bind('btn-load-back', () => showScreen('main-menu'));
    bind('btn-load-confirm', handleLoadGame);

    bind('btn-load-delete', () => {
        handleDeleteSave(false);
    });

    bind('btn-settings', () => showScreen('settings-screen'));
    bind('btn-settings-back', () => showScreen('main-menu'));

    bind('btn-exit', () => {
        const exitScreen = document.getElementById('exit-confirm-screen');
        if (exitScreen) exitScreen.classList.remove('hidden');
    });

    bind('btn-exit-no', () => {
        const exitScreen = document.getElementById('exit-confirm-screen');
        if (exitScreen) exitScreen.classList.add('hidden');
    });

    bind('btn-exit-yes', () => {
        window.close();
    });

    bind('btn-map-hangar', () => {
        showHangarFromMap();
    });

    bind('btn-map-save', handleSaveGame);
    bind('btn-map-menu', exitToMenu);

    bind('btn-gameover-menu', () => {
        showScreen('main-menu');
    });

    bind('btn-hangar-back', () => {
        const title = document.getElementById('level-complete-title');
        if (title) {
            title.style.display = 'flex';
            title.innerHTML = `
                <span style="font-size: 0.6em;">УРОВЕНЬ</span>
                <span id="level-complete-num" style="font-size: 1.5em; color: #fff;">1</span>
                <span style="font-size: 0.6em;">ПРОЙДЕН</span>
            `;
        }
        const img = document.getElementById('level-complete-img');
        if (img) img.style.display = 'block';
        const buttonsDiv = document.getElementById('level-complete-buttons');
        if (buttonsDiv) {
            buttonsDiv.style.display = 'flex';
            const btnSave = document.getElementById('btn-level-save');
            const btnNext = document.getElementById('btn-next-level');
            const btnExit = document.getElementById('btn-level-exit');
            if (btnSave) btnSave.style.display = 'inline-block';
            if (btnNext) btnNext.style.display = 'inline-block';
            if (btnExit) btnExit.style.display = 'inline-block';
        }
        const backBtn = document.getElementById('btn-hangar-back');
        if (backBtn) backBtn.style.display = 'none';
        showStarMap();
    });

    const volMusic = document.getElementById('vol-music') as HTMLInputElement;
    if (volMusic) {
        volMusic.oninput = () => setMusicVolume(parseFloat(volMusic.value));
    }

    const volSfx = document.getElementById('vol-sfx') as HTMLInputElement;
    if (volSfx) {
        volSfx.oninput = () => setSfxVolume(parseFloat(volSfx.value));
    }

    bind('btn-pause-menu', () => {
        setGamePaused(true);
        const pauseScreen = document.getElementById('pause-screen');
        if (pauseScreen) pauseScreen.classList.remove('hidden');
    });

    bind('btn-pause-resume', () => {
        setGamePaused(false);
        const pauseScreen = document.getElementById('pause-screen');
        if (pauseScreen) pauseScreen.classList.add('hidden');
    });

    bind('btn-pause-exit', () => {
        setGamePaused(false);
        const pauseScreen = document.getElementById('pause-screen');
        if (pauseScreen) pauseScreen.classList.add('hidden');
        exitToMenu();
    });

    bind('btn-ab-armor', () => useAbility('armor'));
    bind('btn-ab-shield', () => useAbility('shield'));
    bind('btn-ab-pierce', () => useAbility('pierce'));
    bind('btn-ab-rapid', () => useAbility('rapid'));
    bind('btn-ab-ram', () => useAbility('ram'));
    bind('btn-ab-rockets', () => useAbility('rockets'));

    bind('btn-battle-standard', () => {
        startStandardBattle();
    });

    bind('btn-battle-auto', () => {
        resolveAutoBattle();
    });

    bind('btn-auto-battle-continue', () => {
        hideAutoBattleResult();
    });
}

bootstrap();