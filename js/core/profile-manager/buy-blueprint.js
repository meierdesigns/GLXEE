"use strict";

// ProfileManager methods, split from profile-manager.js.
extendClass(ProfileManager, {
    buyBlueprint(shipId) {
        const profile = this.getActiveProfile();
        if (!profile || typeof economyConfig === 'undefined' || typeof shipConfigManager === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(profile);
        const id = String(shipId || '');
        if (!id || id === this.getStarterShipId()) {
            return { ok: false, reason: 'INVALID' };
        }
        const cfg = shipConfigManager.getConfig(id);
        if (!cfg || cfg.custom) {
            return { ok: false, reason: 'INVALID' };
        }
        if (!this.isShipAvailableInShop(id, profile)) {
            return { ok: false, reason: 'WRONG GALAXY' };
        }
        const cost = economyConfig.getBlueprintCost(cfg);
        const creditCost = Math.max(0, Math.round(Number(cost.credits) || 0));
        if (creditCost > 0) {
            if (!this.spendCredits(creditCost)) {
                return { ok: false, reason: 'CREDITS' };
            }
        } else if (!this.spendResources(cost)) {
            return { ok: false, reason: 'RESOURCES' };
        }
        profile.blueprints[id] = (profile.blueprints[id] || 0) + 1;
        this.discover('ships', id);
        this.save();
        return { ok: true };
    },

    /** `postId` buys from a docked trading post instead of the home shop. */
    buyPart(kind, partId, postId) {
        const profile = this.getActiveProfile();
        if (!profile || typeof economyConfig === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(profile);
        const k = String(kind || '');
        const id = String(partId || '');
        if (!id || (k !== 'weapon' && k !== 'defense' && k !== 'ability' && k !== 'energy')) {
            return { ok: false, reason: 'INVALID' };
        }

        let item = null;
        let discoverCat = null;
        if (k === 'weapon') {
            if (typeof weaponConfigManager === 'undefined') {
                return { ok: false, reason: 'NO PROFILE' };
            }
            item = weaponConfigManager.getWeapon(id);
            if (!item || item.id !== id) {
                return { ok: false, reason: 'INVALID' };
            }
            discoverCat = 'weapons';
        } else if (k === 'defense') {
            if (typeof abilityConfigManager === 'undefined') {
                return { ok: false, reason: 'NO PROFILE' };
            }
            item = abilityConfigManager.getAbility(id);
            if (!item || item.cluster !== 'defense') {
                return { ok: false, reason: 'INVALID' };
            }
            discoverCat = 'defenses';
        } else if (k === 'energy') {
            if (typeof abilityConfigManager === 'undefined') {
                return { ok: false, reason: 'NO PROFILE' };
            }
            item = abilityConfigManager.getAbility(id);
            if (!item || item.id !== id) {
                return { ok: false, reason: 'INVALID' };
            }
            if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.isEnergyId
                && !shipLoadoutManager.isEnergyId(id)) {
                return { ok: false, reason: 'INVALID' };
            }
            discoverCat = 'energy';
        } else {
            if (typeof abilityConfigManager === 'undefined') {
                return { ok: false, reason: 'NO PROFILE' };
            }
            item = abilityConfigManager.getAbility(id);
            if (!item || item.id !== id || item.cluster === 'defense') {
                return { ok: false, reason: 'INVALID' };
            }
            if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.isEnergyId
                && shipLoadoutManager.isEnergyId(id)) {
                return { ok: false, reason: 'INVALID' };
            }
            discoverCat = 'abilities';
        }

        if (postId) {
            if (!this.isPartInTradingPost(postId, k, id)) {
                return { ok: false, reason: 'NOT IN STOCK' };
            }
        } else if (!this.isPartAvailableInShop(k, id, profile)) {
            return { ok: false, reason: 'WRONG GALAXY' };
        }

        const cost = economyConfig.getPartCost(k, item);
        const creditCost = Math.max(0, Math.round(Number(cost.credits) || 0));
        if (creditCost > 0) {
            if (!this.spendCredits(creditCost)) {
                return { ok: false, reason: 'CREDITS' };
            }
        } else if (!this.spendResources(cost)) {
            return { ok: false, reason: 'RESOURCES' };
        }

        const bag = k === 'weapon' ? profile.parts.weapons
            : (k === 'defense' ? profile.parts.defenses
                : (k === 'energy' ? profile.parts.energy : profile.parts.abilities));
        bag[id] = (bag[id] || 0) + 1;
        this.discover(discoverCat, id);
        this.save();
        return { ok: true };
    },

    getPartCount(kind, partId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return 0;
        this.ensureEconomyDefaults(p);
        const id = String(partId || '');
        if (kind === 'weapon') return (p.parts.weapons[id] || 0);
        if (kind === 'defense') return (p.parts.defenses[id] || 0);
        if (kind === 'ability') return (p.parts.abilities[id] || 0);
        if (kind === 'energy') return (p.parts.energy && p.parts.energy[id]) || 0;
        return 0;
    },

    craftShip(shipId) {
        const profile = this.getActiveProfile();
        if (!profile || typeof economyConfig === 'undefined' || typeof shipConfigManager === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(profile);
        const id = String(shipId || '');
        if (!id || id === this.getStarterShipId()) {
            return { ok: false, reason: 'INVALID' };
        }
        if (profile.ownedShipIds.indexOf(id) !== -1) {
            return { ok: false, reason: 'OWNED' };
        }
        if (this.getFreeShipSlots(profile) < 1) {
            return { ok: false, reason: 'NO SHIP SLOTS' };
        }
        const bp = profile.blueprints[id] || 0;
        if (bp < 1) return { ok: false, reason: 'NO BLUEPRINT' };
        const cfg = shipConfigManager.getConfig(id);
        const cost = this.getDiscountedCraftCost(cfg, profile);
        if (!economyConfig.canAfford(profile.resources, cost)) {
            return { ok: false, reason: 'RESOURCES' };
        }
        if (!this.spendResources(cost)) {
            return { ok: false, reason: 'RESOURCES' };
        }
        profile.blueprints[id] = bp - 1;
        if (profile.blueprints[id] <= 0) delete profile.blueprints[id];
        profile.ownedShipIds.push(id);
        this.discoverShipContents(id);
        this.save();
        return { ok: true };
    },

    rename(id, name) {
        const profile = this.getProfile(id);
        if (!profile) return null;
        const trimmed = String(name || '').trim().toUpperCase().slice(0, 16);
        if (!trimmed) return null;
        profile.name = trimmed;
        this.save();
        return profile;
    },

    delete(id) {
        const pid = String(id || '');
        const idx = this.profiles.findIndex(p => p.id === pid);
        if (idx === -1) return false;
        this.profiles.splice(idx, 1);
        if (this.activeProfileId === pid) {
            this.activeProfileId = this.profiles[0] ? this.profiles[0].id : null;
        }
        this.save();
        return true;
    },

    setActive(id) {
        const profile = this.getProfile(id);
        if (!profile) return false;
        this.activeProfileId = profile.id;
        this.save();
        if (typeof factionShipStyles !== 'undefined' && factionShipStyles.applyDocumentFactionTheme) {
            factionShipStyles.applyDocumentFactionTheme(profile.faction);
        }
        return true;
    },

    logout() {
        this.activeProfileId = null;
        this.save();
    },

    getGalaxyProgress(galaxyId) {
        const profile = this.getActiveProfile();
        if (!profile) {
            return {
                unlockedPlanetIds: [],
                clearedPlanetIds: [],
                stages: {},
                totalPlanets: 0,
                clearedCount: 0,
                unlockedCount: 0,
                label: '0/0 CLEARED'
            };
        }
        const gid = String(galaxyId || '').toLowerCase();
        const gp = this.ensureGalaxyProgress(profile, gid);
        let totalPlanets = 0;
        if (typeof planetConfigManager !== 'undefined') {
            const g = planetConfigManager.getGalaxy(gid);
            totalPlanets = (g && g.planetIds) ? g.planetIds.length : 0;
            const map = planetConfigManager.getGalaxyMap(gid);
            if (map && map.nodes && map.nodes.length) {
                totalPlanets = map.nodes.length;
            }
        }
        const clearedCount = (gp.clearedPlanetIds || []).length;
        const unlockedCount = (gp.unlockedPlanetIds || []).length;
        return {
            unlockedPlanetIds: gp.unlockedPlanetIds.slice(),
            clearedPlanetIds: gp.clearedPlanetIds.slice(),
            stages: Object.assign({}, gp.stages),
            totalPlanets: totalPlanets,
            clearedCount: clearedCount,
            unlockedCount: unlockedCount,
            label: `${clearedCount}/${totalPlanets} CLEARED`
        };
    },

    isPlanetUnlocked(galaxyId, planetId) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        const gp = this.ensureGalaxyProgress(profile, galaxyId);
        const pid = String(planetId || '').toLowerCase();
        return gp.unlockedPlanetIds.indexOf(pid) !== -1;
    },

    isPlanetCleared(galaxyId, planetId) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        const gp = this.ensureGalaxyProgress(profile, galaxyId);
        const pid = String(planetId || '').toLowerCase();
        return gp.clearedPlanetIds.indexOf(pid) !== -1;
    },

    getPlanetStageState(galaxyId, planetId) {
        const profile = this.getActiveProfile();
        if (!profile) return { highestStage: 0, bossCleared: false };
        const gp = this.ensureGalaxyProgress(profile, galaxyId);
        const pid = String(planetId || '').toLowerCase();
        const st = gp.stages[pid];
        return st ? Object.assign({}, st) : { highestStage: 0, bossCleared: false };
    },
});
