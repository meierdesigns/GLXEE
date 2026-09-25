"use strict";

// ProfileManager methods, split from profile-manager.js.
extendClass(ProfileManager, {
    getModuleUpgradeBonuses(profile) {
        const p = profile || this.getActiveProfile();
        if (!p) {
            return {
                weaponDamageMul: 1,
                weaponCooldownMul: 1,
                weaponProjectileBonus: 0,
                defenseCapacityMul: 1,
                defenseHarden: 0,
                defenseRegenMul: 1,
                abilityCooldownMul: 1,
                abilityPotencyMul: 1,
                abilityDurationMul: 1,
                chargeFocus: 0,
                chargeOutput: 0,
                chargeBallast: 0,
                energyCapacityBonus: 0,
                energyRegenBonus: 0,
                energyDrainMul: 1,
                collectRadiusBonus: 0,
                collectYieldMul: 1,
                collectMagnet: 0
            };
        }
        this.ensureEconomyDefaults(p);
        const wPow = this.getModuleUpgradeLevel('weapons', 'power', p);
        const wCyc = this.getModuleUpgradeLevel('weapons', 'cyclic', p);
        const wBar = this.getModuleUpgradeLevel('weapons', 'barrel', p);
        const dCap = this.getModuleUpgradeLevel('defenses', 'capacity', p);
        const dHard = this.getModuleUpgradeLevel('defenses', 'harden', p);
        const dRec = this.getModuleUpgradeLevel('defenses', 'recover', p);
        const aEff = this.getModuleUpgradeLevel('abilities', 'efficiency', p);
        const aPot = this.getModuleUpgradeLevel('abilities', 'potency', p);
        const aDur = this.getModuleUpgradeLevel('abilities', 'duration', p);
        const cFoc = this.getModuleUpgradeLevel('charge', 'focus', p);
        const cOut = this.getModuleUpgradeLevel('charge', 'output', p);
        const cBal = this.getModuleUpgradeLevel('charge', 'ballast', p);
        const eCap = this.getModuleUpgradeLevel('energy', 'capacity', p);
        const eReg = this.getModuleUpgradeLevel('energy', 'regen', p);
        const eEff = this.getModuleUpgradeLevel('energy', 'efficiency', p);
        const colRad = this.getModuleUpgradeLevel('collector', 'radius', p);
        const colYld = this.getModuleUpgradeLevel('collector', 'yield', p);
        const colMag = this.getModuleUpgradeLevel('collector', 'magnet', p);
        return {
            weaponDamageMul: 1 + wPow * 0.08,
            weaponCooldownMul: Math.max(0.55, 1 - wCyc * 0.07),
            weaponProjectileBonus: wBar,
            defenseCapacityMul: 1 + dCap * 0.1,
            defenseHarden: dHard * 0.04,
            defenseRegenMul: 1 + dRec * 0.12,
            abilityCooldownMul: Math.max(0.55, 1 - aEff * 0.07),
            abilityPotencyMul: 1 + aPot * 0.1,
            abilityDurationMul: 1 + aDur * 0.1,
            chargeFocus: cFoc,
            chargeOutput: cOut,
            chargeBallast: cBal,
            energyCapacityBonus: eCap * 25,
            energyRegenBonus: eReg * 3,
            energyDrainMul: Math.max(0.4, 1 - eEff * 0.12),
            collectRadiusBonus: colRad * 14,
            collectYieldMul: 1 + colYld * 0.18,
            collectMagnet: colMag
        };
    },

    getExploreIndex(galaxyId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return 0;
        this.ensureEconomyDefaults(p);
        const gid = String(galaxyId || '').toLowerCase();
        return Math.max(0, Math.round(Number(p.homeStation.exploreCount[gid]) || 0));
    },

    getExploreCost(galaxyId, profile) {
        const idx = this.getExploreIndex(galaxyId, profile) + 1;
        return {
            scrap: 40 + idx * 25,
            crystal: 15 + idx * 10
        };
    },

    canExploreGalaxy(galaxyId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p || typeof economyConfig === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(p);
        const gid = String(galaxyId || '').toLowerCase();
        if (gid === 'milky_way') {
            return { ok: false, reason: 'HANDCRAFTED' };
        }
        const travel = this.canTravelToGalaxy(gid, p);
        if (!travel.ok) return travel;
        const levels = this.getStationUpgradeLevels(p);
        const budget = economyConfig.getExploreBudget(levels);
        const used = this.getExploreIndex(gid, p);
        if (used >= budget) {
            return { ok: false, reason: 'BUDGET', budget: budget };
        }
        const cost = this.getExploreCost(gid, p);
        if (!economyConfig.canAfford(p.resources, cost)) {
            return { ok: false, reason: 'RESOURCES', cost: cost };
        }
        return { ok: true, cost: cost, nextIndex: used + 1, budget: budget };
    },

    exploreGalaxyPlanet(galaxyId) {
        const profile = this.getActiveProfile();
        if (!profile || typeof planetConfigManager === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(profile);
        const gid = String(galaxyId || '').toLowerCase();
        const check = this.canExploreGalaxy(gid, profile);
        if (!check.ok) return check;
        if (!this.spendResources(check.cost)) {
            return { ok: false, reason: 'RESOURCES' };
        }
        const seed = String(profile.id) + '|' + gid + '|' + check.nextIndex;
        const result = planetConfigManager.generateExploredPlanet(gid, seed, check.nextIndex);
        if (!result || !result.ok) {
            // Refund on failure
            Object.keys(check.cost || {}).forEach((id) => {
                profile.resources[id] = (profile.resources[id] || 0) + (check.cost[id] || 0);
            });
            this.save();
            return result || { ok: false, reason: 'GENERATE' };
        }
        profile.homeStation.exploreCount[gid] = check.nextIndex;
        if (this.unlockPlanet) {
            this.unlockPlanet(result.planetId);
        } else {
            this.ensureGalaxyProgress(profile, gid);
            const gProg = profile.progress.galaxies[gid];
            if (gProg.unlockedPlanetIds.indexOf(result.planetId) === -1) {
                gProg.unlockedPlanetIds.push(result.planetId);
            }
        }
        this.save();
        return {
            ok: true,
            planetId: result.planetId,
            name: result.name,
            exploreIndex: check.nextIndex
        };
    },

    getFreeShipSlots(profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return 0;
        this.ensureEconomyDefaults(p);
        const stats = this.getStationStats(p);
        const owned = (p.ownedShipIds || []).length;
        return Math.max(0, stats.shipSlots - owned);
    },

    applyResourceCap(bag, amount, cap) {
        const cur = Math.max(0, Math.round(Number(bag) || 0));
        const add = Math.max(0, Math.round(Number(amount) || 0));
        const limit = Math.max(1, Math.round(Number(cap) || 1));
        const room = Math.max(0, limit - cur);
        const granted = Math.min(add, room);
        return { granted: granted, leftover: add - granted, next: cur + granted };
    },

    emptyDiscovered() {
        const starter = this.getStarterShipId();
        return {
            ships: [starter],
            planets: [],
            enemies: [],
            factions: ['terran'],
            galaxies: ['milky_way'],
            weapons: [],
            abilities: [],
            defenses: [],
            energy: ['energy_core'],
            events: []
        };
    },

    ensureDiscoveryDefaults(profile) {
        if (!profile) return null;
        if (!profile.discovered || typeof profile.discovered !== 'object') {
            profile.discovered = this.emptyDiscovered();
        }
        const keys = ['ships', 'planets', 'enemies', 'factions', 'galaxies', 'weapons', 'abilities', 'defenses', 'energy', 'events'];
        keys.forEach((k) => {
            if (!Array.isArray(profile.discovered[k])) {
                profile.discovered[k] = [];
            }
        });
        if (profile.discovered.galaxies.indexOf('milky_way') === -1) {
            profile.discovered.galaxies.push('milky_way');
        }
        if (profile.discovered.factions.indexOf('terran') === -1) {
            profile.discovered.factions.push('terran');
        }
        if (profile.discovered.energy.indexOf('energy_core') === -1) {
            profile.discovered.energy.push('energy_core');
        }
        const starter = this.getStarterShipId();
        if (profile.discovered.ships.indexOf(starter) === -1 &&
            Array.isArray(profile.ownedShipIds) &&
            profile.ownedShipIds.indexOf(starter) !== -1) {
            profile.discovered.ships.push(starter);
        }
        // Arsenal entries unlock only after finding items in play (not from starter loadout).
        if (Number(profile.discovered._v) < 2) {
            profile.discovered.weapons = [];
            profile.discovered.abilities = [];
            profile.discovered.defenses = [];
            profile.discovered._v = 2;
            this.save();
        }
        // Blueprints already found count as "seen" ships.
        const bpSources = [profile.blueprints, profile.cargo && profile.cargo.blueprints];
        bpSources.forEach((map) => {
            if (!map || typeof map !== 'object') return;
            Object.keys(map).forEach((id) => {
                if ((map[id] || 0) > 0 && profile.discovered.ships.indexOf(id) === -1) {
                    profile.discovered.ships.push(id);
                }
            });
        });
        (profile.unlockedShopIds || []).forEach((id) => {
            if (profile.discovered.ships.indexOf(id) === -1) {
                profile.discovered.ships.push(id);
            }
        });
        this.syncDiscoveredFactionsFromEnemies(profile);
        return profile;
    },

    syncDiscoveredFactionsFromEnemies(profile) {
        const p = profile || this.getActiveProfile();
        if (!p || !p.discovered) return;
        if (!Array.isArray(p.discovered.factions)) p.discovered.factions = ['terran'];
        if (p.discovered.factions.indexOf('terran') === -1) {
            p.discovered.factions.push('terran');
        }
        if (typeof enemyConfigManager === 'undefined') return;
        (p.discovered.enemies || []).forEach((enemyId) => {
            const cfg = enemyConfigManager.getConfig(enemyId);
            const list = (cfg && Array.isArray(cfg.factions) && cfg.factions.length)
                ? cfg.factions
                : (enemyConfigManager.getDefaultFaction
                    ? [enemyConfigManager.getDefaultFaction(enemyId)]
                    : []);
            list.forEach((fid) => {
                const id = String(fid || '').toLowerCase();
                if (!id) return;
                if (p.discovered.factions.indexOf(id) === -1) {
                    p.discovered.factions.push(id);
                }
            });
        });
    },

    discoverFaction(factionId) {
        const id = String(factionId || '').toLowerCase();
        if (!id) return false;
        return this.discover('factions', id);
    },
});
