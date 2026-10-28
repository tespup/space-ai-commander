// ФАЙЛ: src/systems/AbilitySystem.ts
import { query } from 'bitecs';
import { Player } from '../components/Player';
import { Abilities } from '../components/Abilities';
import { Attributes } from '../components/Attributes';
import { Health } from '../components/Health';
import { world } from '../core/world';
import { bossesDefeated, currentLevelIsBoss } from '../core/LevelManager';

const BASE_COSTS = {
    armor: 30,
    shield: 50,
    pierce: 10,
    rapid: 20,
    ram: 25,
    rockets: 40
};

const ABILITY_DURATIONS: Record<string, number> = {
    armor: 10000,
    shield: 5000,
    pierce: 5000,
    rapid: 5000,
    ram: 1,        // ПРАВКА 1: не используется как таймер, управляется MovementSystem
    rockets: 5000
};

let isArmorHpDoubled = false;

function getAbilityCost(type: keyof typeof BASE_COSTS): number {
    return Math.floor(BASE_COSTS[type] * Math.pow(1.5, bossesDefeated));
}

export function useAbility(type: 'armor' | 'shield' | 'pierce' | 'rapid' | 'ram' | 'rockets') {
    const players = query(world, [Player, Attributes, Abilities, Health]);
    if (players.length === 0) return;
    const pid = players[0];
    const cost = getAbilityCost(type);

    if (Attributes.credits[pid] >= cost) {
        if (type === 'armor' && Abilities.armorTimer[pid] <= 0) {
            Attributes.credits[pid] -= cost;
            Abilities.armorTimer[pid] = ABILITY_DURATIONS.armor;
            if (!isArmorHpDoubled) {
                const baseMax = 150 + (Attributes.armor[pid] || 0) * 15;
                Health.max[pid] = baseMax * 2;
                Health.value[pid] += baseMax;
                isArmorHpDoubled = true;
            }
        }
        else if (type === 'shield' && Abilities.shieldTimer[pid] <= 0) {
            Attributes.credits[pid] -= cost;
            Abilities.shieldTimer[pid] = ABILITY_DURATIONS.shield;
        }
        else if (type === 'pierce' && Abilities.pierceTimer[pid] <= 0) {
            Attributes.credits[pid] -= cost;
            Abilities.pierceTimer[pid] = ABILITY_DURATIONS.pierce;
        }
        else if (type === 'rapid' && Abilities.rapidTimer[pid] <= 0) {
            Attributes.credits[pid] -= cost;
            Abilities.rapidTimer[pid] = ABILITY_DURATIONS.rapid;
        }
        else if (type === 'ram' && Abilities.ramTimer[pid] <= 0) {
            if (currentLevelIsBoss) return;
            Attributes.credits[pid] -= cost;
            Abilities.ramTimer[pid] = 1; // ПРАВКА 1: флаг, не таймер
        }
        else if (type === 'rockets' && Abilities.rocketsTimer[pid] <= 0) {
            Attributes.credits[pid] -= cost;
            Abilities.rocketsTimer[pid] = ABILITY_DURATIONS.rockets;
        }
    }
}

export function abilitySystem(deltaMS: number) {
    const players = query(world, [Player, Attributes, Abilities, Health]);
    if (players.length === 0) return;
    const pid = players[0];

    if (Abilities.armorTimer[pid] > 0) {
        Abilities.armorTimer[pid] -= deltaMS;
        if (Abilities.armorTimer[pid] <= 0 && isArmorHpDoubled) {
            const baseMax = 150 + (Attributes.armor[pid] || 0) * 15;
            Health.max[pid] = baseMax;
            Health.value[pid] = Math.min(Health.value[pid], baseMax);
            isArmorHpDoubled = false;
        }
    }
    if (Abilities.shieldTimer[pid] > 0) Abilities.shieldTimer[pid] -= deltaMS;
    if (Abilities.pierceTimer[pid] > 0) Abilities.pierceTimer[pid] -= deltaMS;
    if (Abilities.rapidTimer[pid] > 0) Abilities.rapidTimer[pid] -= deltaMS;
    // ПРАВКА 1: ramTimer НЕ уменьшается здесь — им управляет MovementSystem
    if (Abilities.rocketsTimer[pid] > 0) Abilities.rocketsTimer[pid] -= deltaMS;
}

// HUD обновляем один раз за кадр (см. GameLoop), а не на каждый подшаг логики
export function updateAbilityHud() {
    const players = query(world, [Player, Attributes, Abilities, Health]);
    if (players.length === 0) return;
    const pid = players[0];

    const credits = Attributes.credits[pid] || 0;

    updateAbilityBtn('btn-ab-armor', 'ab-cnt-armor', 'ab-cost-armor', 'ab-timer-armor',
        credits, 'armor', Abilities.armorTimer[pid]);
    updateAbilityBtn('btn-ab-shield', 'ab-cnt-shield', 'ab-cost-shield', 'ab-timer-shield',
        credits, 'shield', Abilities.shieldTimer[pid]);
    updateAbilityBtn('btn-ab-pierce', 'ab-cnt-pierce', 'ab-cost-pierce', 'ab-timer-pierce',
        credits, 'pierce', Abilities.pierceTimer[pid]);
    updateAbilityBtn('btn-ab-rapid', 'ab-cnt-rapid', 'ab-cost-rapid', 'ab-timer-rapid',
        credits, 'rapid', Abilities.rapidTimer[pid]);
    updateAbilityBtn('btn-ab-ram', 'ab-cnt-ram', 'ab-cost-ram', 'ab-timer-ram',
        credits, 'ram', Abilities.ramTimer[pid]);
    updateAbilityBtn('btn-ab-rockets', 'ab-cnt-rockets', 'ab-cost-rockets', 'ab-timer-rockets',
        credits, 'rockets', Abilities.rocketsTimer[pid]);

    const hudScore = document.getElementById('hud-score');
    if (hudScore) hudScore.textContent = credits.toString();
    const levelScore = document.getElementById('level-credit-count');
    if (levelScore) levelScore.textContent = credits.toString();
}

interface BtnUICache {
    cnt: string; cost: string; timer: string;
    active: boolean; disabled: boolean;
}
const btnCache = new Map<string, BtnUICache>();

function updateAbilityBtn(
    btnId: string, cntId: string, costId: string, timerId: string,
    credits: number, type: keyof typeof BASE_COSTS, timer: number
) {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    let cache = btnCache.get(btnId);
    if (!cache) {
        cache = { cnt: '', cost: '', timer: '', active: false, disabled: false };
        btnCache.set(btnId, cache);
    }

    const cost = getAbilityCost(type);
    const count = Math.floor(credits / cost);
    const duration = ABILITY_DURATIONS[type];
    const isActive = timer > 0;
    const canAfford = credits >= cost;

    const countStr = count.toString();
    if (countStr !== cache.cnt) {
        cache.cnt = countStr;
        const cnt = document.getElementById(cntId);
        if (cnt) cnt.textContent = countStr;
    }
    const costStr = cost.toString();
    if (costStr !== cache.cost) {
        cache.cost = costStr;
        const costEl = document.getElementById(costId);
        if (costEl) costEl.textContent = costStr;
    }

    if (isActive !== cache.active) {
        cache.active = isActive;
        btn.classList.toggle('active', isActive);
    }

    let disabled: boolean;
    if (type === 'ram' && currentLevelIsBoss) disabled = true;
    else disabled = !isActive && !canAfford;
    if (disabled !== cache.disabled) {
        cache.disabled = disabled;
        if (disabled) btn.classList.add('disabled');
        else btn.classList.remove('disabled');
    }

    const timerEl = document.getElementById(timerId);
    if (timerEl) {
        let timerStr: string;
        if (isActive && duration > 1) {
            const pct = Math.round(Math.max(0, Math.min(100, (timer / duration) * 100)));
            timerStr = pct + '%';
        } else if (isActive) {
            timerStr = '100%';
        } else {
            timerStr = '0%';
        }
        if (timerStr !== cache.timer) {
            cache.timer = timerStr;
            timerEl.style.setProperty('--timer-pct', timerStr);
        }
    }
}