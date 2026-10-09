// ФАЙЛ: src/core/SaveManager.ts

import { query } from 'bitecs';
import { world } from './world';
import { Player } from '../components/Player';
import { Attributes } from '../components/Attributes';
import { Health } from '../components/Health';
import { Abilities } from '../components/Abilities';
import {
    currentLevel,
    setLevel,
    startLevel,
    setCompletedLevelCount,
    completedLevelCount,
    playerLives,
    setPlayerLives,
    bossesDefeated,
    setBossesDefeated,
    setBossLevel,
    setCombatTier
} from './LevelManager';
import { updateHangarUI } from '../ui/HangarManager';
import { getMapData, loadStarMap } from '../ui/StarMapManager';
import { getNodeFloor } from './StarMapGenerator';

export let selectedSaveId: string | null = null;

export function setSelectedSaveId(id: string | null) {
    selectedSaveId = id;
}

function getSaveFloorAndProgress(save: any): { floor: number; progress: number } {
    // Сначала пытаемся взять этаж из актуального текущего узла карты.
    if (save.mapData && Array.isArray(save.mapData.nodes)) {
        const currentNode =
            save.mapData.nodes.find((n: any) => n.state === 'current') ||
            save.mapData.nodes.find((n: any) => n.id === save.mapData.currentNodeId);

        if (currentNode && typeof currentNode.row === 'number') {
            const row = currentNode.row;
            const floor = getNodeFloor(row);
            const rowInFloor = ((row % 5) + 5) % 5;
            const progress = ((rowInFloor + 1) / 5) * 100;

            return { floor, progress };
        }
    }

    // Если карта не доступна, используем сохранённый этаж.
    if (typeof save.floor === 'number') {
        const fallbackRowInFloor = Math.max(0, Math.min(4, ((save.level || 1) - 1) % 5));
        const progress = ((fallbackRowInFloor + 1) / 5) * 100;

        return {
            floor: save.floor,
            progress
        };
    }

    // Последний резервный вариант: количество убитых боссов + 1.
    const floor = (save.bossesDefeated || 0) + 1;
    const fallbackRowInFloor = Math.max(0, Math.min(4, ((save.level || 1) - 1) % 5));
    const progress = ((fallbackRowInFloor + 1) / 5) * 100;

    return { floor, progress };
}

export function loadSavesList() {
    const list = document.getElementById('save-list');
    if (!list) return;

    list.innerHTML = '';

    const savesStr = localStorage.getItem('space_ai_saves');
    let saves: any[] = savesStr ? JSON.parse(savesStr) : [];

    if (saves.length === 0) {
        list.innerHTML = `
            <p style="text-align: center; margin-top: 50px; color: var(--neon); text-shadow: 0 0 10px var(--neon);">
                НЕТ ДАННЫХ В СИСТЕМЕ
            </p>
        `;
        return;
    }

    saves.sort((a: any, b: any) => b.date - a.date).forEach((s: any, index: number) => {
        const itemWrapper = document.createElement('div');
        itemWrapper.style.position = 'relative';

        const item = document.createElement('div');
        item.className = 'save-item swipe-container';

        if (index === 0) item.classList.add('latest-save');

        const floorInfo = getSaveFloorAndProgress(s);

        item.innerHTML = `
            <div class="save-header">
                <span class="save-level">🏆 ЭТАЖ ${floorInfo.floor}</span>
                <span class="save-credits">💰 ${s.credits}</span>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${floorInfo.progress}%;"></div>
            </div>
            <div class="save-stats">
                <span>💥 ${s.weapons}</span>
                <span>🛡️ ${s.armor}</span>
                <span>❤️ ${s.lives || 5}</span>
            </div>
            <div class="save-date">🕒 ${new Date(s.date).toLocaleString()}</div>
            <div class="save-actions">
                <button class="btn-play">▶</button>
                <button class="btn-delete">✖</button>
            </div>
        `;

        const btnPlay = item.querySelector('.btn-play') as HTMLElement;
        const btnDelete = item.querySelector('.btn-delete') as HTMLElement;

        btnPlay.onclick = (e) => {
            e.stopPropagation();
            selectedSaveId = s.id;
            handleLoadGame();
        };

        btnDelete.onclick = (e) => {
            e.stopPropagation();
            selectedSaveId = s.id;
            handleDeleteSave();
        };

        let startX = 0;
        let currentX = 0;

        item.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            item.classList.add('swiping');
        }, { passive: true });

        item.addEventListener('touchmove', (e) => {
            currentX = e.touches[0].clientX - startX;

            if (currentX < 0) {
                item.style.transform = `translateX(${currentX}px)`;
            }
        }, { passive: true });

        item.addEventListener('touchend', () => {
            item.classList.remove('swiping');

            if (currentX < -80) {
                item.style.transform = `translateX(-100%)`;

                setTimeout(() => {
                    selectedSaveId = s.id;
                    handleDeleteSave(true);
                }, 200);
            } else {
                item.style.transform = `translateX(0)`;
            }

            currentX = 0;
        });

        itemWrapper.appendChild(item);
        list.appendChild(itemWrapper);
    });
}

export function handleSaveGame() {
    const players = query(world, [Player]);
    if (players.length === 0) return;

    const p = players[0];

    const savesStr = localStorage.getItem('space_ai_saves');
    let saves: any[] = savesStr ? JSON.parse(savesStr) : [];

    const mapData = getMapData();

    const currentNode = mapData?.nodes.find(n => n.state === 'current');
    const floor = currentNode
        ? getNodeFloor(currentNode.row)
        : bossesDefeated + 1;

    const newSave = {
        id: Date.now().toString(),
        date: Date.now(),
        level: currentLevel,
        credits: Attributes.credits[p],
        weapons: Attributes.weapons[p],
        armor: Attributes.armor[p],
        completedLevelCount: completedLevelCount,
        lives: playerLives,
        bossesDefeated: bossesDefeated,
        floor: floor,
        mapData: mapData ? { ...mapData } : null
    };

    saves.push(newSave);

    localStorage.setItem('space_ai_saves', JSON.stringify(saves));

    alert('ПРОГРЕСС УСПЕШНО СОХРАНЕН!');
}

export function loadSaveData(save: any) {
    const savedBosses = save.bossesDefeated !== undefined
        ? save.bossesDefeated
        : (typeof save.floor === 'number' ? Math.max(0, save.floor - 1) : 0);

    setLevel(save.level || 1);
    setCompletedLevelCount(save.completedLevelCount || 0);
    setPlayerLives(save.lives !== undefined ? save.lives : 5);
    setBossesDefeated(savedBosses);
    setCombatTier(savedBosses);

    const players = query(world, [Player]);

    if (players.length > 0) {
        const p = players[0];

        Attributes.credits[p] = save.credits || 0;
        Attributes.weapons[p] = save.weapons || 0;
        Attributes.armor[p] = save.armor || 0;

        Health.max[p] = 150 + (save.armor || 0) * 15;
        Health.value[p] = Health.max[p];

        Abilities.armorTimer[p] = 0;
        Abilities.shieldTimer[p] = 0;
        Abilities.pierceTimer[p] = 0;
        Abilities.rapidTimer[p] = 0;

        updateHangarUI(p, currentLevel);
    }
}

export function handleLoadGame() {
    if (!selectedSaveId) return;

    const savesStr = localStorage.getItem('space_ai_saves');
    let saves: any[] = savesStr ? JSON.parse(savesStr) : [];

    const save = saves.find((s: any) => s.id === selectedSaveId);

    if (save) {
        loadSaveData(save);

        if (save.mapData) {
            loadStarMap(save.mapData);
        } else {
            setBossLevel(false);
            startLevel();
        }
    }
}

export function handleContinueGame() {
    const savesStr = localStorage.getItem('space_ai_saves');
    let saves: any[] = savesStr ? JSON.parse(savesStr) : [];

    if (saves.length === 0) {
        alert('НЕТ СОХРАНЕНИЙ ДЛЯ ПРОДОЛЖЕНИЯ!');
        return;
    }

    saves.sort((a: any, b: any) => b.date - a.date);

    const save = saves[0];

    loadSaveData(save);

    if (save.mapData) {
        loadStarMap(save.mapData);
    } else {
        setBossLevel(false);
        startLevel();
    }
}

export function handleDeleteSave(silent: boolean = false) {
    if (!selectedSaveId) return;

    if (!silent && !confirm('УДАЛИТЬ ДАННЫЙ СЕКТОР ПАМЯТИ?')) return;

    const savesStr = localStorage.getItem('space_ai_saves');
    let saves: any[] = savesStr ? JSON.parse(savesStr) : [];

    saves = saves.filter((s: any) => s.id !== selectedSaveId);

    localStorage.setItem('space_ai_saves', JSON.stringify(saves));

    selectedSaveId = null;

    loadSavesList();
}

export function handleNewGame() {
    const players = query(world, [Player]);

    if (players.length > 0) {
        const p = players[0];

        setLevel(1);
        setCompletedLevelCount(0);
        setPlayerLives(5);
        setBossesDefeated(0);
        setCombatTier(0);

        Attributes.credits[p] = 0;
        Attributes.weapons[p] = 0;
        Attributes.armor[p] = 0;

        Health.max[p] = 150;
        Health.value[p] = 150;

        Abilities.armorTimer[p] = 0;
        Abilities.shieldTimer[p] = 0;
        Abilities.pierceTimer[p] = 0;
        Abilities.rapidTimer[p] = 0;

        updateHangarUI(p, currentLevel);
    }

    setBossLevel(false);
    startLevel();
}