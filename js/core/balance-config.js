"use strict";

/**
 * Role-budget + TTK balance helpers.
 * Laser nose (no affinity/upgrades) = 1.0 Power. Combat configs stay authoritative;
 * this module validates and prices against the same formula.
 */
class BalanceConfigManager {
    constructor() {
        this.REF_DAMAGE = 10;
        this.REF_COOLDOWN = 250;
        this.REF_BULLETS = 1;
        this.REF_EDPS = this.REF_DAMAGE * this.REF_BULLETS * (1000 / this.REF_COOLDOWN); // 40

        this.ROLE_HIT_RATE = {
            sustained: 1,
            rapid: 1,
            coverage: 0.65,
            heavy: 0.8,
            pierce: 1
        };

        /** Target power (expected DPS / REF) before hull/faction affinity. */
        this.ROLE_POWER = {
            sustained: 1,
            rapid: 1.05,
            coverage: 0.7,
            heavy: 0.85,
            pierce: 0.9
        };

        this.WEAPON_ROLE = {
            laser: 'sustained',
            laser_twin: 'sustained',
            wave: 'sustained',
            rapid: 'rapid',
            claw_beam: 'rapid',
            spread: 'coverage',
            burst: 'coverage',
            ion: 'coverage',
            spike_burst: 'coverage',
            nova: 'coverage',
            plasma: 'heavy',
            missile: 'heavy',
            pierce: 'pierce',
            railgun: 'pierce'
        };

        /** Mid-game laser nose, no modules — seconds. */
        this.TTK = {
            side: { min: 1.5, max: 2.5, target: 2 },
            champion: { min: 4, max: 6, target: 5 },
            boss: { min: 18, max: 25, target: 22 }
        };

        this.DIFFICULTY_MUL = {
            easy: { enemyHealth: 0.8, enemyDamage: 0.7, playerDamage: 1.15 },
            normal: { enemyHealth: 1, enemyDamage: 1, playerDamage: 1 },
            hard: { enemyHealth: 1.25, enemyDamage: 1.3, playerDamage: 0.9 }
        };

        /** Regular-stage healthMult targets along ramp 0→2 (first / mid / last). */
        this.STAGE_HEALTH = { first: 0.85, mid: 1.05, last: 1.25 };
        this.STAGE_SPEED = { first: 0.9, mid: 1, last: 1.1 };
        this.BOSS_HEALTH_MULT = 2.2;

        /** Shop material buckets by weapon power. */
        this.SHOP_POWER_BUCKETS = [
            { max: 0.85, cost: { scrap: 70, ore: 28 } },
            { max: 1, cost: { scrap: 110, ore: 42, crystal: 12 } },
            { max: 1.15, cost: { scrap: 160, ore: 60, crystal: 28 } },
            { max: 1.35, cost: { scrap: 210, ore: 85, crystal: 40, voltex: 12 } },
            { max: Infinity, cost: { scrap: 260, ore: 100, crystal: 55, voltex: 22 } }
        ];
    }

    getWeaponRole(weaponId) {
        return this.WEAPON_ROLE[String(weaponId || '').toLowerCase()] || 'sustained';
    }

    getHitRate(weaponId, cfg) {
        const role = this.getWeaponRole(weaponId || (cfg && cfg.id));
        return this.ROLE_HIT_RATE[role] != null ? this.ROLE_HIT_RATE[role] : 1;
    }

    volleyDps(cfg) {
        const dmg = Math.max(0, Number((cfg && cfg.damage) || 0));
        const count = Math.max(1, Math.round(Number((cfg && cfg.bulletCount) || 1)));
        const cd = Math.max(50, Number((cfg && cfg.cooldown) || 300));
        return dmg * count * (1000 / cd);
    }

    computeWeaponPower(cfg, weaponId) {
        const id = String(weaponId || (cfg && cfg.id) || 'laser').toLowerCase();
        const hit = this.getHitRate(id, cfg);
        const eDps = this.volleyDps(cfg) * hit;
        let power = eDps / this.REF_EDPS;
        // Pierce: listed power is single-target; multi-hit credit is design-only.
        if (cfg && cfg.pierce && this.getWeaponRole(id) === 'pierce') {
            power = Math.min(power * 1.15, 1.25);
        }
        return Math.round(power * 1000) / 1000;
    }

    suggestedEnergyCost(power, role) {
        const p = Math.max(0.5, Number(power) || 1);
        const mul = role === 'rapid' ? 1.8 : (role === 'heavy' || role === 'pierce' ? 1.25 : 1);
        return Math.max(3, Math.round(4 * p * mul));
    }

    shopBucketForPower(power) {
        const p = Number(power) || 1;
        for (let i = 0; i < this.SHOP_POWER_BUCKETS.length; i++) {
            if (p <= this.SHOP_POWER_BUCKETS[i].max) {
                return { tier: i + 1, cost: Object.assign({}, this.SHOP_POWER_BUCKETS[i].cost) };
            }
        }
        const last = this.SHOP_POWER_BUCKETS[this.SHOP_POWER_BUCKETS.length - 1];
        return { tier: this.SHOP_POWER_BUCKETS.length, cost: Object.assign({}, last.cost) };
    }

    targetHp(role, refEdps) {
        const band = this.TTK[role] || this.TTK.champion;
        const dps = Math.max(1, Number(refEdps) || this.REF_EDPS);
        return Math.round(dps * band.target);
    }

    assertWeaponBudgets(getWeaponFn) {
        const get = getWeaponFn || (typeof weaponConfigManager !== 'undefined'
            ? (id) => weaponConfigManager.getWeapon(id)
            : null);
        if (!get) return [];
        const warnings = [];
        Object.keys(this.WEAPON_ROLE).forEach((id) => {
            const w = get(id);
            if (!w) return;
            const role = this.WEAPON_ROLE[id];
            const power = this.computeWeaponPower(w, id);
            const target = this.ROLE_POWER[role];
            const slack = role === 'coverage' ? 0.2 : 0.12;
            if (Math.abs(power - target) > slack) {
                warnings.push({ id, role, power, target });
            }
        });
        return warnings;
    }
}

const balanceConfigManager = new BalanceConfigManager();
window.balanceConfigManager = balanceConfigManager;
