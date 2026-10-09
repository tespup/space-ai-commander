// ФАЙЛ: src/core/AssetLoader.ts
import * as PIXI from 'pixi.js';
import { sound } from '@pixi/sound';
import { processPlayerMask } from '../utils/ImageProcessor';
import { initPlayerTextures } from '../systems/ShipSystem';
import { initEnemyTextures, initBossTextures } from '../systems/EnemySpawnSystem';
import shipImg from '../assets/ship/ship.png';
import bossImg from '../assets/boss/boss.png';
import playerImg from '../assets/ship/player/player.png';
import playerMaskImg from '../assets/ship/player/player_mask.png';

export const levelCompleteImages = Object.values(
    import.meta.glob('../assets/level complete/*.jpg', { eager: true, query: '?url', import: 'default' })
) as string[];

export const loadBgImages = Object.values(
    import.meta.glob('../assets/load/*.{jpg,png,webp}', { eager: true, query: '?url', import: 'default' })
) as string[];

export const menuBgImages = Object.values(
    import.meta.glob('../assets/menu/*.{jpg,png,webp}', { eager: true, query: '?url', import: 'default' })
) as string[];

export const playerImageSrc = playerImg;

const musicTracks: Record<string, string[]> = {
    'menu': Object.values(import.meta.glob('../assets/music/main menu/*.{mp3,wav}', { eager: true, query: '?url', import: 'default' })) as string[],
    'ship-select': Object.values(import.meta.glob('../assets/music/ship select/*.{mp3,wav}', { eager: true, query: '?url', import: 'default' })) as string[],
    'game': Object.values(import.meta.glob('../assets/music/game/*.{mp3,wav}', { eager: true, query: '?url', import: 'default' })) as string[],
    'shop': Object.values(import.meta.glob('../assets/music/shop/*.{mp3,wav}', { eager: true, query: '?url', import: 'default' })) as string[],
    'loading': Object.values(import.meta.glob('../assets/music/loading/*.{mp3,wav}', { eager: true, query: '?url', import: 'default' })) as string[],
    'game-over': Object.values(import.meta.glob('../assets/music/game over/*.{mp3,wav}', { eager: true, query: '?url', import: 'default' })) as string[],
};

export const buttonSounds = Object.values(import.meta.glob('../assets/sounds/button/*.wav', { eager: true, query: '?url', import: 'default' })) as string[];
export const startButtonSounds = Object.values(import.meta.glob('../assets/sounds/start button/*.wav', { eager: true, query: '?url', import: 'default' })) as string[];
export const playerShootSounds = Object.values(import.meta.glob('../assets/sounds/player shoot/*.wav', { eager: true, query: '?url', import: 'default' })) as string[];
export const playerShootDopSounds = Object.values(import.meta.glob('../assets/sounds/player shoot dop/*.wav', { eager: true, query: '?url', import: 'default' })) as string[];
export const enemyShootSounds = Object.values(import.meta.glob('../assets/sounds/enemy shoot/*.wav', { eager: true, query: '?url', import: 'default' })) as string[];
export const bossShootSounds = Object.values(import.meta.glob('../assets/sounds/boss shoot/*.wav', { eager: true, query: '?url', import: 'default' })) as string[];
export const boomSounds = Object.values(import.meta.glob('../assets/sounds/boom/*.wav', { eager: true, query: '?url', import: 'default' })) as string[];
export const bossEnterSounds = Object.values(import.meta.glob('../assets/sounds/boss enter/*.wav', { eager: true, query: '?url', import: 'default' })) as string[];
export const saluteSounds = Object.values(import.meta.glob('../assets/sounds/salute/*.wav', { eager: true, query: '?url', import: 'default' })) as string[];

let activeMusicTrack: string | null = null;
let activeMusicCategory: string | null = null;
export let musicVolume = 1.0;
export let sfxVolume = 1.0;
let isFading = false;
let fadeIntervalId: ReturnType<typeof setInterval> | null = null;

export function setMusicVolume(vol: number) {
    musicVolume = vol;
    if (activeMusicTrack && !isFading) {
        sound.volume(activeMusicTrack, musicVolume);
    }
}

export function setSfxVolume(vol: number) { sfxVolume = vol; }

function playGenericSound(tracks: string[]) {
    if (tracks.length === 0) return;
    const track = tracks[Math.floor(Math.random() * tracks.length)];
    if (!sound.exists(track)) sound.add(track, track);
    sound.volume(track, sfxVolume);
    sound.play(track);
}

export const playRandomButtonSound = () => playGenericSound(buttonSounds);
export const playStartButtonSound = () => playGenericSound(startButtonSounds);
export const playPlayerShootSound = () => playGenericSound(playerShootSounds);
export const playPlayerShootDopSound = () => playGenericSound(playerShootDopSounds);
export const playEnemyShootSound = () => playGenericSound(enemyShootSounds);
export const playBossShootSound = () => playGenericSound(bossShootSounds);
export const playBoomSound = () => playGenericSound(boomSounds);
export const playBossEnterSound = () => playGenericSound(bossEnterSounds);
export const playSaluteSound = () => playGenericSound(saluteSounds);

function killCurrentFade() {
    if (fadeIntervalId) { clearInterval(fadeIntervalId); fadeIntervalId = null; }
    isFading = false;
}

// === ЗАДАЧА 9: Полная остановка всей музыки ===
export function stopAllMusic() {
    killCurrentFade();
    // Останавливаем ВСЕ музыкальные треки
    for (const category of Object.keys(musicTracks)) {
        for (const track of musicTracks[category]) {
            if (sound.exists(track)) {
                try { sound.stop(track); } catch(e) {}
            }
        }
    }
    activeMusicTrack = null;
    activeMusicCategory = null;
}

export function fadeOutMusicOverTime(durationMs: number) {
    if (!activeMusicTrack) return;
    killCurrentFade();
    const trackToFade = activeMusicTrack;
    const startVol = musicVolume;
    const steps = Math.max(1, Math.ceil(durationMs / 100));
    const volStep = startVol / steps;
    let currentVol = startVol;
    isFading = true;
    fadeIntervalId = setInterval(() => {
        currentVol -= volStep;
        if (currentVol <= 0) {
            killCurrentFade();
            try { sound.stop(trackToFade); } catch(e) {}
            if (activeMusicTrack === trackToFade) {
                activeMusicTrack = null;
                activeMusicCategory = null;
            }
        } else {
            try { sound.volume(trackToFade, currentVol); } catch(e) {}
        }
    }, 100);
}

function fadeOutCurrentMusic(callback?: () => void) {
    if (!activeMusicTrack || isFading) {
        if (callback) callback();
        return;
    }
    isFading = true;
    const trackToFade = activeMusicTrack;
    let currentVol = sound.volume(trackToFade) as number;
    fadeIntervalId = setInterval(() => {
        currentVol -= 0.1;
        if (currentVol <= 0) {
            killCurrentFade();
            try { sound.stop(trackToFade); } catch(e) {}
            if (activeMusicTrack === trackToFade) {
                activeMusicTrack = null;
            }
            if (callback) callback();
        } else {
            try { sound.volume(trackToFade, currentVol); } catch(e) {}
        }
    }, 100);
}

export function switchMusicForScreen(screenId: string) {
    let targetCategory: string | null = null;

    if (screenId === 'main-menu' || screenId === 'settings-screen' || screenId === 'loader-screen') targetCategory = 'menu';
    else if (screenId === 'ship-select-screen') targetCategory = 'ship-select';
    else if (screenId === 'game-hud') targetCategory = 'game';
    else if (screenId === 'level-complete-screen') targetCategory = 'shop';
    else if (screenId === 'load-screen') targetCategory = 'loading';
    else if (screenId === 'game-over-screen') targetCategory = 'game-over';
    else if (screenId === 'star-map-screen') targetCategory = 'menu';

    if (!targetCategory || activeMusicCategory === targetCategory) return;

    // === ЗАДАЧА 9: Жёсткая остановка ЛЮБОГО текущего трека и фейда ===
    killCurrentFade();
    if (activeMusicTrack) {
        try { sound.stop(activeMusicTrack); } catch(e) {}
        activeMusicTrack = null;
    }

    activeMusicCategory = targetCategory;

    // Запускаем новый трек сразу (без фейда, чтобы избежать наложения)
    const categoryTracks = musicTracks[activeMusicCategory] || [];
    if (categoryTracks.length === 0) return;

    activeMusicTrack = categoryTracks[Math.floor(Math.random() * categoryTracks.length)];
    if (!sound.exists(activeMusicTrack)) sound.add(activeMusicTrack, activeMusicTrack);
    sound.volume(activeMusicTrack, musicVolume);
    sound.play(activeMusicTrack, { loop: true });
}

export async function loadAllAssets() {
    const pMaskImg = new Image();
    pMaskImg.src = playerMaskImg;
    await new Promise((resolve, reject) => { pMaskImg.onload = resolve; pMaskImg.onerror = reject; });

    const playerMaskData = processPlayerMask(pMaskImg, 5, 5);
    const playerBaseTex = await PIXI.Assets.load(playerImg);
    const playerTextures: PIXI.Texture[] = [];
    const pCols = 5, pRows = 5;
    const pFrameW = playerBaseTex.width / pCols;
    const pFrameH = playerBaseTex.height / pRows;
    for (let y = 0; y < pRows; y++) {
        for (let x = 0; x < pCols; x++) {
            const rect = new PIXI.Rectangle(x * pFrameW, y * pFrameH, pFrameW, pFrameH);
            playerTextures.push(new PIXI.Texture({ source: playerBaseTex.source, frame: rect }));
        }
    }
    initPlayerTextures(playerTextures, playerMaskData);

    const baseTexture = await PIXI.Assets.load(shipImg);
    const textures: PIXI.Texture[] = [];
    const cols = 10, rows = 10;
    const frameW = baseTexture.width / cols;
    const frameH = baseTexture.height / rows;
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const rect = new PIXI.Rectangle(x * frameW, y * frameH, frameW, frameH);
            textures.push(new PIXI.Texture({ source: baseTexture.source, frame: rect }));
        }
    }
    initEnemyTextures(textures);

    const bossBase = await PIXI.Assets.load(bossImg);
    const bossTextures: PIXI.Texture[] = [];
    const bCols = 5, bRows = 5;
    const bFrameW = bossBase.width / bCols;
    const bFrameH = bossBase.height / bRows;
    for (let y = 0; y < bRows; y++) {
        for (let x = 0; x < bCols; x++) {
            const rect = new PIXI.Rectangle(x * bFrameW, y * bFrameH, bFrameW, bFrameH);
            bossTextures.push(new PIXI.Texture({ source: bossBase.source, frame: rect }));
        }
    }
    initBossTextures(bossTextures);
}