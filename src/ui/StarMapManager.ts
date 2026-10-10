// ФАЙЛ: src/ui/StarMapManager.ts

import { showScreen } from './ScreenManager';
import {
    generateStarMap,
    extendStarMap,
    openAdjacentNodes,
    completeCurrentNode as markNodeCompleted,
    getNodeFloor,
    StarMapData,
    StarNode,
} from '../core/StarMapGenerator';
import { query } from 'bitecs';
import { world } from '../core/world';
import { Player } from '../components/Player';
import { Attributes } from '../components/Attributes';
import { Health } from '../components/Health';
import {
    startLevel,
    setLevel,
    setBossLevel,
    setCombatTier,
    getBossesDefeated,
    getCurrentCombatTier,
    loseLife,
    getPlayerLives,
    completedLevelCount,
    setCompletedLevelCount
} from '../core/LevelManager';
import { playerImageSrc } from '../core/AssetLoader';

let mapData: StarMapData | null = null;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let shipImage: HTMLImageElement | null = null;
let selectedShipIndex: number = parseInt(localStorage.getItem('space_ai_ship_index') || '0');

const CANVAS_W = 390;
const CANVAS_H = 600;
const NODE_RADIUS = 22;
const CELL_SIZE = 90;

const EXTEND_THRESHOLD = 3;

let cameraX = 0;
let cameraY = 0;
let targetCameraX = 0;
let targetCameraY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragCamStartX = 0;
let dragCamStartY = 0;
const RETURN_SPEED = 0.08;

let moveAnim: {
    from: { x: number; y: number };
    to: { x: number; y: number };
    progress: number;
    shipX: number;
    shipY: number;
} | null = null;

let pulseTime = 0;
let animFrameId: number | null = null;
let previousNodeId: string | null = null;
let stars: { x: number; y: number; size: number; speed: number }[] = [];
let pendingBattleNode: StarNode | null = null;
let autoBattleGameOverPending = false;

function generateStars() {
    stars = [];
    for (let i = 0; i < 150; i++) {
        stars.push({
            x: Math.random() * CANVAS_W,
            y: Math.random() * CANVAS_H,
            size: 0.4 + Math.random() * 1.5,
            speed: 0.2 + Math.random() * 0.8,
        });
    }
}

function openAllAdjacentNodes(node: StarNode) {
    if (!mapData) return;
    const dirs = [
        [1, 0],
        [-1, 0],
        [0, -1],
        [0, 1]
    ];
    for (const [dr, dc] of dirs) {
        const neighbor = mapData.nodes.find(
            n => n.row === node.row + dr && n.col === node.col + dc
        );
        if (neighbor && neighbor.state === 'locked') {
            neighbor.state = 'available';
        }
    }
}

function checkAndExtendMap() {
    if (!mapData || mapData.nodes.length === 0) return;

    const currentNode = mapData.nodes.find(n => n.state === 'current');
    if (!currentNode) return;

    const maxRow = Math.max(...mapData.nodes.map(n => n.row));
    const rowsAhead = maxRow - currentNode.row;

    if (rowsAhead <= EXTEND_THRESHOLD) {
        mapData = extendStarMap(mapData);
        openAllAdjacentNodes(currentNode);
    }
}

function getPlayerInfo() {
    const players = query(world, [Player]);
    if (players.length > 0) {
        const p = players[0];
        return {
            credits: Math.floor(Attributes.credits[p] || 0),
            hp: Health.value[p],
            maxHp: Health.max[p],
        };
    }
    return { credits: 0, hp: 100, maxHp: 100 };
}

function updateInfoPanel() {
    if (!mapData) return;
    const info = getPlayerInfo();
    const mapFloor = document.getElementById('map-floor');
    const mapCredits = document.getElementById('map-credits');
    const mapHp = document.getElementById('map-hp');
    const mapLives = document.getElementById('map-lives');

    const current = mapData.nodes.find(n => n.state === 'current');
    const floor = current ? getNodeFloor(current.row) : 1;

    if (mapFloor) mapFloor.innerText = floor.toString();
    if (mapCredits) mapCredits.innerText = info.credits.toString();
    if (mapHp) mapHp.innerText = `${Math.floor(info.hp)}/${Math.floor(info.maxHp)}`;
    if (mapLives) mapLives.innerText = getPlayerLives().toString();
}

export function initStarMap(difficulty: 'easy' | 'normal' | 'hard') {
    mapData = generateStarMap(difficulty);
    if (mapData.nodes.length > 0) {
        const startNode = mapData.nodes.find(n => n.state === 'current') || mapData.nodes[0];
        openAdjacentNodes(mapData, startNode.id);
        openAllAdjacentNodes(startNode);
    }
    resetCameraToCurrent();
    showStarMap();
}

export function loadStarMap(savedMap: StarMapData) {
    mapData = savedMap;
    const current = mapData.nodes.find(n => n.state === 'current');
    if (current) openAllAdjacentNodes(current);

    checkAndExtendMap();

    resetCameraToCurrent();
    showStarMap();
}

export function getMapData(): StarMapData | null {
    return mapData;
}

export function completeCurrentNode() {
    if (!mapData) return;

    const currentNode = mapData.nodes.find(n => n.state === 'current');
    if (currentNode) {
        markNodeCompleted(mapData, currentNode.id);
        openAllAdjacentNodes(currentNode);
        previousNodeId = null;
    }

    checkAndExtendMap();

    resetCameraToCurrent();
    showStarMap();
}

export function revertCurrentNode() {
    if (!mapData || !previousNodeId) return;
    const current = mapData.nodes.find(n => n.state === 'current');
    const previous = mapData.nodes.find(n => n.id === previousNodeId);
    if (current && previous) {
        current.state = 'available';
        current.completed = false;
        previous.state = 'current';
    }
    previousNodeId = null;
    resetCameraToCurrent();
}

function resetCameraToCurrent() {
    if (!mapData) return;
    const current = mapData.nodes.find(n => n.state === 'current');
    if (current) {
        targetCameraX = -current.x;
        targetCameraY = -current.y;
        cameraX = targetCameraX;
        cameraY = targetCameraY;
    }
}

function worldToScreen(wx: number, wy: number): { sx: number; sy: number } {
    return {
        sx: wx + cameraX + CANVAS_W / 2,
        sy: wy + cameraY + CANVAS_H / 2,
    };
}

function layoutNodes() {
    if (!mapData) return;
    const nodes = mapData.nodes;
    if (nodes.length === 0) return;

    const maxCol = Math.max(...nodes.map(n => n.col)) + 1;
    const maxRow = Math.max(...nodes.map(n => n.row)) + 1;
    const offsetX = CELL_SIZE;
    const offsetY = CELL_SIZE;

    nodes.forEach(node => {
        if (node.type === 'boss') {
            node.x = ((maxCol - 1) / 2) * CELL_SIZE + offsetX;
        } else {
            node.x = node.col * CELL_SIZE + offsetX;
        }
        node.y = (maxRow - 1 - node.row) * CELL_SIZE + offsetY;
    });
}

function drawStarMap() {
    if (!ctx || !mapData) return;
    const context = ctx;
    const data = mapData;
    const w = CANVAS_W;
    const h = CANVAS_H;

    context.clearRect(0, 0, w, h);

    const bgGrad = context.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, 400);
    bgGrad.addColorStop(0, '#0a1020');
    bgGrad.addColorStop(1, '#01030a');
    context.fillStyle = bgGrad;
    context.fillRect(0, 0, w, h);

    for (const star of stars) {
        const alpha = 0.5 + 0.5 * Math.sin(pulseTime * 0.001 * star.speed);
        context.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
        context.beginPath();
        context.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        context.fill();
    }

    context.lineWidth = 2;
    context.strokeStyle = '#0ff';
    context.shadowColor = '#0ff';
    context.shadowBlur = 6;
    context.beginPath();

    data.nodes.forEach(node => {
        const neighbors = [
            data.nodes.find(n => n.row === node.row + 1 && n.col === node.col),
            data.nodes.find(n => n.row === node.row && n.col === node.col - 1),
            data.nodes.find(n => n.row === node.row && n.col === node.col + 1),
        ].filter(Boolean) as StarNode[];

        neighbors.forEach(neighbor => {
            const p1 = worldToScreen(node.x, node.y);
            const p2 = worldToScreen(neighbor.x, neighbor.y);
            context.moveTo(p1.sx, p1.sy);
            context.lineTo(p2.sx, p2.sy);
        });
    });

    context.stroke();
    context.shadowColor = 'transparent';
    context.shadowBlur = 0;

    const current = data.nodes.find(n => n.state === 'current');

    data.nodes.forEach(node => {
        const { sx, sy } = worldToScreen(node.x, node.y);

        if (
            sx < -NODE_RADIUS ||
            sx > w + NODE_RADIUS ||
            sy < -NODE_RADIUS ||
            sy > h + NODE_RADIUS
        ) {
            return;
        }

        let fillColor: string;
        let glowColor: string;
        let strokeColor = '#fff';

        if (node.completed) {
            fillColor = '#4a5568';
            glowColor = 'rgba(74,85,104,0.5)';
            strokeColor = '#5a6578';
        } else if (node.state === 'current') {
            fillColor = '#00ff88';
            glowColor = 'rgba(0,255,136,0.9)';
        } else if (node.state === 'available') {
            fillColor = node.type === 'boss' ? '#ff3366' : '#00ffff';
            glowColor = node.type === 'boss'
                ? 'rgba(255,51,102,0.8)'
                : 'rgba(0,255,255,0.8)';
        } else {
            fillColor = '#00e5ff';
            strokeColor = '#00e5ff';
            glowColor = 'rgba(0,229,255,0.4)';
        }

        let r = NODE_RADIUS;
        if (node.state === 'current' && !node.completed) {
            r *= 1 + 0.15 * Math.sin(pulseTime * 0.01);
        } else if (node.state === 'available' && !node.completed) {
            r *= 1 + 0.1 * Math.sin(pulseTime * 0.015 + node.col);
        }

        context.beginPath();
        context.arc(sx, sy, r, 0, Math.PI * 2);
        context.shadowColor = glowColor;
        context.shadowBlur =
            (node.state === 'available' && !node.completed)
                ? 12
                : (node.state === 'current' && !node.completed ? 16 : 6);
        context.fillStyle = fillColor;
        context.fill();
        context.shadowColor = 'transparent';
        context.shadowBlur = 0;
        context.strokeStyle = strokeColor;
        context.lineWidth = 2;
        context.stroke();

        if (node.type === 'boss' && node.state !== 'locked') {
            context.fillStyle = '#fff';
            context.font = 'bold 12px monospace';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText('BOSS', sx, sy);
        }
    });

    if (current && shipImage && shipImage.complete) {
        let drawX = current.x;
        let drawY = current.y;
        if (moveAnim) {
            drawX = moveAnim.shipX;
            drawY = moveAnim.shipY;
        }
        const { sx, sy } = worldToScreen(drawX, drawY);

        const cols = 5;
        const rows = 5;
        const frameW = shipImage.width / cols;
        const frameH = shipImage.height / rows;
        const ix = (selectedShipIndex % cols) * frameW;
        const iy = Math.floor(selectedShipIndex / cols) * frameH;
        const size = 30;

        context.shadowColor = '#00ff88';
        context.shadowBlur = 10;
        context.drawImage(
            shipImage,
            ix,
            iy,
            frameW,
            frameH,
            sx - size / 2,
            sy - size / 2,
            size,
            size
        );
        context.shadowColor = 'transparent';
        context.shadowBlur = 0;
    }

    updateInfoPanel();
}

function animateMove(
    from: { x: number; y: number },
    to: { x: number; y: number },
    onComplete: () => void
) {
    const duration = 500;
    const start = performance.now();

    moveAnim = {
        from,
        to,
        progress: 0,
        shipX: from.x,
        shipY: from.y
    };

    function step(now: number) {
        if (!moveAnim) return;
        const elapsed = now - start;
        moveAnim.progress = Math.min(elapsed / duration, 1);
        const t = moveAnim.progress < 0.5
            ? 2 * moveAnim.progress * moveAnim.progress
            : 1 - Math.pow(-2 * moveAnim.progress + 2, 2) / 2;
        moveAnim.shipX = from.x + (to.x - from.x) * t;
        moveAnim.shipY = from.y + (to.y - from.y) * t;
        if (moveAnim.progress >= 1) {
            moveAnim = null;
            onComplete();
        } else {
            requestAnimationFrame(step);
        }
    }

    requestAnimationFrame(step);
}

function showBattleChoice(node: StarNode) {
    pendingBattleNode = node;
    const overlay = document.getElementById('battle-choice-overlay');
    if (overlay) overlay.classList.remove('hidden');
}

function hideBattleChoice() {
    const overlay = document.getElementById('battle-choice-overlay');
    if (overlay) overlay.classList.add('hidden');
    pendingBattleNode = null;
}

function startStandardBattle() {
    if (!pendingBattleNode) return;
    const node = pendingBattleNode;
    hideBattleChoice();
    setLevel(node.levelIndex);
    setBossLevel(false);
    startLevel();
    resetCameraToCurrent();
}

function resolveAutoBattle() {
    if (!pendingBattleNode) return;
    const node = pendingBattleNode;
    hideBattleChoice();

    const tier = getCurrentCombatTier();
    const collisionDamage = 100 + (tier * 10);
    const roll = Math.random();
    let collisions: number;
    if (roll < 0.50) collisions = 0;
    else if (roll < 0.80) collisions = 1;
    else if (roll < 0.95) collisions = 2;
    else collisions = 3;

    const totalDamage = collisions * collisionDamage;
    const players = query(world, [Player]);
    if (players.length === 0) return;
    const p = players[0];
    const playerMaxHp = Health.max[p];
    const survived = playerMaxHp > totalDamage;

    if (survived) {
        const enemiesSimulated = 3 + Math.floor(Math.random() * 5);
        const rewardPerEnemy = Math.floor(10 * Math.pow(1.15, tier));
        const totalReward = enemiesSimulated * rewardPerEnemy;
        Attributes.credits[p] += totalReward;
        setCompletedLevelCount(completedLevelCount + 1);
        completeCurrentNode();
        showAutoBattleResult(
            tier,
            true,
            collisions,
            totalDamage,
            playerMaxHp,
            totalReward
        );
    } else {
        const isGameOver = loseLife();
        if (isGameOver) {
            showAutoBattleResult(
                tier,
                false,
                collisions,
                totalDamage,
                playerMaxHp,
                0
            );
            autoBattleGameOverPending = true;
        } else {
            revertCurrentNode();
            showStarMap();
            showAutoBattleResult(
                tier,
                false,
                collisions,
                totalDamage,
                playerMaxHp,
                0
            );
        }
    }
}

function showAutoBattleResult(
    tier: number,
    won: boolean,
    collisions: number,
    damage: number,
    maxHp: number,
    reward: number
) {
    const overlay = document.getElementById('auto-battle-result-overlay');
    const box = overlay?.querySelector('.auto-battle-result-box');
    const title = document.getElementById('auto-battle-result-title');
    const stats = document.getElementById('auto-battle-result-stats');
    if (!overlay || !box || !title || !stats) return;

    box.classList.remove('result-win', 'result-lose');
    box.classList.add(won ? 'result-win' : 'result-lose');
    title.classList.remove('win', 'lose');
    title.classList.add(won ? 'win' : 'lose');
    title.innerText = won ? '⚡ ПОБЕДА' : '💀 ПОРАЖЕНИЕ';

    let statsHtml = `
        <div class="stat-row">
            <span class="stat-label">Столкновений:</span>
            <span class="stat-value">${collisions} / 3</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Урон за столкновение:</span>
            <span class="stat-value">${100 + (tier * 10)}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Суммарный урон:</span>
            <span class="stat-value negative">-${damage}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">HP корабля:</span>
            <span class="stat-value">${maxHp}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Остаток HP:</span>
            <span class="stat-value ${maxHp - damage > 0 ? 'positive' : 'negative'}">
                ${maxHp - damage}
            </span>
        </div>
    `;

    if (won) {
        statsHtml += `
            <div class="stat-row">
                <span class="stat-label">Награда:</span>
                <span class="stat-value gold">+${reward} 💰</span>
            </div>
        `;
    } else {
        statsHtml += `
            <div class="stat-row">
                <span class="stat-label">Жизней осталось:</span>
                <span class="stat-value negative">${getPlayerLives()} ❤️</span>
            </div>
        `;
    }

    stats.innerHTML = statsHtml;
    overlay.classList.remove('hidden');
}

function hideAutoBattleResult() {
    const overlay = document.getElementById('auto-battle-result-overlay');
    if (overlay) overlay.classList.add('hidden');
    if (autoBattleGameOverPending) {
        autoBattleGameOverPending = false;
        showScreen('game-over-screen');
    }
}

export {
    showBattleChoice,
    hideBattleChoice,
    startStandardBattle,
    resolveAutoBattle,
    hideAutoBattleResult
};

export function showStarMap() {
    canvas = document.getElementById('star-map-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    ctx = canvas.getContext('2d')!;

    if (!shipImage) {
        shipImage = new Image();
        shipImage.src = playerImageSrc;
    }

    if (stars.length === 0) generateStars();

    const bg = document.getElementById('menu-bg');
    if (bg) bg.classList.add('active');

    layoutNodes();
    resetCameraToCurrent();
    pulseTime = 0;

    if (animFrameId !== null) cancelAnimationFrame(animFrameId);

    function animLoop() {
        if (!mapData || !canvas) {
            animFrameId = null;
            return;
        }
        pulseTime += 16;
        cameraX += (targetCameraX - cameraX) * RETURN_SPEED;
        cameraY += (targetCameraY - cameraY) * RETURN_SPEED;
        drawStarMap();
        animFrameId = requestAnimationFrame(animLoop);
    }

    animFrameId = requestAnimationFrame(animLoop);
    showScreen('star-map-screen');
}

// === ВЫНОСИМ ЛОГИКУ КЛИКА В ОТДЕЛЬНУЮ ФУНКЦИЮ ===
function handleNodeClick(pos: {x: number, y: number}) {
    if (!mapData) return;
    
    const worldX = pos.x - cameraX - CANVAS_W / 2;
    const worldY = pos.y - cameraY - CANVAS_H / 2;

    const clickedNode = mapData.nodes.find(node => {
        const dx = worldX - node.x;
        const dy = worldY - node.y;
        return Math.sqrt(dx * dx + dy * dy) <= NODE_RADIUS + 8;
    });

    if (!clickedNode) return;

    const current = mapData.nodes.find(n => n.state === 'current');
    if (!current || current.id === clickedNode.id) return;
    if (clickedNode.state === 'locked') return;

    if (!clickedNode.completed) {
        previousNodeId = current.id;
        current.completed = true;
        current.state = 'available';
        clickedNode.state = 'current';

        const nodeTier = getNodeFloor(clickedNode.row) - 1;
        const battleTier = Math.max(getBossesDefeated(), nodeTier);
        setCombatTier(battleTier);

        animateMove(
            { x: current.x, y: current.y },
            { x: clickedNode.x, y: clickedNode.y },
            () => {
                if (clickedNode.type === 'boss') {
                    setLevel(clickedNode.levelIndex);
                    setBossLevel(true);
                    startLevel();
                    resetCameraToCurrent();
                } else {
                    showBattleChoice(clickedNode);
                }
            }
        );
    } else if (clickedNode.completed) {
        previousNodeId = null;
        current.completed = true;
        current.state = 'available';
        clickedNode.state = 'current';

        animateMove(
            { x: current.x, y: current.y },
            { x: clickedNode.x, y: clickedNode.y },
            () => {
                openAllAdjacentNodes(clickedNode);
                resetCameraToCurrent();
            }
        );
    }
}

export function initStarMapEvents() {
    canvas = document.getElementById('star-map-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const getClickPos = (e: MouseEvent | Touch) => {
        const rect = canvas!.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (CANVAS_W / rect.width),
            y: (e.clientY - rect.top) * (CANVAS_H / rect.height),
        };
    };

    let isTap = false; // Флаг для определения тапа на мобильных

    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dragCamStartX = cameraX;
        dragCamStartY = cameraY;
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        targetCameraX = dragCamStartX + dx;
        targetCameraY = dragCamStartY + dy;
        cameraX = targetCameraX;
        cameraY = targetCameraY;
    });

    canvas.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        if (mapData) {
            const cur = mapData.nodes.find(n => n.state === 'current');
            if (cur) {
                targetCameraX = -cur.x;
                targetCameraY = -cur.y;
            }
        }
    });

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Блокирует стандартный click
        const touch = e.touches[0];
        isDragging = true;
        isTap = true; // Изначально считаем, что это тап
        dragStartX = touch.clientX;
        dragStartY = touch.clientY;
        dragCamStartX = cameraX;
        dragCamStartY = cameraY;
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!isDragging) return;
        const touch = e.touches[0];
        const dx = touch.clientX - dragStartX;
        const dy = touch.clientY - dragStartY;
        
        // Если палец сдвинулся больше чем на 5 пикселей, это свайп, а не тап
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            isTap = false;
        }

        targetCameraX = dragCamStartX + dx;
        targetCameraY = dragCamStartY + dy;
        cameraX = targetCameraX;
        cameraY = targetCameraY;
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        isDragging = false;
        
        // === РУЧНАЯ ОБРАБОТКА ТАПА ДЛЯ МОБИЛЬНЫХ ===
        if (isTap && mapData && canvas) {
            const touch = e.changedTouches[0];
            const pos = getClickPos(touch);
            handleNodeClick(pos);
        }

        if (mapData) {
            const cur = mapData.nodes.find(n => n.state === 'current');
            if (cur) {
                targetCameraX = -cur.x;
                targetCameraY = -cur.y;
            }
        }
    });

    canvas.addEventListener('click', (e) => {
        if (!mapData || !canvas) return;

        if (
            Math.abs(cameraX - targetCameraX) > 5 ||
            Math.abs(cameraY - targetCameraY) > 5
        ) {
            return;
        }

        const pos = getClickPos(e);
        handleNodeClick(pos);
    });
}