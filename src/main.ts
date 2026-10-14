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

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

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

// Принудительная портретная ориентация для мобильных устройств
function enforcePortrait() {
    if (!isMobile) return;

    // Пробуем стандартный браузерный API (срабатывает в Android WebView в режиме Fullscreen)
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('portrait').catch(() => {});
    }

    const isPortrait = window.innerHeight > window.innerWidth;

    // Если экран вертикальный — блокируем ориентацию в клиенте Telegram.
    // Если экран горизонтальный — снимаем блокировку, чтобы пользователь мог повернуть телефон.
    sendTgEvent('web_app_toggle_orientation_lock', { locked: isPortrait });
}

// Запрос полноэкранного режима и фиксация портретной ориентации
function requestAppFullscreen() {
    if (!isMobile) return;

    sendTgEvent('web_app_expand');
    sendTgEvent('web_app_request_fullscreen');

    enforcePortrait();

    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        const tg = Telegram.WebApp;

        if (tg.isVersionAtLeast && tg.isVersionAtLeast('8.0') && tg.requestFullscreen) {
            if (!tg.isFullscreen) {
                try {
                    tg.requestFullscreen();
                } catch (e) {}
            }
        }
    }
}

// Запуск контроля портретной ориентации до инициализации игры
if (isMobile) {
    enforcePortrait();

    // Дублируем запрос fullscreen/expand при старте и через небольшую задержку
    requestAppFullscreen();
    setTimeout(requestAppFullscreen, 200);

    window.addEventListener('resize', enforcePortrait);

    window.addEventListener('orientationchange', () => {
        setTimeout(enforcePortrait, 50);
        setTimeout(enforcePortrait, 250);
    });

    // Fullscreen запрашивается при первом пользовательском взаимодействии
    const onceFS = () => {
        requestAppFullscreen();

        document.removeEventListener('touchstart', onceFS);
        document.removeEventListener('click', onceFS);
    };

    document.addEventListener('touchstart', onceFS, { once: true, passive: true } as AddEventListenerOptions);
    document.addEventListener('click', onceFS, { once: true });
}

async function bootstrap() {
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

        try {
            tg.ready();
        } catch (e) {}

        try {
            tg.expand();
        } catch (e) {}

        try {
            if (tg.disableVerticalSwipes) {
                tg.disableVerticalSwipes();
            }
        } catch (e) {}

        if (!isMobile) {
            try {
                if (tg.exitFullscreen) {
                    tg.exitFullscreen();
                }
            } catch (e) {}
        } else {
            enforcePortrait();
        }

        const onResize = () => {
            enforcePortrait();

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

        // Дополнительная страховка, если клиент отдаёт событие смены ориентации
        try {
            tg.onEvent('orientationChanged', onResize);
        } catch (e) {}
    }

    // 3. Дополнительно слушаем стандартный ресайз окна браузера (важно для ПК!)
    window.addEventListener('resize', () => {
        enforcePortrait();

        const container = document.getElementById('app');
        if (container && app && app.renderer) {
            app.renderer.resize(container.clientWidth, container.clientHeight);
        }
    });

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

    // Функция запроса полного экрана.
    // Вызывается по клику пользователя и только на мобильных устройствах.
    const requestFS = () => {
        requestAppFullscreen();
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
               