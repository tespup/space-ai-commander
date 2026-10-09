import * as PIXI from 'pixi.js';
import { app } from '../core/Renderer';
import { playBoomSound } from '../core/AssetLoader';

interface Particle {
    gfx: PIXI.Container; 
    vx: number;
    vy: number;
    life: number;
    scaleSpeed: number;
    alphaSpeed: number;
}

const particles: Particle[] = [];

export function spawnThrusterFire(x: number, y: number) {
    const colors = [0xffaa00, 0xff5500, 0xff2200];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const fire = new PIXI.Graphics().circle(0, 0, 2 + Math.random() * 2).fill(color);
    fire.x = x + (Math.random() * 2 - 1);
    fire.y = y;
    app.stage.addChildAt(fire, 0);
    particles.push({ gfx: fire, vx: 0, vy: 2 + Math.random() * 2, life: 10, scaleSpeed: 0.8, alphaSpeed: 0.1 });
}

export function spawnWingTrail(x: number, y: number) {
    const length = 10 + Math.random() * 8;
    const trail = new PIXI.Graphics().rect(-0.5, 0, 1, length).fill({ color: 0xffffff, alpha: 0.5 });
    trail.x = x;
    trail.y = y;
    app.stage.addChildAt(trail, 0);
    particles.push({ gfx: trail, vx: 0, vy: 5 + Math.random() * 3, life: 12, scaleSpeed: 0.95, alphaSpeed: 0.05 });
}

export function spawnEnemyTrail(x: number, y: number, outerColor: number, innerColor: number) {
    const radius = 4 + Math.random() * 3;

    const trail = new PIXI.Graphics();
    
    trail.circle(0, 0, radius).fill({ color: outerColor, alpha: 0.8 });
    trail.circle(0, 0, radius * 0.4).fill({ color: innerColor, alpha: 1.0 });

    trail.x = x + (Math.random() * 8 - 4);
    trail.y = y + (Math.random() * 8 - 4);
    
    trail.zIndex = 0; 
    app.stage.addChild(trail); 
    
    particles.push({ gfx: trail, vx: 0, vy: -1.5, life: 250, scaleSpeed: 0.985, alphaSpeed: 0.008 });
}

export function spawnFloatingText(text: string, x: number, y: number, color: number) {
    const txt = new PIXI.Text({ text, style: { fill: color, fontSize: 18, fontWeight: 'bold' } });
    txt.x = x;
    txt.y = y;
    txt.anchor.set(0.5);
    app.stage.addChild(txt);
    particles.push({ gfx: txt, vx: 0, vy: -1.0, life: 80, scaleSpeed: 1, alphaSpeed: 0.0125 });
}

export function spawnMuzzleFlash(x: number, y: number) {
    const flash = new PIXI.Graphics().circle(0, 0, 8).fill(0xffffbb);
    flash.x = x;
    flash.y = y;
    app.stage.addChild(flash);
    particles.push({ gfx: flash, vx: 0, vy: -1, life: 5, scaleSpeed: 0.8, alphaSpeed: 0.2 });
}

export function spawnHitImpact(x: number, y: number) {
    for (let i = 0; i < 5; i++) {
        const gfx = new PIXI.Graphics().circle(0, 0, 2).fill(0xffaa00);
        gfx.x = x;
        gfx.y = y;
        app.stage.addChild(gfx);
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 3;
        particles.push({ gfx, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 15, scaleSpeed: 0.9, alphaSpeed: 0.1 });
    }
}

export function spawnExplosion(x: number, y: number, scaleMult: number = 1, rotation: number = 0) {
    playBoomSound();
    
    const blast = new PIXI.Graphics().circle(0, 0, 15 * scaleMult).fill(0xff5500);
    blast.x = x; 
    blast.y = y;
    app.stage.addChild(blast);
    particles.push({ gfx: blast, vx: 0, vy: 0, life: 20, scaleSpeed: 1.1, alphaSpeed: 0.05 });

    for(let j = 0; j < 2; j++) {
        const miniBlast = new PIXI.Graphics().circle(0, 0, 8 * scaleMult).fill(0xffaa00);
        miniBlast.x = x + (Math.random() * 20 - 10) * scaleMult;
        miniBlast.y = y + (Math.random() * 20 - 10) * scaleMult;
        app.stage.addChild(miniBlast);
        particles.push({ gfx: miniBlast, vx: 0, vy: 0, life: 15, scaleSpeed: 1.05, alphaSpeed: 0.06 });
    }

    for (let i = 0; i < 8; i++) {
        const gfx = new PIXI.Graphics().poly([-3,-3, 3,-3, 0,4]).fill(0xffaa00);
        gfx.rotation = rotation + Math.random() * Math.PI; 
        gfx.scale.set(scaleMult);
        gfx.x = x; 
        gfx.y = y;
        app.stage.addChild(gfx);
        
        const angle = rotation + Math.random() * Math.PI * 2;
        const speed = (4 + Math.random() * 4) * scaleMult;
        particles.push({ gfx, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 30, scaleSpeed: 0.95, alphaSpeed: 0.03 });
    }
}

export function spawnFirework(x: number, y: number) {
    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xffffff];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    for (let i = 0; i < 80; i++) {
        const gfx = new PIXI.Graphics().circle(0, 0, 3 + Math.random() * 3).fill(color);
        gfx.x = x;
        gfx.y = y;
        gfx.blendMode = 'add'; 
        app.stage.addChild(gfx);
        
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 8;
        particles.push({ gfx, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 50 + Math.random() * 40, scaleSpeed: 0.95, alphaSpeed: 0.015 });
    }
}

export function spawnMenuDust() {
    const x = Math.random() * app.screen.width;
    const y = app.screen.height + 20;
    const size = 0.5 + Math.random() * 1.5;
    const dust = new PIXI.Graphics().circle(0, 0, size).fill({ color: 0x00f2ff, alpha: 0.4 });
    dust.x = x;
    dust.y = y;
    dust.zIndex = 5; 
    app.stage.addChild(dust);
    particles.push({ gfx: dust, vx: (Math.random() - 0.5) * 0.3, vy: -0.2 - Math.random() * 0.5, life: 400, scaleSpeed: 1, alphaSpeed: 0.001 });
}

export function updateVFX() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.gfx.x += p.vx;
        p.gfx.y += p.vy;
        p.gfx.scale.set(p.gfx.scale.x * p.scaleSpeed, p.gfx.scale.y * p.scaleSpeed);
        p.gfx.alpha -= p.alphaSpeed;
        p.life--;

        if (p.life <= 0 || p.gfx.alpha <= 0) {
            app.stage.removeChild(p.gfx);
            p.gfx.destroy();
            particles.splice(i, 1);
        }
    }
}