export const Enemy = {
    type: [] as number[],
    startX: [] as number[],
    time: [] as number[],
    rotation: [] as number[],
    targetSpeed: [] as number[],
    speedTimer: [] as number[], 
    trailOuter: [] as number[], 
    trailInner: [] as number[],
    isBoss: [] as number[],     
    targetX: [] as number[],     
    targetY: [] as number[],     
    shootTimer: [] as number[],
    maxShots: [] as number[],    
    shotsFired: [] as number[],
    burstQueue: [] as number[],  // Очередь выстрелов для босса
    burstTimer: [] as number[]   // Таймер между выстрелами в очереди
};