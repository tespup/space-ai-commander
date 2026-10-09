// src/ui/LibraryManager.ts
import * as PIXI from 'pixi.js';

export class LibraryManager {
    private container: PIXI.Container;
    private app: PIXI.Application;

    constructor(app: PIXI.Application) {
        this.app = app;
        this.container = new PIXI.Container();
        this.container.visible = false;
        this.app.stage.addChild(this.container);
    }

    public show() {
        this.container.removeChildren();
        this.drawBackground();
        this.drawShipGrid();
        this.container.visible = true;
    }

    public hide() {
        this.container.visible = false;
    }

    private drawBackground() {
        const bg = new PIXI.Graphics();
        bg.rect(0, 0, this.app.screen.width, this.app.screen.height);
        bg.fill(0x000000);
        this.container.addChild(bg);
    }

    private drawShipGrid() {
        const cols = 5;
        const ships = this.getLibraryShips();
        const rows = Math.ceil(ships.length / cols);
        const spacingX = this.app.screen.width / cols;
        const spacingY = this.app.screen.height / (rows + 1);

        for (let i = 0; i < ships.length; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = col * spacingX + spacingX / 2;
            const y = (row + 0.5) * spacingY;

            const ship = this.createShipDesign(ships[i]);
            ship.x = x;
            ship.y = y;

            const label = new PIXI.Text({
                text: `#${i + 1}`,
                style: { fill: 0xffffff, fontSize: 14, fontWeight: 'bold' }
            });
            label.x = x - 18;
            label.y = y + 35;

            this.container.addChild(ship);
            this.container.addChild(label);
        }
    }

    private getLibraryShips() {
        // Дизайн, скопированный из кастинга #24 (Циклон)
        return [
            {
                color: 0x3498db,      // цвет из CastingManager для индекса 24
                design: 'cyclone'
            }
        ];
    }

    private createShipDesign(ship: { color: number; design: string }): PIXI.Graphics {
        const g = new PIXI.Graphics();
        const color = ship.color;

        // Копия дизайна из CastingManager, case 24: "Циклон"
        for (let a = 0; a < 3; a++) {
            const rad = a * 120 * Math.PI / 180;
            const x = Math.cos(rad) * 22;
            const y = Math.sin(rad) * 22;
            g.poly([
                x, y,
                x + 10 * Math.cos(rad + 0.5), y + 10 * Math.sin(rad + 0.5),
                x - 6 * Math.cos(rad), y - 6 * Math.sin(rad)
            ]).fill(color);
        }
        g.circle(0, 0, 12).fill(0xffffff); // центральный круг

        return g;
    }
}