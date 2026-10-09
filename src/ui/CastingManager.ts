// src/ui/CastingManager.ts
import * as PIXI from 'pixi.js';

export class CastingManager {
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
        const rows = 6;
        const spacingX = this.app.screen.width / cols;
        const spacingY = this.app.screen.height / (rows + 1);

        for (let i = 1; i <= cols * rows; i++) {
            const col = (i - 1) % cols;
            const row = Math.floor((i - 1) / cols);
            const x = col * spacingX + spacingX / 2;
            const y = (row + 0.5) * spacingY;

            const ship = this.createShipDesign(i);
            ship.x = x;
            ship.y = y;

            const label = new PIXI.Text({
                text: `#${i}`,
                style: { fill: 0xffffff, fontSize: 14, fontWeight: 'bold' }
            });
            label.x = x - 18;
            label.y = y + 35;

            this.container.addChild(ship);
            this.container.addChild(label);
        }
    }

    private createShipDesign(index: number): PIXI.Graphics {
        const g = new PIXI.Graphics();
        const color = this.getShipColor(index);
        const accent = 0xccccdd;

        switch (index) {
            case 1: // "Молот" – широкий корпус, два двигателя
                g.rect(-28, -12, 56, 24).fill(color);
                g.poly([-28, -12, -38, 0, -28, 12]).fill(accent);
                g.poly([28, -12, 38, 0, 28, 12]).fill(accent);
                break;
            case 2: // "Стрела" – узкий ромб с хвостовым оперением
                g.poly([0, -36, 16, -14, 28, 0, 16, 14, 0, 32, -16, 14, -28, 0, -16, -14]).fill(color);
                g.poly([-8, -12, 0, -20, 8, -12]).fill(accent);
                g.poly([-8, 12, 0, 20, 8, 12]).fill(accent);
                break;
            case 3: // "Коготь" – изогнутые крылья
                g.poly([0, -30, 20, -12, 30, 0, 20, 12, 0, 28, -20, 12, -30, 0, -20, -12]).fill(color);
                g.poly([-14, -6, -20, 0, -14, 6]).fill(accent);
                g.poly([14, -6, 20, 0, 14, 6]).fill(accent);
                break;
            case 4: // "Страж" – прямоугольный с башней
                g.rect(-24, -10, 48, 20).fill(color);
                g.rect(-8, -20, 16, 40).fill(0x88aaff);
                g.circle(0, -6, 6).fill(0x5588aa);
                break;
            case 5: // "Скарабей" – овальный с рогами
                g.ellipse(0, 0, 28, 16).fill(color);
                g.poly([-20, -8, -28, 0, -20, 8]).fill(accent);
                g.poly([20, -8, 28, 0, 20, 8]).fill(accent);
                break;
            case 6: // "Клинок" – треугольный, острый
                g.poly([0, -38, 18, -14, 30, 0, 18, 14, 0, 34, -18, 14, -30, 0, -18, -14]).fill(color);
                g.rect(-6, -8, 12, 16).fill(0xffaa66);
                break;
            case 7: // "Торпеда" – цилиндрический с головкой
                g.rect(-12, -30, 24, 60).fill(color);
                g.poly([-12, -30, 0, -42, 12, -30]).fill(accent);
                g.circle(0, 20, 8).fill(0xcc8866);
                break;
            case 8: // "Кобра" – расширяющийся капюшон
                g.poly([0, -34, 18, -16, 28, -4, 28, 8, 0, 28, -28, 8, -28, -4, -18, -16]).fill(color);
                g.rect(-5, -10, 10, 20).fill(0x88ffaa);
                break;
            case 9: // "Штурмовик" – два крыла в стороны
                g.rect(-26, -12, 52, 24).fill(color);
                g.poly([-26, -12, -36, 0, -26, 12]).fill(accent);
                g.poly([26, -12, 36, 0, 26, 12]).fill(accent);
                g.rect(-10, -22, 20, 44).fill(0x88aaff);
                break;
            case 10: // "Кречет" – два изогнутых крыла вверх
                g.poly([0, -32, 20, -14, 30, -2, 30, 8, 0, 28, -30, 8, -30, -2, -20, -14]).fill(color);
                g.circle(0, -4, 8).fill(0xffaa66);
                break;
            case 11: // "Буран" – широкое крыло-дельта
                g.poly([0, -34, 26, -10, 34, 0, 26, 10, 0, 30, -26, 10, -34, 0, -26, -10]).fill(color);
                g.ellipse(0, -2, 12, 6).fill(0x99ccff);
                break;
            case 12: // "Жало" – длинный с иглой
                g.poly([0, -42, 12, -22, 22, -10, 28, 0, 22, 10, 12, 22, 0, 38, -12, 22, -22, 10, -28, 0, -22, -10, -12, -22]).fill(color);
                g.circle(0, 0, 8).fill(0xff8866);
                break;
            case 13: // "Танк" – тяжёлая броня
                g.rect(-30, -12, 60, 24).fill(color);
                g.rect(-20, -20, 40, 40).fill(0x88aaff);
                g.rect(-10, -28, 20, 56).fill(0x88aaff);
                break;
            case 14: // "Фантом" – призрачный плавник
                g.ellipse(0, 0, 26, 14).fill(color);
                g.poly([-20, -8, -28, -2, -20, 4]).fill(accent);
                g.poly([20, -8, 28, -2, 20, 4]).fill(accent);
                break;
            case 15: // "Орёл" – гордый профиль
                g.poly([0, -32, 18, -12, 28, 0, 18, 12, 0, 28, -18, 12, -28, 0, -18, -12]).fill(color);
                g.poly([-10, -8, 0, -16, 10, -8]).fill(0xffaa66);
                break;
            case 16: // "Копьеносец" – с длинным носом
                g.rect(-8, -36, 16, 72).fill(color);
                g.poly([-8, -36, 0, -48, 8, -36]).fill(accent);
                g.poly([-8, 36, 0, 48, 8, 36]).fill(accent);
                break;
            case 17: // "Смерч" – три лопасти
                for (let a = 0; a < 3; a++) {
                    const rad = a * 120 * Math.PI / 180;
                    const x = Math.cos(rad) * 24;
                    const y = Math.sin(rad) * 24;
                    g.poly([x, y, x + 12 * Math.cos(rad + 0.6), y + 12 * Math.sin(rad + 0.6), x - 6 * Math.cos(rad), y - 6 * Math.sin(rad)]).fill(color);
                }
                g.circle(0, 0, 10).fill(0x88aaff);
                break;
            case 18: // "Гладиатор" – широкий с шипами
                g.poly([0, -30, 22, -10, 30, 0, 22, 10, 0, 30, -22, 10, -30, 0, -22, -10]).fill(color);
                for (let ang = 0; ang < 360; ang += 90) {
                    const rad = ang * Math.PI / 180;
                    const x = Math.cos(rad) * 28;
                    const y = Math.sin(rad) * 20;
                    g.circle(x, y, 3).fill(0xffaa66);
                }
                break;
            case 19: // "Мститель" – два вертикальных крыла
                g.rect(-12, -28, 24, 56).fill(color);
                g.poly([-12, -28, -24, -40, -12, -52]).fill(accent);
                g.poly([12, -28, 24, -40, 12, -52]).fill(accent);
                break;
            case 20: // "Дредноут" – многослойный
                g.rect(-32, -10, 64, 20).fill(color);
                g.rect(-24, -18, 48, 36).fill(0x88aaff);
                g.circle(-18, 0, 6).fill(0x666666);
                g.circle(18, 0, 6).fill(0x666666);
                break;
            case 21: // "Буревестник" – высокие крылья
                g.poly([0, -30, 18, -14, 28, -4, 28, 6, 0, 28, -28, 6, -28, -4, -18, -14]).fill(color);
                g.poly([-12, -8, -20, 0, -12, 8]).fill(accent);
                g.poly([12, -8, 20, 0, 12, 8]).fill(accent);
                break;
            case 22: // "Сокол" – с выемками
                g.poly([0, -32, 20, -12, 28, 0, 20, 12, 0, 28, -20, 12, -28, 0, -20, -12]).fill(color);
                g.circle(-12, -6, 4).fill(0xffffff);
                g.circle(12, -6, 4).fill(0xffffff);
                break;
            case 23: // "Гекса" – шестиугольник с башней
                g.poly([0, -28, 14, -14, 28, -8, 28, 8, 14, 14, 0, 28, -14, 14, -28, 8, -28, -8, -14, -14]).fill(color);
                g.circle(0, 0, 12).fill(0xffaa66);
                break;
            case 24: // "Циклон" – три крыла
                for (let a = 0; a < 3; a++) {
                    const rad = a * 120 * Math.PI / 180;
                    const x = Math.cos(rad) * 22;
                    const y = Math.sin(rad) * 22;
                    g.poly([x, y, x + 10 * Math.cos(rad + 0.5), y + 10 * Math.sin(rad + 0.5), x - 6 * Math.cos(rad), y - 6 * Math.sin(rad)]).fill(color);
                }
                g.circle(0, 0, 12).fill(0xffffff);
                break;
            case 25: // "Шип" – игольчатый с шипами
                g.poly([0, -36, 10, -20, 22, -8, 28, 0, 22, 8, 10, 20, 0, 32, -10, 20, -22, 8, -28, 0, -22, -8, -10, -20]).fill(color);
                for (let ang = 0; ang < 360; ang += 60) {
                    const rad = ang * Math.PI / 180;
                    const x = Math.cos(rad) * 18;
                    const y = Math.sin(rad) * 18;
                    g.circle(x, y, 2).fill(0xffaa66);
                }
                break;
            case 26: // "Рейдер" – с двумя носовыми клиньями
                g.poly([0, -34, 14, -18, 26, -6, 30, 0, 26, 6, 14, 18, 0, 30, -14, 18, -26, 6, -30, 0, -26, -6, -14, -18]).fill(color);
                g.poly([-6, -20, 0, -32, 6, -20]).fill(0xffaa88);
                break;
            case 27: // "Центурион" – римский шлем
                g.rect(-24, -10, 48, 20).fill(color);
                g.poly([-24, -10, -32, 0, -24, 10]).fill(accent);
                g.poly([24, -10, 32, 0, 24, 10]).fill(accent);
                g.ellipse(0, -4, 12, 6).fill(0xccaa66);
                break;
            case 28: // "Стрелец" – с луком
                g.rect(-26, -8, 52, 16).fill(color);
                g.poly([-26, -8, -36, 0, -26, 8]).fill(accent);
                g.poly([26, -8, 36, 0, 26, 8]).fill(accent);
                g.circle(0, 0, 10).fill(0xffaa66);
                break;
            case 29: // "Авангард" – передовой истребитель
                g.poly([0, -34, 16, -14, 26, -4, 30, 0, 26, 4, 16, 14, 0, 30, -16, 14, -26, 4, -30, 0, -26, -4, -16, -14]).fill(color);
                g.poly([-8, -12, 0, -20, 8, -12]).fill(0xffaa66);
                break;
            case 30: // "Зенит" – флагман, многогранник
                g.poly([0, -36, 14, -20, 28, -10, 32, 0, 28, 10, 14, 20, 0, 34, -14, 20, -28, 10, -32, 0, -28, -10, -14, -20]).fill(color);
                g.circle(0, 0, 12).fill(0xffaa66);
                g.circle(-8, -4, 3).fill(0xffffff);
                g.circle(8, -4, 3).fill(0xffffff);
                break;
            default:
                g.poly([0, -30, 20, 20, 0, 5, -20, 20]).fill(color);
        }

        return g;
    }

    private getShipColor(index: number): number {
        // Набор контрастных боевых цветов
        const colors = [
            0x5a6e7a, 0x8e5a3a, 0x4a6e3a, 0x6a4a8a, 0x3a6a8a,
            0x8a6a3a, 0x5a5a6a, 0x7a5a4a, 0x4a7a5a, 0x6a4a6a,
            0x3a7a7a, 0x7a7a3a, 0x5a4a7a, 0x4a5a7a, 0x7a5a5a,
            0x5a7a4a, 0x6a6a4a, 0x4a6a6a, 0x6a4a5a, 0x5a5a8a,
            0x8a5a6a, 0x6a8a5a, 0x5a8a6a, 0x8a6a5a, 0x6a5a8a,
            0x5a6a8a, 0x8a5a5a, 0x5a8a5a, 0x8a8a5a, 0x5a5a5a
        ];
        return colors[(index - 1) % colors.length];
    }
}