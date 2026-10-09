// ФАЙЛ: src/ui/ShipSelectionManager.ts
import { showScreen } from './ScreenManager';

export function initShipSelectionUI(playerImageSrc: string, onConfirm: (difficulty: 'easy' | 'normal' | 'hard') => void) {
    let selectedShipIndex = parseInt(localStorage.getItem('space_ai_ship_index') || '0');
    let selectedDifficulty: 'easy' | 'normal' | 'hard' = 'normal';

    const screen = document.createElement('div');
    screen.id = 'ship-select-screen';
    screen.className = 'ui-screen hidden';
    screen.style.display = 'none';
    screen.style.flexDirection = 'column';
    screen.style.alignItems = 'center';
    screen.style.justifyContent = 'center';
    screen.style.background = 'linear-gradient(180deg, #001122 0%, #000000 100%)';
    screen.style.color = '#00f2ff';
    screen.style.zIndex = '300';
    screen.style.position = 'absolute';
    screen.style.top = '0';
    screen.style.left = '0';
    screen.style.width = '100%';
    screen.style.height = '100%';

    screen.innerHTML = `
        <h1 style="font-family: 'Courier New', monospace; font-size: 28px; text-shadow: 0 0 10px #00f2ff, 0 0 20px #00f2ff; margin-bottom: 40px; letter-spacing: 2px;">АНГАР</h1>
        
        <div style="position: relative; width: 160px; height: 160px; background: radial-gradient(circle, rgba(0, 242, 255, 0.15) 0%, transparent 80%); border: 2px solid rgba(0, 242, 255, 0.4); border-radius: 50%; display: flex; justify-content: center; align-items: center; box-shadow: inset 0 0 20px rgba(0, 242, 255, 0.2), 0 0 20px rgba(0, 242, 255, 0.2); overflow: hidden;">
            <div id="ship-scanner-line" style="position: absolute; top: 0; left: 0; width: 100%; height: 2px; background: rgba(0, 242, 255, 0.8); box-shadow: 0 0 10px #00f2ff;"></div>
            <canvas id="ship-preview-canvas" width="120" height="120" style="filter: drop-shadow(0 0 10px #00f2ff);"></canvas>
        </div>

        <div style="display: flex; gap: 40px; margin-top: 40px;">
            <button id="btn-ship-prev" style="display: flex; justify-content: center; align-items: center; background: rgba(0, 242, 255, 0.1); border: 1px solid #00f2ff; color: #00f2ff; font-size: 24px; width: 50px; height: 50px; border-radius: 5px; cursor: pointer; box-shadow: 0 0 10px rgba(0, 242, 255, 0.2);">◄</button>
            <button id="btn-ship-next" style="display: flex; justify-content: center; align-items: center; background: rgba(0, 242, 255, 0.1); border: 1px solid #00f2ff; color: #00f2ff; font-size: 24px; width: 50px; height: 50px; border-radius: 5px; cursor: pointer; box-shadow: 0 0 10px rgba(0, 242, 255, 0.2);">►</button>
        </div>

        <!-- Блок выбора сложности -->
        <div style="margin-top: 30px; display: flex; gap: 20px;">
            <button id="btn-diff-easy" class="diff-btn" data-diff="easy">EASY</button>
            <button id="btn-diff-normal" class="diff-btn selected" data-diff="normal">NORMAL</button>
            <button id="btn-diff-hard" class="diff-btn" data-diff="hard">HARD</button>
        </div>

        <button id="btn-ship-apply" style="margin-top: 40px; padding: 15px 40px; font-size: 16px; font-weight: bold; background: #00f2ff; color: #000; border: none; border-radius: 8px; cursor: pointer; box-shadow: 0 0 15px #00f2ff, inset 0 0 10px rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 1px;">ПОДТВЕРДИТЬ</button>
    `;

    document.getElementById('app')?.appendChild(screen);

    // Стили для кнопок сложности (добавим через JS, чтобы не менять CSS)
    const style = document.createElement('style');
    style.textContent = `
      .diff-btn {
        padding: 8px 16px;
        background: rgba(0, 242, 255, 0.1);
        border: 1px solid #00f2ff;
        color: #00f2ff;
        font-weight: bold;
        cursor: pointer;
        transition: 0.2s;
        font-size: 14px;
        border-radius: 4px;
      }
      .diff-btn.selected {
        background: #00f2ff;
        color: #000;
        box-shadow: 0 0 10px #00f2ff;
      }
    `;
    document.head.appendChild(style);

    let scanPos = 0;
    setInterval(() => {
        const line = document.getElementById('ship-scanner-line');
        if (line) {
            scanPos = (scanPos + 2) % 160;
            line.style.top = scanPos + 'px';
        }
    }, 30);

    const canvas = document.getElementById('ship-preview-canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = playerImageSrc;

    function renderPreview() {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const cols = 5;
        const rows = 5;
        const frameW = img.width / cols;
        const frameH = img.height / rows;
        
        const x = selectedShipIndex % cols;
        const y = Math.floor(selectedShipIndex / cols);

        const scale = 1.5;
        const drawW = frameW * scale;
        const drawH = frameH * scale;
        const dx = (canvas.width - drawW) / 2;
        const dy = (canvas.height - drawH) / 2;

        ctx.drawImage(img, x * frameW, y * frameH, frameW, frameH, dx, dy, drawW, drawH);
    }

    img.onload = () => renderPreview();
    
    window.addEventListener('ship-select-opened', () => {
        selectedShipIndex = parseInt(localStorage.getItem('space_ai_ship_index') || '0');
        renderPreview();
    });

    document.getElementById('btn-ship-prev')!.onclick = () => {
        selectedShipIndex = (selectedShipIndex - 1 + 25) % 25;
        renderPreview();
    };

    document.getElementById('btn-ship-next')!.onclick = () => {
        selectedShipIndex = (selectedShipIndex + 1) % 25;
        renderPreview();
    };

    // Обработчики выбора сложности
    const diffButtons = document.querySelectorAll('.diff-btn');
    diffButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            diffButtons.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedDifficulty = btn.getAttribute('data-diff') as 'easy' | 'normal' | 'hard';
        });
    });

    document.getElementById('btn-ship-apply')!.onclick = () => {
        localStorage.setItem('space_ai_ship_index', selectedShipIndex.toString());
        onConfirm(selectedDifficulty);
    };
}