// ФАЙЛ: src/ui/HangarManager.ts
import { Attributes } from '../components/Attributes';
import { Health } from '../components/Health';
import { query } from 'bitecs';
import { world } from '../core/world';
import { Player } from '../components/Player';
import { bossesDefeated } from '../core/LevelManager';
import { showScreen } from './ScreenManager';
import { levelCompleteImages } from '../core/AssetLoader';

export function getUpgradeCost(): number {
    // ГЛОБАЛЬНАЯ цена: удваивается после каждого убитого босса НАВСЕГДА
    return 50 * Math.pow(2, bossesDefeated);
}

export function updateHangarUI(playerEid: number, level: number) {
    const val = Math.floor(Attributes.credits[playerEid] || 0).toString();
    const c1 = document.getElementById('level-credit-count');
    const c2 = document.getElementById('hud-score');
    if (c1) c1.innerText = val;
    if (c2) c2.innerText = val;

    const armorLvl = Attributes.armor[playerEid] || 0;
    const weaponsLvl = Attributes.weapons[playerEid] || 0;
    const maxHp = 150 + armorLvl * 15;
    const damage = 100 + weaponsLvl * 15;

    const armorText = document.getElementById('armor-lvl-text');
    if (armorText) armorText.innerText = `🛡️ БРОНЯ (+15 HP) [HP: ${Math.floor(maxHp)}]`;

    const weaponsText = document.getElementById('weapons-lvl-text');
    if (weaponsText) weaponsText.innerText = `💥 ОРУЖИЕ (+15 Урон) [Урон: ${damage}]`;

    const cost = getUpgradeCost();
    const btnArmor = document.getElementById('lvl-upg-armor');
    if (btnArmor) btnArmor.innerText = cost.toString();
    const btnWeapons = document.getElementById('lvl-upg-weapons');
    if (btnWeapons) btnWeapons.innerText = cost.toString();
}

export function refreshHangar() {
    const players = query(world, [Player]);
    if (players.length > 0) {
        updateHangarUI(players[0], 0);
    }
}

export function showHangarFromMap() {
    const title = document.getElementById('level-complete-title');
    if (title) {
        title.style.display = 'flex';
        title.innerHTML = `<span style="font-size: 0.6em;">АНГАР</span>`;
    }

    const img = document.getElementById('level-complete-img') as HTMLImageElement;
    if (img) {
        img.style.display = 'block';
        if (levelCompleteImages.length > 0) {
            img.src = levelCompleteImages[Math.floor(Math.random() * levelCompleteImages.length)];
        }
    }

    const panel = document.getElementById('level-upgrade-panel');
    if (panel) {
        panel.style.opacity = '1';
        panel.style.pointerEvents = 'auto';
    }

    const buttonsDiv = document.getElementById('level-complete-buttons');
    if (buttonsDiv) {
        buttonsDiv.style.display = 'flex';
        const btnSave = document.getElementById('btn-level-save');
        const btnNext = document.getElementById('btn-next-level');
        const btnExit = document.getElementById('btn-level-exit');
        if (btnSave) btnSave.style.display = 'none';
        if (btnNext) btnNext.style.display = 'none';
        if (btnExit) btnExit.style.display = 'none';
    }

    const backBtn = document.getElementById('btn-hangar-back');
    if (backBtn) backBtn.style.display = 'inline-block';

    refreshHangar();
    showScreen('level-complete-screen');
}

export function initHangar(playerEid: number, getCurrentLevelFn: () => number) {
    const tryUpgrade = (attr: keyof typeof Attributes, cost: number) => {
        if ((Attributes.credits[playerEid] || 0) >= cost) {
            Attributes.credits[playerEid] -= cost;
            (Attributes[attr] as number[])[playerEid] = ((Attributes[attr] as number[])[playerEid] || 0) + 1;

            if (attr === 'armor') {
                Health.max[playerEid] = 150 + Attributes.armor[playerEid] * 15;
                Health.value[playerEid] = Health.max[playerEid];
            }

            updateHangarUI(playerEid, getCurrentLevelFn());
        } else {
            alert("НЕДОСТАТОЧНО КРЕДИТОВ!");
        }
    };

    document.getElementById('lvl-upg-armor')?.addEventListener('click', () => tryUpgrade('armor', getUpgradeCost()));
    document.getElementById('lvl-upg-weapons')?.addEventListener('click', () => tryUpgrade('weapons', getUpgradeCost()));

    updateHangarUI(playerEid, getCurrentLevelFn());
}