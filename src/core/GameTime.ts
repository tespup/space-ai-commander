// ФАЙЛ: src/core/GameTime.ts
import { FRAME_MS } from './TimeUtils';

export const time = {
    ms: FRAME_MS,
    f: 1,
};

export function setStep(ms: number) {
    const safe = Math.max(0, ms);
    time.ms = safe;
    time.f = safe / FRAME_MS;
}

type SchedulerTask = {
    left: number;
    fn: () => void;
};

const tasks: SchedulerTask[] = [];

export const gameScheduler = {
    after(ms: number, fn: () => void) {
        tasks.push({ left: Math.max(0, ms), fn });
    },

    update(dt: number) {
        if (dt <= 0 || tasks.length === 0) return;

        let i = tasks.length - 1;
        while (i >= 0) {
            const task = tasks[i];
            if (!task) {
                i--;
                continue;
            }

            task.left -= dt;
            if (task.left <= 0) {
                tasks.splice(i, 1);
                task.fn();
                i = Math.min(i, tasks.length - 1);
            } else {
                i--;
            }
        }
    },

    clear() {
        tasks.length = 0;
    },
};