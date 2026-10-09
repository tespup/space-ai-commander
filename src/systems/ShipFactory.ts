import * as PIXI from 'pixi.js';

export function drawShipDesign(g: PIXI.Graphics, id: number) {
    g.clear();
    switch (id) {
        case 1: g.poly([-10, 10, 0, -15, 10, 10]).fill(0x00f2ff); break;
        case 2: g.poly([0, -15, 12, 12, -12, 12]).fill(0x00f2ff); g.rect(-12, 8, 24, 2).fill(0x00aaff); break;
        case 3: g.circle(0, 0, 10).fill(0x00f2ff); g.rect(-15, -2, 30, 4).fill(0x00aaff); break;
        case 4: g.poly([-15, 5, 0, -20, 15, 5, 0, 15]).fill(0x00f2ff); break;
        case 5: g.rect(-10, -10, 20, 20).stroke({ color: 0x00f2ff, width: 2 }); g.circle(0,0,4).fill(0xffffff); break;
        case 6: g.poly([0, -18, 15, 15, 0, 5, -15, 15]).fill(0x00f2ff); break;
        case 7: g.poly([-15, 0, 0, -20, 15, 0, 0, 20]).fill(0x00aaff); break;
        case 8: g.rect(-2, -15, 4, 30).fill(0xffffff); g.rect(-12, -5, 24, 4).fill(0x00f2ff); break;
        case 9: g.circle(0, 0, 8).stroke({ color: 0x00f2ff, width: 3 }); break;
        case 10: g.poly([-10, 15, -10, -15, 15, 0]).fill(0x00f2ff); break;
        case 11: g.poly([0, -15, 15, 15, -15, 15]).stroke({ color: 0x00f2ff, width: 2 }); break;
        case 12: g.rect(-12, -12, 24, 24).fill(0x004466); g.rect(-6, -6, 12, 12).fill(0x00f2ff); break;
    }
}