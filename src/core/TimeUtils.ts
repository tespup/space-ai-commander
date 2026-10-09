// ФАЙЛ: src/core/TimeUtils.ts
// Единые утилиты времени для перевода игры с кадров на реальное время (deltaTime).

export const FRAME_MS = 1000 / 60; // 16.6666667 ms — длительность одного кадра при 60 FPS

/**
 * Ограничивает максимальный скачок времени, чтобы при лагах/сворачивании вкладки
 * игра не «прокручивала» несколько секунд симуляции за один тик.
 * Максимум 50 мс = эквивалент 20 FPS.
 */
export function clampDeltaMS(deltaMS: number): number {
  return Math.min(deltaMS, 50);
}

/**
 * Конвертирует миллисекунды в «количество кадров при 60 FPS».
 * Используется для умножения скоростей и коэффициентов, которые раньше
 * применялись за каждый кадр.
 *
 * Пример:
 *   Раньше:  position.x += 5;          (5 пикселей за кадр)
 *   Теперь:  position.x += 5 * frameFromDeltaMS(deltaMS);
 */
export function frameFromDeltaMS(deltaMS: number): number {
  return deltaMS / FRAME_MS;
}

/**
 * Конвертирует «кадровое» затухание (например, 0.95 за кадр) в корректный
 * множитель для произвольного дельта-времени.
 *
 * Пример:
 *   Раньше:  velocity *= 0.95;
 *   Теперь:  velocity *= dampPerFrame(0.95, deltaFrames);
 */
export function dampPerFrame(base: number, deltaFrames: number): number {
  return Math.pow(base, deltaFrames);
}

/**
 * Конвертирует «кадровое» экспоненциальное приближение (например, ×0.05 за кадр)
 * в корректный коэффициент для произвольного дельта-времени.
 *
 * Пример:
 *   Раньше:  current += (target - current) * 0.05;
 *   Теперь:  current += (target - current) * lerpPerFrame(0.05, deltaFrames);
 */
export function lerpPerFrame(rate: number, deltaFrames: number): number {
  return 1 - Math.pow(1 - rate, deltaFrames);
}