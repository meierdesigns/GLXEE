"use strict";

// ShipLoadoutManager methods, split from ship-loadout.js.
extendClass(ShipLoadoutManager, {
    /**
     * Hangar power budget: GEN vs IDLE DRAW.
     */
    /**
     * Physical weapon mounts of a loadout: slot 0 = nose (one gun), slot 1+
     * = wing pairs (the same weapon on both wings = two guns).
     */
    weaponMounts(loadout) {
        const slots = (loadout.weaponSlots && loadout.weaponSlots.length ? loadout.weaponSlots : loadout.weapons) || [];
        const out = [];
        slots.forEach((id, i) => {
            if (!id) return;
            if (i === 0) out.push({ id: id, mount: 'front' });
            else out.push({ id: id, mount: 'wing' }, { id: id, mount: 'wing' });
        });
        return out;
    },

    computePowerBudget(loadout) {
        const L = this.normalizeLoadout(loadout);
        const energyStatsBase = (() => {
            const hasCore = (L.energy || []).some((id) => this.isEnergyId(id));
            let regenBonus = 0;
            if (typeof profileManager !== 'undefined' && profileManager.getModuleUpgradeBonuses) {
                regenBonus = Math.max(0, Number(profileManager.getModuleUpgradeBonuses().energyRegenBonus) || 0);
            }
            return {
                hasCore: hasCore,
                gen: hasCore ? (12 + regenBonus) : 0
            };
        })();
        const perModule = [];
        let idleDraw = 0;
        const add = (kind, id) => {
            const idle = this.getModuleIdleDraw(kind, id);
            if (idle <= 0 && kind === 'energy') return;
            perModule.push({ id: id, kind: kind, idle: idle });
            idleDraw += idle;
        };
        // Every weapon mount draws power: the nose gun once, a wing pair
        // twice (one gun per wing). More weapons → more drain.
        this.weaponMounts(L).forEach((m) => add('weapon', m.id));
        (L.defenses || []).forEach((id) => add('defense', id));
        (L.abilities || []).forEach((id) => add('ability', id));
        let drainMul = 1;
        if (typeof profileManager !== 'undefined' && profileManager.getModuleUpgradeBonuses) {
            drainMul = Math.max(0.4, Number(profileManager.getModuleUpgradeBonuses().energyDrainMul) || 1);
        }
        idleDraw *= drainMul;
        perModule.forEach((m) => { m.idle = Math.round(m.idle * drainMul * 100) / 100; });
        const gen = energyStatsBase.gen;
        return {
            gen: gen,
            idleDraw: Math.round(idleDraw * 100) / 100,
            net: Math.round((gen - idleDraw) * 100) / 100,
            perModule: perModule,
            hasCore: energyStatsBase.hasCore
        };
    },

    /**
     * Charge-module combat stats from equipped ability/defense ids.
     */
    computeChargeStats(ids) {
        const list = Array.isArray(ids) ? ids : [];
        const has = (id) => list.indexOf(id) !== -1;
        const weaponCharge = has('charge_shot');
        const overcharge = has('overcharge_core');
        const shieldSync = has('charge_shield_sync');
        const shieldDivert = has('shield_divert');
        const driveCharge = has('charge_drive');
        const driveDampen = has('drive_charge_dampen');

        let focus = 0;
        let output = 0;
        if (typeof profileManager !== 'undefined' && profileManager.getModuleUpgradeBonuses) {
            const b = profileManager.getModuleUpgradeBonuses();
            focus = Math.max(0, Number(b.chargeFocus) || 0);
            output = Math.max(0, Number(b.chargeOutput) || 0);
        }

        let maxChargeMs = overcharge && weaponCharge ? 700 : 900;
        maxChargeMs = Math.max(500, Math.round(maxChargeMs * (1 - focus * 0.12)));

        let maxChargeMult = overcharge && weaponCharge ? 3.5 : 2.75;
        maxChargeMult += output * 0.18;
        let divertShotBonus = shieldDivert ? 0.55 : 0;
        divertShotBonus += shieldDivert ? output * 0.12 : 0;
        let shieldFillPerSec = shieldSync ? 18 : 0;
        shieldFillPerSec *= (1 + output * 0.2);

        // Hold-Shift boost (no charge/burst/slowdown)
        let driveBoostMul = driveCharge ? 1.55 : 1;
        driveBoostMul += driveCharge ? output * 0.05 : 0;
        let driveBoostDrainPerSec = driveCharge ? 22 : 0;
        if (driveCharge && driveDampen) driveBoostDrainPerSec *= 0.7;

        return {
            weaponCharge: weaponCharge,
            overcharge: overcharge && weaponCharge,
            shieldSync: shieldSync && !shieldDivert,
            shieldDivert: shieldDivert && !shieldSync,
            driveCharge: driveCharge,
            driveDampen: driveDampen && driveCharge,
            maxChargeMs: maxChargeMs,
            minChargeMult: 1,
            maxChargeMult: maxChargeMult,
            divertShotBonus: divertShotBonus,
            shieldFillPerSec: shieldFillPerSec,
            driveBoostMul: driveBoostMul,
            driveBoostDrainPerSec: driveBoostDrainPerSec,
            driveSlowMul: 1,
            driveFullSlowMul: 1,
            driveBurstMul: 1,
            driveBurstMs: 0
        };
    },

    /**
     * Inventory pools for hangar equip UI.
     */
    getInventory(shipId) {
        const defaults = this.defaultLoadoutFromShip(shipId);
        const owned = {
            weapons: defaults.weapons.slice(),
            defenses: defaults.defenses.slice(),
            abilities: defaults.abilities.filter((id) => !this.isEnergyId(id)),
            energy: defaults.energy.slice()
        };
        const add = (arr, id) => {
            if (id && arr.indexOf(id) === -1) arr.push(id);
        };
        if (typeof profileManager !== 'undefined' && profileManager.hasActiveProfile()) {
            const profile = profileManager.getActiveProfile();
            profileManager.ensureEconomyDefaults(profile);
            profileManager.getDiscovered('weapons').forEach((id) => add(owned.weapons, id));
            profileManager.getDiscovered('defenses').forEach((id) => add(owned.defenses, id));
            profileManager.getDiscovered('abilities').forEach((id) => {
                if (this.isEnergyId(id)) add(owned.energy, id);
                else if (this.isDefenseId(id)) add(owned.defenses, id);
                else add(owned.abilities, id);
            });
            profileManager.getDiscovered('energy').forEach((id) => add(owned.energy, id));
            Object.keys((profile.parts && profile.parts.weapons) || {}).forEach((id) => {
                if ((profile.parts.weapons[id] || 0) > 0) add(owned.weapons, id);
            });
            Object.keys((profile.parts && profile.parts.defenses) || {}).forEach((id) => {
                if ((profile.parts.defenses[id] || 0) > 0) add(owned.defenses, id);
            });
            Object.keys((profile.parts && profile.parts.abilities) || {}).forEach((id) => {
                if ((profile.parts.abilities[id] || 0) > 0) {
                    if (this.isEnergyId(id)) add(owned.energy, id);
                    else if (this.isDefenseId(id)) add(owned.defenses, id);
                    else add(owned.abilities, id);
                }
            });
            Object.keys((profile.parts && profile.parts.energy) || {}).forEach((id) => {
                if ((profile.parts.energy[id] || 0) > 0) add(owned.energy, id);
            });
            const current = this.getLoadout(shipId);
            current.weapons.forEach((id) => add(owned.weapons, id));
            current.defenses.forEach((id) => add(owned.defenses, id));
            current.abilities.forEach((id) => add(owned.abilities, id));
            (current.energy || []).forEach((id) => add(owned.energy, id));
        }
        add(owned.energy, 'energy_core');
        return owned;
    },

    canInstallModule(shipId, kind, moduleId) {
        const L = this.getLoadout(shipId);
        const key = kind === 'weapon' ? 'weapons'
            : kind === 'defense' ? 'defenses'
                : kind === 'energy' ? 'energy'
                    : 'abilities';
        const id = String(moduleId || '');
        if (!id) return { ok: false, reason: 'INVALID' };
        if (L[key].indexOf(id) !== -1) return { ok: true, removing: true };
        if (id === 'overcharge_core' && L.abilities.indexOf('charge_shot') === -1) {
            return { ok: false, reason: 'NEED_CHARGE_SHOT' };
        }
        if (id === 'drive_charge_dampen' && L.abilities.indexOf('charge_drive') === -1) {
            return { ok: false, reason: 'NEED_CHARGE_DRIVE' };
        }
        const caps = this.getSlotCaps(shipId, this.resolveModelClass(shipId));
        if (L[key].length >= caps[key]) {
            return { ok: false, reason: 'FULL', caps: caps };
        }
        return { ok: true, removing: false, caps: caps };
    },

    toggleModule(shipId, kind, moduleId) {
        const L = this.getLoadout(shipId);
        const key = kind === 'weapon' ? 'weapons'
            : kind === 'defense' ? 'defenses'
                : kind === 'energy' ? 'energy'
                    : 'abilities';
        const id = String(moduleId || '');
        if (!id) return L;
        const idx = L[key].indexOf(id);
        if (idx === -1) {
            const check = this.canInstallModule(shipId, kind, id);
            if (!check.ok) return L;
            L[key].push(id);
            if (id === 'charge_shield_sync') {
                const di = L.defenses.indexOf('shield_divert');
                if (di !== -1) L.defenses.splice(di, 1);
            } else if (id === 'shield_divert') {
                const si = L.defenses.indexOf('charge_shield_sync');
                if (si !== -1) L.defenses.splice(si, 1);
            }
        } else {
            L[key].splice(idx, 1);
            if (id === 'charge_shot') {
                const oi = L.abilities.indexOf('overcharge_core');
                if (oi !== -1) L.abilities.splice(oi, 1);
            }
            if (id === 'charge_drive') {
                const di = L.abilities.indexOf('drive_charge_dampen');
                if (di !== -1) L.abilities.splice(di, 1);
            }
        }
        if (key === 'weapons' && !L.weapons.length) {
            L.weapons.push(id);
        }
        L.fireMode = L.abilities.indexOf('charge_shot') !== -1 ? 'charge' : 'auto';
        return this.setLoadout(shipId, L);
    },

    kindToLoadoutKey(kind) {
        if (kind === 'weapon') return 'weapons';
        if (kind === 'defense') return 'defenses';
        if (kind === 'energy') return 'energy';
        return 'abilities';
    },

    categoryLabel(kind) {
        if (kind === 'weapon') return 'WEAPON';
        if (kind === 'defense') return 'DEFENSE';
        if (kind === 'energy') return 'ENERGY';
        return 'ABILITY';
    },
});
