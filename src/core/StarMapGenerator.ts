// ФАЙЛ: src/core/StarMapGenerator.ts

export type NodeType = 'normal' | 'boss';
export type NodeState = 'locked' | 'available' | 'current';

export interface StarNode {
    id: string;
    row: number;
    col: number;
    type: NodeType;
    state: NodeState;
    completed: boolean;
    x: number;
    y: number;
    levelIndex: number;
}

export interface StarMapData {
    difficulty: 'easy' | 'normal' | 'hard';
    nodes: StarNode[];
    currentNodeId: string;
}

function getColsForDifficulty(difficulty: string): number {
    switch (difficulty) {
        case 'easy': return 7;
        case 'normal': return 5;
        case 'hard': return 3;
        default: return 5;
    }
}

// === ПРОВЕРКА БОСС-РЯДА ===
// Сетка: 4 обычных ряда + 1 босс-ряд = 5 рядов.
// Босс на рядах: 4, 9, 14, 19...
function isBossRow(row: number): boolean {
    return row > 0 && row % 5 === 4;
}

// === РАСЧЁТ ЭТАЖА ПО РЯДУ ===
// Ряды 0-4 = этаж 1
// Ряды 5-9 = этаж 2
// Ряды 10-14 = этаж 3 и так далее
export function getNodeFloor(row: number): number {
    if (!Number.isFinite(row) || row < 0) {
        return 1;
    }
    return Math.floor(row / 5) + 1;
}

export function generateStarMap(
    difficulty: 'easy' | 'normal' | 'hard',
    startRow: number = 0,
    existingNodes?: StarNode[]
): StarMapData {
    const cols = getColsForDifficulty(difficulty);
    const nodes: StarNode[] = existingNodes ? [...existingNodes] : [];

    const maxExistingRow = nodes.length > 0
        ? Math.max(...nodes.map(n => n.row))
        : -1;

    let nextLevelIndex = 1;
    if (nodes.length > 0) {
        nextLevelIndex = Math.max(...nodes.map(n => n.levelIndex)) + 1;
    }

    // Генерация стартового ряда 0 (только если узлов ещё нет)
    if (nodes.length === 0) {
        for (let col = 0; col < cols; col++) {
            const isStart = col === Math.floor(cols / 2);
            nodes.push({
                id: `0-${col}`,
                row: 0,
                col,
                type: 'normal',
                state: isStart ? 'current' : 'locked',
                completed: isStart,
                x: 0,
                y: 0,
                levelIndex: isStart ? nextLevelIndex++ : 0,
            });
        }
        for (const node of nodes) {
            if (node.levelIndex === 0) {
                node.levelIndex = nextLevelIndex++;
            }
        }
    }

    // ИСПРАВЛЕНО: лимит генерации привязан к максимальному существующему ряду,
    // а не к startRow. Это позволяет бесконечно расширять карту.
    const baseRow = Math.max(maxExistingRow, startRow);
    const maxRowToGenerate = baseRow + 12;

    for (let row = maxExistingRow + 1; row <= maxRowToGenerate; row++) {
        if (isBossRow(row)) {
            const bossCol = Math.floor(cols / 2);
            nodes.push({
                id: `${row}-${bossCol}`,
                row,
                col: bossCol,
                type: 'boss',
                state: 'locked',
                completed: false,
                x: 0,
                y: 0,
                levelIndex: nextLevelIndex++,
            });
        } else {
            for (let col = 0; col < cols; col++) {
                nodes.push({
                    id: `${row}-${col}`,
                    row,
                    col,
                    type: 'normal',
                    state: 'locked',
                    completed: false,
                    x: 0,
                    y: 0,
                    levelIndex: nextLevelIndex++,
                });
            }
        }
    }

    const uniqueNodes = nodes.filter(
        (node, index, self) => index === self.findIndex(n => n.id === node.id)
    );

    return {
        difficulty,
        nodes: uniqueNodes,
        currentNodeId: uniqueNodes.find(n => n.state === 'current')?.id || uniqueNodes[0]?.id,
    };
}

// === НОВАЯ ФУНКЦИЯ: РАСШИРЕНИЕ КАРТЫ ===
// Вызывается когда игрок приближается к концу сгенерированных рядов.
// Добавляет новые ряды вперёд, сохраняя все существующие узлы.
export function extendStarMap(mapData: StarMapData): StarMapData {
    if (!mapData || mapData.nodes.length === 0) return mapData;

    const cols = getColsForDifficulty(mapData.difficulty);
    const maxExistingRow = Math.max(...mapData.nodes.map(n => n.row));
    let nextLevelIndex = Math.max(...mapData.nodes.map(n => n.levelIndex)) + 1;

    const newNodes: StarNode[] = [...mapData.nodes];
    const maxRowToGenerate = maxExistingRow + 12;

    for (let row = maxExistingRow + 1; row <= maxRowToGenerate; row++) {
        if (isBossRow(row)) {
            const bossCol = Math.floor(cols / 2);
            newNodes.push({
                id: `${row}-${bossCol}`,
                row,
                col: bossCol,
                type: 'boss',
                state: 'locked',
                completed: false,
                x: 0,
                y: 0,
                levelIndex: nextLevelIndex++,
            });
        } else {
            for (let col = 0; col < cols; col++) {
                newNodes.push({
                    id: `${row}-${col}`,
                    row,
                    col,
                    type: 'normal',
                    state: 'locked',
                    completed: false,
                    x: 0,
                    y: 0,
                    levelIndex: nextLevelIndex++,
                });
            }
        }
    }

    return {
        difficulty: mapData.difficulty,
        nodes: newNodes,
        currentNodeId: mapData.currentNodeId,
    };
}

export function openAdjacentNodes(mapData: StarMapData, nodeId: string): StarMapData {
    const node = mapData.nodes.find(n => n.id === nodeId);
    if (!node) return mapData;

    const cols = getColsForDifficulty(mapData.difficulty);
    const bossCol = Math.floor(cols / 2);

    const directions: { dr: number; dc: number }[] = [
        { dr: 1, dc: 0 },
        { dr: 0, dc: -1 },
        { dr: 0, dc: 1 },
    ];

    directions.forEach(({ dr, dc }) => {
        const newRow = node.row + dr;
        const newCol = node.col + dc;
        if (newRow < 0) return;

        let target: StarNode | undefined;
        if (isBossRow(newRow)) {
            if (newCol === bossCol) {
                target = mapData.nodes.find(n => n.row === newRow && n.col === bossCol);
            }
        } else {
            target = mapData.nodes.find(n => n.row === newRow && n.col === newCol);
        }

        if (target && target.state === 'locked') {
            target.state = 'available';
        }
    });

    return mapData;
}

export function completeCurrentNode(mapData: StarMapData, nodeId: string): StarMapData {
    const node = mapData.nodes.find(n => n.id === nodeId);
    if (!node) return mapData;

    node.completed = true;
    return openAdjacentNodes(mapData, nodeId);
}