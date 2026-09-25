"use strict";

// ShipLoadoutManager methods, split from ship-loadout.js.
extendClass(ShipLoadoutManager, {
    resolveModuleIcon(module) {
        if (!module) return null;
        if (module.kind === 'weapon') {
            if (typeof weaponConfigManager !== 'undefined') {
                const w = weaponConfigManager.getWeapon
                    ? weaponConfigManager.getWeapon(module.id)
                    : (weaponConfigManager.getConfig && weaponConfigManager.getConfig(module.id));
                if (w && w.iconKey) return w.iconKey;
            }
            const id = String(module.id || '');
            return 'shot' + id.charAt(0).toUpperCase() + id.slice(1);
        }
        if (module.kind === 'energy') {
            if (typeof abilityConfigManager !== 'undefined') {
                const a = abilityConfigManager.getAbility
                    ? abilityConfigManager.getAbility(module.id)
                    : null;
                if (a && a.icon) return a.icon;
            }
            return 'ability_energy_core';
        }
        if (typeof abilityConfigManager !== 'undefined') {
            const a = abilityConfigManager.getAbility
                ? abilityConfigManager.getAbility(module.id)
                : (abilityConfigManager.getConfig && abilityConfigManager.getConfig(module.id));
            if (a && a.icon) return a.icon;
        }
        return 'ability_' + String(module.id || '');
    },

    /** On-ship hardware graphic key (not the UI icon). */
    resolveModuleShipSprite(module) {
        if (!module) return null;
        if (module.kind === 'weapon') {
            if (typeof weaponConfigManager !== 'undefined') {
                const w = weaponConfigManager.getWeapon
                    ? weaponConfigManager.getWeapon(module.id)
                    : (weaponConfigManager.getConfig && weaponConfigManager.getConfig(module.id));
                if (w && w.mountSprite) return w.mountSprite;
            }
            return 'mount_' + String(module.id || 'weapon');
        }
        if (module.kind === 'energy') {
            if (typeof abilityConfigManager !== 'undefined') {
                const a = abilityConfigManager.getAbility
                    ? abilityConfigManager.getAbility(module.id)
                    : null;
                if (a && a.mountSprite) return a.mountSprite;
            }
            return 'mount_energy_core';
        }
        if (typeof abilityConfigManager !== 'undefined') {
            const a = abilityConfigManager.getAbility
                ? abilityConfigManager.getAbility(module.id)
                : (abilityConfigManager.getConfig && abilityConfigManager.getConfig(module.id));
            if (a && a.mountSprite) return a.mountSprite;
        }
        if (module.kind === 'defense') return 'mount_' + String(module.id || 'defense');
        return 'mount_' + String(module.id || 'ability');
    },

    getModuleShipSprite(module) {
        const key = this.resolveModuleShipSprite(module);
        if (!key || typeof ModuleSprites === 'undefined' || !ModuleSprites) return null;
        if (ModuleSprites[key]) return ModuleSprites[key];
        const role = module.role || this.getModuleVisualRole(module.kind, module.id);
        const fallback = role === 'hardpoint' || module.kind === 'weapon' ? 'mount_hardpoint'
            : (role === 'plating' ? 'mount_plating'
                : (module.kind === 'energy' || role === 'core' ? 'mount_energy_core'
                    : (role === 'thruster' ? 'mount_thruster'
                        : (role === 'pod' ? 'mount_pod' : 'mount_ability'))));
        return ModuleSprites[fallback] || ModuleSprites.mount_ability || null;
    },

    applyLayoutToModel(model, shipId) {
        if (!model) return model;
        const id = shipId || model.id;
        const coreSize = this.getCoreSize(model.modelClass, model);
        const loadout = this.getLoadout(id);
        if (model.segmentUv) loadout.segmentUv = model.segmentUv;
        const layout = this.buildLayout(coreSize.width, coreSize.height, loadout);
        const caps = this.getSlotCaps(id, model.modelClass);
        const hullBonus = this.getFrameHullBonus(id);

        model.coreWidth = coreSize.width;
        model.coreHeight = coreSize.height;
        model.nativeWidth = coreSize.width;
        model.nativeHeight = coreSize.height;
        model.modular = true;
        model.layout = layout;
        model.width = layout.width;
        model.height = layout.height;
        model.loadout = layout.loadout;
        model.moduleCount = layout.moduleCount;
        model.appearance = layout.appearance || null;
        model.slotCaps = caps;
        model.frameLevel = this.getFrameLevel(id);
        model.fireMode = (layout.loadout.abilities || []).indexOf('charge_shot') !== -1
            ? 'charge'
            : 'auto';
        layout.loadout.fireMode = model.fireMode;

        if (hullBonus.maxHealth) {
            model.maxHealth = (Number(model.maxHealth) || 0) + hullBonus.maxHealth;
        }
        if (hullBonus.armor) {
            model.armor = (Number(model.armor) || 0) + hullBonus.armor;
        }

        model.availableWeapons = layout.loadout.weapons.length
            ? layout.loadout.weapons.slice()
            : ['laser'];
        model.defaultWeapon = layout.loadout.weapons[0] || model.defaultWeapon || 'laser';
        model.abilities = layout.loadout.abilities.concat(layout.loadout.defenses);
        model.specialAbilities = model.abilities.map((a) =>
            String(a).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        );
        model.weapons = model.availableWeapons.map((w) =>
            String(w).replace(/\b\w/g, (c) => c.toUpperCase())
        );

        const defStats = this.computeDefenseStats(model.abilities);
        model.shieldMax = defStats.shieldMax;
        model.shieldRegen = defStats.shieldRegen;
        model.damageReduction = defStats.damageReduction;
        model.reflectChance = defStats.reflectChance;
        model.defenseMechanisms = defStats.mechs.slice();

        const chargeStats = this.computeChargeStats(model.abilities);
        model.chargeStats = chargeStats;

        const energyStats = this.computeEnergyStats(layout.loadout);
        model.maxEnergy = energyStats.maxEnergy;
        model.energyRegen = energyStats.regen;
        model.energyIdleDraw = energyStats.idleDraw;
        model.energyDrainMul = energyStats.drainMul;
        model.hasEnergyCore = energyStats.hasCore;
        model.energyStats = energyStats;
        model.shotEnergyCost = energyStats.shotCost;
        model.chargeEnergyPerSec = energyStats.chargePerSec;
        model.shieldAbsorbEnergyPerDmg = energyStats.shieldAbsorbPerDmg;
        model.boostEnergyPerSec = energyStats.boostPerSec;
        model.boostSpeedMul = energyStats.boostSpeedMul;

        return model;
    },

    /**
     * Shield / armor / reflect values from equipped defense modules.
     * Shared by hangar preview and in-game player.
     */
    computeDefenseStats(ids) {
        const list = Array.isArray(ids) ? ids : [];
        let shieldMax = 0;
        let shieldRegen = 0;
        let damageReduction = 0;
        let reflectChance = 0;
        const mechs = [];
        list.forEach((raw) => {
            const s = String(raw || '');
            if (!s) return;
            mechs.push(s);
            if (s.indexOf('shield') !== -1) {
                shieldMax += s.indexOf('adaptive') !== -1 ? 18
                    : (s.indexOf('generator') !== -1 ? 22 : 12);
                if (s.indexOf('regen') !== -1) shieldRegen += 4;
            }
            if (s.indexOf('massive_armor') !== -1) {
                damageReduction = Math.max(damageReduction, 15);
            } else if (s.indexOf('heavy_armor') !== -1) {
                damageReduction = Math.max(damageReduction, 10);
            }
        });
        if (mechs.indexOf('energy_shield') !== -1 || mechs.indexOf('adaptive_shield') !== -1) {
            reflectChance = Math.max(reflectChance, 20);
        }
        if (typeof profileManager !== 'undefined' && profileManager.getModuleUpgradeBonuses) {
            const b = profileManager.getModuleUpgradeBonuses();
            shieldMax = Math.round(shieldMax * (b.defenseCapacityMul || 1));
            shieldRegen *= (b.defenseRegenMul || 1);
            damageReduction = Math.min(80, damageReduction + Math.round((b.defenseHarden || 0) * 100));
        }
        return { shieldMax, shieldRegen, damageReduction, reflectChance, mechs };
    },

    /**
     * Idle draw for a single module id/kind.
     */
    getModuleIdleDraw(kind, id) {
        const s = String(id || '').toLowerCase();
        if (kind === 'weapon') {
            return this.heavyWeaponIds[s] ? 0.6 : 0.4;
        }
        if (kind === 'defense') {
            if (s.indexOf('shield') !== -1) return 0.8;
            return 0.2;
        }
        if (kind === 'ability') {
            if (s === 'charge_drive') return 0.2;
            return 0.3;
        }
        if (kind === 'energy') return 0;
        return 0;
    },

    getWeaponShotCost(weaponId) {
        const s = String(weaponId || 'laser').toLowerCase();
        if (typeof weaponConfigManager !== 'undefined' && weaponConfigManager.getWeapon) {
            const weapon = weaponConfigManager.getWeapon(s);
            if (weapon && weapon.energyCost != null) {
                return Math.max(0, Number(weapon.energyCost) || 0);
            }
        }
        return this.heavyWeaponIds[s] ? 6 : 4;
    },

    /**
     * Energy pool + drain multipliers from loadout + upgrades.
     */
    computeEnergyStats(loadout) {
        const L = this.normalizeLoadout(loadout);
        const hasCore = (L.energy || []).some((id) => this.isEnergyId(id));
        let drainMul = 1;
        let capBonus = 0;
        let regenBonus = 0;
        if (typeof profileManager !== 'undefined' && profileManager.getModuleUpgradeBonuses) {
            const b = profileManager.getModuleUpgradeBonuses();
            drainMul = Math.max(0.4, Number(b.energyDrainMul) || 1);
            capBonus = Math.max(0, Number(b.energyCapacityBonus) || 0);
            regenBonus = Math.max(0, Number(b.energyRegenBonus) || 0);
        }

        if (!hasCore) {
            return {
                hasCore: false,
                maxEnergy: 0,
                regen: 0,
                idleDraw: 0,
                drainMul: drainMul,
                shotCost: 0,
                chargePerSec: 0,
                shieldAbsorbPerDmg: 0,
                boostPerSec: 0,
                boostSpeedMul: 1
            };
        }

        const budget = this.computePowerBudget(L);
        const primaryWeapon = (L.weapons && L.weapons[0]) || 'laser';
        const hasDrive = (L.abilities || []).indexOf('charge_drive') !== -1;
        const hasDampen = (L.abilities || []).indexOf('drive_charge_dampen') !== -1;
        let boostPerSec = hasDrive ? 22 : 0;
        if (hasDrive && hasDampen) boostPerSec *= 0.7;

        return {
            hasCore: true,
            maxEnergy: 100 + capBonus,
            regen: 12 + regenBonus,
            idleDraw: budget.idleDraw,
            drainMul: drainMul,
            shotCost: this.getWeaponShotCost(primaryWeapon) * drainMul,
            chargePerSec: 12 * drainMul,
            shieldAbsorbPerDmg: 0.5 * drainMul,
            boostPerSec: boostPerSec * drainMul,
            boostSpeedMul: hasDrive ? 1.55 : 1
        };
    },
});
