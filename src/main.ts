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
import { initTextureFactory } from './core/Textures';
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

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const PORTRAIT_OVERLAY_ID = 'portrait-rotate-overlay';

let lastPortraitState: boolean | null = null;

// Функция прямой отправки команд в клиент Telegram (с (window as any) для TypeScript)
function sendTgEvent(eventType: string, eventData?: any) {
    const dataStr = eventData ? JSON.stringify(eventData) : '';
    const w = window as any;

    try {
        if (w.TelegramWebviewProxy && w.TelegramWebviewProxy.postEvent) {
            w.TelegramWebviewProxy.postEvent(eventType, dataStr);
        } else if (w.external && w.external.invoke) {
            w.external.invoke(JSON.stringify({ eventType, eventData }));
        } else if (window.parent !== window) {
            window.parent.postMessage(JSON.stringify({ eventType, eventData }), '*');
        }
    } catch (e) {}
}

function isPortraitViewport(): boolean {
    return window.innerHeight >= window.innerWidth;
}

/*
    Инвертированная технология ориентации:
    игра требует ПОРТРЕТНЫЙ режим.

    Если телефон находится в ландшафте:
    - показывается оверлей "поверни телефон вертикально";
    - ориентация в Telegram разблокируется, чтобы пользователь мог повернуть устройство.

    Если телефон уже в портрете:
    - оверлей скрывается;
    - ориентация фиксируется, чтобы игра случайно не уехала в ландшафт.
*/
function enforcePortrait(force = false) {
    try {
        document.documentElement.classList.add('orientation-guard-ready');
    } catch (e) {}

    if (!isMobile) {
        return;
    }

    const overlay = document.getElementById(PORTRAIT_OVERLAY_ID);
    const portrait = isPortraitViewport();

    if (overlay) {
        overlay.classList.toggle('visible', !portrait);
    }

    if (force || portrait !== lastPortraitState) {
        try {
            const orientation = (screen as any).orientation;
            if (orientation && typeof orientation.lock === 'function') {
                orientation.lock('portrait').catch(() => {});
            }
        } catch (e) {}

        if (portrait) {
            sendTgEvent('web_app_toggle_orientation_lock', { locked: true });
        } else {
            sendTgEvent('web_app_toggle_orientation_lock', { locked: false });
        }

        lastPortraitState = portrait;
    }
}

enforcePortrait(true);

async function bootstrap() {
    enforcePortrait(true);

    window.addEventListener('orientationchange', () => {
        setTimeout(() => enforcePortrait(true), 50);
        setTimeout(() => enforcePortrait(true), 250);
    });

    // 1. ЕСЛИ ЭТО ПК — безусловно и сразу выкидываем окно из кривого Fullscreen
    // (НЕ проверяем здесь typeof Telegram, так как на ПК без скрипта он undefined!)
    if (!isMobile) {
        sendTgEvent('web_app_ready');
        sendTgEvent('web_app_exit_fullscreen');
        setTimeout(() => sendTgEvent('web_app_exit_fullscreen'), 150);
        setTimeout(() => sendTgEvent('web_app_exit_fullscreen'), 500);
    }

    // 2. Если объект Telegram всё же доступен (например, на смартфонах)
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        const tg = Telegram.WebApp;

        try { tg.ready(); } catch (e) {}
        try { tg.expand(); } catch (e) {}

        try {
            if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
        } catch (e) {}

        if (!isMobile) {
            try { if (tg.exitFullscreen) tg.exitFullscreen(); } catch (e) {}
        }

        const onResize = () => {
            enforcePortrait(true);

            const container = document.getElementById('app');
            if (container && app && app.renderer) {
                app.renderer.resize(container.clientWidth, container.clientHeight);
            }
        };

        tg.onEvent('fullscreenFailed', (e: any) => console.warn('fullscreen failed', e?.error));
        tg.onEvent('fullscreenChanged', onResize);
        tg.onEvent('viewportChanged', onResize);
        tg.onEvent('safeAreaChanged', onResize);
        tg.onEvent('contentSafeAreaChanged', onResize);
    }

    // 3. Дополнительно слушаем стандартный ресайз окна браузера (важно для ПК!)
    window.addEventListener('resize', () => {
        enforcePortrait(false);

        const container = document.getElementById('app');
        if (container && app && app.renderer) {
            app.renderer.resize(container.clientWidth, container.clientHeight);
        }
    });

    showScreen('loader-screen');

    try {
        await initRenderer();
        initTextureFactory(app);
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
        Attributes.speed[player] = 0.8;
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

    // ИСПРАВЛЕНИЕ: Функция запроса полного экрана.
    // Вызывается ТОЛЬКО по клику пользователя И ТОЛЬКО НА МОБИЛЬНЫХ.
    // Дополнительно теперь она проверяет портретную ориентацию.
    const requestFS = () => {
        if (!isMobile) return;

        enforcePortrait(true);

        // Если пользователь всё ещё в ландшафте, не пытаемся раскрывать игру на весь экран.
        if (!isPortraitViewport()) return;

        sendTgEvent('web_app_expand');
        sendTgEvent('web_app_request_fullscreen');

        if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
            const tg = Telegram.WebApp;
            if (tg.isVersionAtLeast && tg.isVersionAtLeast('8.0') && tg.requestFullscreen) {
                if (!tg.isFullscreen) {
                    try { tg.requestFullscreen(); } catch (e) {}
                }
            }
        }
    };

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
        requestFS();
        window.dispatchEvent(new Event('ship-select-opened'));
        showScreen('ship-select-screen');
    });

    bind('btn-start', () => {
        requestFS();
        handleContinueGame();
    });

    bind('btn-next-level', () => {
        requestFS();
        setBossLevel(false);
        startLevel();
    });

    bind('btn-level-exit', exitToMenu);
    bind('btn-level-save', handleSaveGame);

    bind('btn-load-menu', () => {
        requestFS();
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
        requestFS();
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
        requestFS();
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