// ФАЙЛ: src/core/Textures.ts
// Общие запечённые текстуры и пулы спрайтов.
// Форма/цвет/альфа совпадают с прежними PIXI.Graphics — вид не меняется.
import * as PIXI from 'pixi.js';

const textures = new Map<string, PIXI.Texture>();
const pools = new Map<string, PIXI.Sprite[]>();

let renderer: PIXI.Renderer | null = null;

export function initTextureFactory(app: PIXI.Application) {
    renderer = app.renderer;
}

function bake(key: string, draw: (g: PIXI.Graphics) => void): PIXI.Texture {
    let tex = textures.get(key);
    if (tex) return tex;
    const g = new PIXI.Graphics();
    draw(g);
    tex = renderer!.generateTexture({ target: g, resolution: 2 });
    g.destroy();
    textures.set(key, tex);
    return tex;
}

// Белая окружность r=8 — тонируется под нужный цвет (масштаб = radius/8)
export function texCircle8(): PIXI.Texture {
    return bake('circle8', g => g.circle(0, 0, 8).fill(0xffffff));
}
// Белая окружность r=8 с запечённой альфой (для пыли меню — точно как прежний fill alpha)
export function texCircle8Alpha(a: number): PIXI.Texture {
    return bake('circle8a' + a, g => g.circle(0, 0, 8).fill({ color: 0xffffff, alpha: a }));
}
// Белая окружность r=32 — для крупных взрывов (масштаб = radius/32)
export function texCircle32(): PIXI.Texture {
    return bake('circle32', g => g.circle(0, 0, 32).fill(0xffffff));
}
// Треугольник осколка взрыва (как прежде: [-3,-3, 3,-3, 0,4])
export function texShard(): PIXI.Texture {
    return bake('shard', g => g.poly([-3, -3, 3, -3, 0, 4]).fill(0xffffff));
}
// Белый прямоугольник-«полоска» 1×16, якорь сверху по центру (scaleY = len/16)
export function texBar(): PIXI.Texture {
    return bake('bar', g => g.rect(-0.5, 0, 1, 16).fill({ color: 0xffffff, alpha: 0.5 }));
}
// Звёздная пыль: ядро r=1 + свечение r=3.25 (единый масштаб)
export function texDust(): PIXI.Texture {
    return bake('dust', g => {
        g.circle(0, 0, 3.25).fill({ color: 0x00f2ff, alpha: 0.15 });
        g.circle(0, 0, 1).fill({ color: 0xffffff, alpha: 0.8 });
    });
}
// Ромб призрачного трейла (s=1): [0,-2, 1,0, 0,2, -1,0], альфа 0.2
export function texGhost(): PIXI.Texture {
    return bake('ghost', g => g.poly([0, -2, 1, 0, 0, 2, -1, 0]).fill({ color: 0xffffff, alpha: 0.2 }));
}
// Трейл врага: внешнее кольцо r=10 a0.8 + ядро r=4 a1 (масштаб = radius/10)
export function texPair(outer: number, inner: number): PIXI.Texture {
    return bake(`et-${outer}-${inner}`, g => {
        g.circle(0, 0, 10).fill({ color: outer, alpha: 0.8 });
        g.circle(0, 0, 4).fill({ color: inner, alpha: 1.0 });
    });
}
// Пуля врага: круг r=4
export function texEnemyBullet(): PIXI.Texture {
    return bake('ebullet', g => g.circle(0, 0, 4).fill(0xffaa00));
}
// Пуля босса: прямоугольник 4×20
export function texEnemyBulletBoss(): PIXI.Texture {
    return bake('ebulletBoss', g => g.rect(-2, -10, 4, 20).fill(0xff0000));
}

// Забрать спрайт из пула (не добавляет на сцену). Ключ пула — строка key.
export function acquire(tex: PIXI.Texture, key: string, anchorY = 0.5): PIXI.Sprite {
    const pool = pools.get(key);
    let sprite = pool?.pop();
    if (!sprite) {
        sprite = new PIXI.Sprite(tex);
    } else if (sprite.texture !== tex) {
        sprite.texture = tex;
    }
    sprite.alpha = 1;
    sprite.tint = 0xffffff;
    sprite.rotation = 0;
    sprite.scale.set(1);
    sprite.zIndex = 0;
    sprite.blendMode = 'normal';
    if (anchorY === 0.5) sprite.anchor.set(0.5);
    else sprite.anchor.set(0.5, anchorY);
    (sprite as any)._texKey = key;
    return sprite;
}

export function release(sprite: PIXI.Sprite) {
    sprite.parent?.removeChild(sprite);
    const key: string = (sprite as any)._texKey;
    const pool = pools.get(key);
    if (pool) {
        if (pool.length < 96) pool.push(sprite);
        else sprite.destroy();
    } else {
        sprite.destroy();
    }
}
