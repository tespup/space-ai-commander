// ФАЙЛ: src/core/TimeUtils.ts
export const FRAME_MS = 1000 / 60; // 16.6666667 ms

export function clampDeltaMS(deltaMS: number): number {
  return Math.min(deltaMS, 50);
}

export function frameFromDeltaMS(deltaMS: number): number {
  return deltaMS / FRAME_MS;
}

export function dampPerFrame(base: number, deltaFrames: number): number {
  return Math.pow(base, deltaFrames);
}

export function lerpPerFrame(rate: number, deltaFrames: number): number {
  return 1 - Math.pow(1 - rate, deltaFrames);
}