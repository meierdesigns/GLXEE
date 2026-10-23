"use strict";

// ProfileManager methods, split from profile-manager.js.
extendClass(ProfileManager, {
    /**
     * Blueprints are for parts, keyed `kind:partId` (kind: weapon | defense |
     * ability | energy). Returns null for unknown or legacy ship keys.
     */
    parseBlueprintKey(key) {
        const raw = String(key || '');
        const sep = raw.indexOf(':');
        if (sep === -1) return null;
        const kind = raw.slice(0, sep);
        const id = raw.slice(sep + 1);
        if (!id || (kind !== 'weapon' && kind !== 'defense' && kind !== 'ability' && kind !== 'energy')) {
            return null;
        }
        const item = this.getPartItem(kind, id);
        if (!item) return null;
        return { key: kind + ':' + id, kind: kind, id: id, item: item };
    },

    getBlueprintName(key) {
        const bp = this.parseBlueprintKey(key);
        if (!bp) return String(key || '').toUpperCase();
        const name = (bp.kind !== 'weapon' && typeof abilityConfigManager !== 'undefined' && abilityConfigManager.getDisplayName)
            ? abilityConfigManager.getDisplayName(bp.id)
            : bp.item.name;
        return String(name || bp.id).toUpperCase();
    },

    /** Parts a blueprint can drop for: every weapon, defense, shop ability and the energy core. */
    getBlueprintPool() {
        const keys = [];
        if (typeof weaponConfigManager !== 'undefined') {
            weaponConfigManager.getIds().forEach((id) => keys.push('weapon:' + id));
        }
        if (typeof abilityConfigManager !== 'undefined') {
            const byCluster = abilityConfigManager.getIdsByCluster();
            (byCluster.defense || []).forEach((id) => keys.push('defense:' + id));
            TRADING_POST_ABILITY_IDS.forEach((id) => {
                if (abilityConfigManager.getAbility(id)) keys.push('ability:' + id);
            });
            if (abilityConfigManager.getAbility('energy_core')) keys.push('energy:energy_core');
        }
        return keys.filter((k) => this.parseBlueprintKey(k));
    },

    buyBlueprint(key) {
        const profile = this.getActiveProfile();
        if (!profile || typeof economyConfig === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(profile);
        const bp = this.parseBlueprintKey(key);
        if (!bp) return { ok: false, reason: 'INVALID' };
        const cost = economyConfig.getBlueprintCost(bp.kind, bp.item);
        if (!this.spendCredits(cost.credits)) {
            return { ok: false, reason: 'CREDITS' };
        }
        profile.blueprints[bp.key] = (profile.blueprints[bp.key] || 0) + 1;
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

    getBlueprintCraftCost(key, profile) {
        const bp = this.parseBlueprintKey(key);
        if (!bp || typeof economyConfig === 'undefined') return null;
        const base = economyConfig.getBlueprintCraftCost(bp.kind, bp.item);
        const stats = this.getStationStats(profile);
        const discount = Math.max(0, Math.min(0.5, Number(stats.craftDiscount) || 0));
        if (discount <= 0) return base;
        const out = {};
        Object.keys(base).forEach((id) => {
            out[id] = Math.max(1, Math.ceil(base[id] * (1 - discount)));
        });
        return out;
    },

    /** Uses one blueprint plus resources to build its part into station storage. */
    craftBlueprint(key) {
        const profile = this.getActiveProfile();
        if (!profile || typeof economyConfig === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(profile);
        const bp = this.parseBlueprintKey(key);
        if (!bp) return { ok: false, reason: 'INVALID' };
        const count = profile.blueprints[bp.key] || 0;
        if (count < 1) return { ok: false, reason: 'NO BLUEPRINT' };
        const cost = this.getBlueprintCraftCost(bp.key, profile);
        if (!this.spendResources(cost)) {
            return { ok: false, reason: 'RESOURCES' };
        }
        profile.blueprints[bp.key] = count - 1;
        if (profile.blueprints[bp.key] <= 0) delete profile.blueprints[bp.key];
        const bag = bp.kind === 'weapon' ? profile.parts.weapons
            : (bp.kind === 'defense' ? profile.parts.defenses
                : (bp.kind === 'energy' ? profile.parts.energy : profile.parts.abilities));
        bag[bp.id] = (bag[bp.id] || 0) + 1;
        const discoverCat = { weapon: 'weapons', defense: 'defenses', ability: 'abilities', energy: 'energy' }[bp.kind];
        this.discover(discoverCat, bp.id);
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

    /**
     * Progress is saved under the planet's own galaxy (markStageCleared), which
     * can differ from the galaxy the map shows it in — so look in both records.
     */
    _planetProgressRecords(profile, galaxyId, pid) {
        const out = [this.ensureGalaxyProgress(profile, galaxyId)];
        const own = typeof planetConfigManager !== 'undefined' && planetConfigManager.getPlanetGalaxyId
            ? planetConfigManager.getPlanetGalaxyId(pid) : null;
        if (own && own !== galaxyId) out.push(this.ensureGalaxyProgress(profile, own));
        return out;
    },

    isPlanetUnlocked(galaxyId, planetId) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        const pid = String(planetId || '').toLowerCase();
        if (this._planetProgressRecords(profile, galaxyId, pid).some((gp) => gp.unlockedPlanetIds.indexOf(pid) !== -1)) return true;
        // A cleared neighbour along a map edge opens the way (also heals saves
        // that stored the clear under another galaxy).
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyNeighbors) {
            return planetConfigManager.getGalaxyNeighbors(galaxyId, pid).some((nid) => this.isPlanetCleared(galaxyId, nid));
        }
        return false;
    },

    isPlanetCleared(galaxyId, planetId) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        const pid = String(planetId || '').toLowerCase();
        return this._planetProgressRecords(profile, galaxyId, pid).some((gp) => gp.clearedPlanetIds.indexOf(pid) !== -1);
    },

    getPlanetStageState(galaxyId, planetId) {
        const profile = this.getActiveProfile();
        if (!profile) return { highestStage: 0, bossCleared: false };
        const pid = String(planetId || '').toLowerCase();
        const gp = this.ensureGalaxyProgress(profile, galaxyId);
        let st = gp.stages[pid];
        // Stage clears are saved under the planet's own galaxy id
        // (markStageCleared → getPlanetGalaxyId), which can differ from the
        // galaxy the map shows it in: read that record as well.
        const own = typeof planetConfigManager !== 'undefined' && planetConfigManager.getPlanetGalaxyId
            ? planetConfigManager.getPlanetGalaxyId(pid) : null;
        if (own && own !== galaxyId) {
            const alt = this.ensureGalaxyProgress(profile, own).stages[pid];
            if (alt && (!st || (Number(alt.highestStage) || 0) > (Number(st.highestStage) || 0) || (alt.bossCleared && !st.bossCleared))) st = alt;
        }
        return st ? Object.assign({}, st) : { highestStage: 0, bossCleared: false };
    },
});
