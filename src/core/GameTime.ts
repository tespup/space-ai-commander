// ФАЙЛ: src/core/GameTime.ts

export const time = {
    ms: 16.667,   // длительность текущего шага симуляции в мс
    f: 1          // то же в "кадрах по 60 FPS" = ms / 16.667
};

export function setStep(ms: number) {
    time.ms = ms;
    time.f = ms / 16.667;
}

type Task = {
    left: number;
    fn: () => void;
};

const tasks: Task[] = [];

export const gameScheduler = {
    after(ms: number, fn: () => void) {
        tasks.push({ left: ms, fn });
    },

    update(dt: number) {
        for (let i = tasks.length - 1; i >= 0; i--) {
            const task = tasks[i];
            if (!task) continue;

            task.left -= dt;

            if (task.left <= 0) {
                tasks.splice(i, 1);
                task.fn();
            }
        }
    },

    clear() {
        tasks.length = 0;
    }
};