"use strict";

// ProfileManager methods, split from profile-manager.js.
extendClass(ProfileManager, {
    create(name, factionId) {
        const trimmed = String(name || '').trim().toUpperCase().slice(0, 16);
        if (!trimmed) return null;
        const starter = this.getStarterShipId();
        const faction = this.normalizeFactionId(factionId);
        const profile = {
            id: this.createId(),
            name: trimmed,
            faction: faction,
            createdAt: Date.now(),
            progress: this.emptyProgress(),
            ownedShipIds: [starter],
            activeShipId: starter,
            unlockedShopIds: [],
            blueprints: {},
            parts: { weapons: {}, defenses: {}, abilities: {}, energy: { energy_core: 1 } },
            resources: {},
            credits: (typeof economyConfig !== 'undefined' && economyConfig.starterCredits != null)
                ? economyConfig.starterCredits
                : 250,
            cargo: this.emptyCargo(),
            homeStation: {
                lastTeleportAt: 0,
                upgrades: this.emptyStationUpgrades(),
                currentGalaxyId: 'milky_way',
                ownedPortalIds: [],
                exploreCount: {}
            },
            shipUpgrades: {},
            moduleUpgrades: (typeof economyConfig !== 'undefined' && economyConfig.emptyModuleUpgrades)
                ? economyConfig.emptyModuleUpgrades()
                : { weapons: {}, defenses: {}, abilities: {} },
            discovered: this.emptyDiscovered()
        };
        this.ensureEconomyDefaults(profile);
        this.profiles.push(profile);
        this.activeProfileId = profile.id;
        this.discoverShipContents(starter);
        this.save();
        if (typeof factionManager !== 'undefined' && factionManager.join) {
            factionManager.join(faction);
        }
        if (typeof factionShipStyles !== 'undefined' && factionShipStyles.applyDocumentFactionTheme) {
            factionShipStyles.applyDocumentFactionTheme(faction);
        }
        return profile;
    },

    getOwnedShipIds(profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return [this.getStarterShipId()];
        this.ensureEconomyDefaults(p);
        return p.ownedShipIds.slice();
    },

    ownsShip(shipId, profile) {
        const id = String(shipId || '');
        return this.getOwnedShipIds(profile).indexOf(id) !== -1;
    },

    setActiveShip(shipId) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        this.ensureEconomyDefaults(profile);
        const id = String(shipId || '');
        if (profile.ownedShipIds.indexOf(id) === -1) return false;
        profile.activeShipId = id;
        this.discoverShipContents(id);
        this.save();
        return true;
    },

    getActiveShipId() {
        const profile = this.getActiveProfile();
        if (!profile) return this.getStarterShipId();
        this.ensureEconomyDefaults(profile);
        return profile.activeShipId;
    },

    /** Manual override for which hull-part shape variant set a given owned ship uses. */
    getHullShapeSeed(shipId) {
        const profile = this.getActiveProfile();
        if (!profile || !profile.hullShapeSeeds) return null;
        const seed = profile.hullShapeSeeds[String(shipId || '')];
        return seed != null ? seed : null;
    },

    setHullShapeSeed(shipId, seed) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        if (!profile.hullShapeSeeds) profile.hullShapeSeeds = {};
        profile.hullShapeSeeds[String(shipId || '')] = String(seed);
        this.save();
        return true;
    },

    /**
     * Per-segment shape variant override — lets a single hull part (nose,
     * center, aft, or the mirrored wing pair) be cycled through its own
     * shape options independently, instead of only being able to reroll
     * every part on the ship at once via the shape seed above.
     */
    getSegmentShapeVariant(shipId, segId) {
        const profile = this.getActiveProfile();
        const byShip = profile && profile.segmentShapeVariants && profile.segmentShapeVariants[String(shipId || '')];
        if (!byShip) return null;
        const v = byShip[String(segId || '')];
        return v != null ? Number(v) : null;
    },

    setSegmentShapeVariant(shipId, segId, variantIndex) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        if (!profile.segmentShapeVariants) profile.segmentShapeVariants = {};
        const key = String(shipId || '');
        if (!profile.segmentShapeVariants[key]) profile.segmentShapeVariants[key] = {};
        profile.segmentShapeVariants[key][String(segId || '')] = Number(variantIndex) || 0;
        this.save();
        return true;
    },

    getWingStyleSymmetry(shipId) {
        const profile = this.getActiveProfile();
        const byShip = profile && profile.wingStyleSymmetry;
        if (!byShip) return true;
        return byShip[String(shipId || '')] !== false;
    },

    setWingStyleSymmetry(shipId, enabled) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        if (!profile.wingStyleSymmetry) profile.wingStyleSymmetry = {};
        profile.wingStyleSymmetry[String(shipId || '')] = !!enabled;
        this.save();
        return true;
    },

    addOwnedShip(shipId) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        this.ensureEconomyDefaults(profile);
        const id = String(shipId || '');
        if (!id) return false;
        if (profile.ownedShipIds.indexOf(id) === -1) {
            profile.ownedShipIds.push(id);
            this.discoverShipContents(id);
            this.save();
        }
        return true;
    },

    removeOwnedShip(shipId) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        this.ensureEconomyDefaults(profile);
        const id = String(shipId || '');
        const starter = this.getStarterShipId();
        if (!id || id === starter) return false;
        const idx = profile.ownedShipIds.indexOf(id);
        if (idx === -1) return false;
        profile.ownedShipIds.splice(idx, 1);
        if (profile.activeShipId === id) {
            profile.activeShipId = starter;
        }
        this.save();
        return true;
    },

    toggleOwnedShip(shipId) {
        if (this.ownsShip(shipId)) {
            this.removeOwnedShip(shipId);
            return false;
        }
        this.addOwnedShip(shipId);
        return true;
    },

    setPartOwned(kind, partId, owned) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        this.ensureEconomyDefaults(profile);
        const k = String(kind || '');
        const id = String(partId || '');
        if (!id || (k !== 'weapon' && k !== 'defense' && k !== 'ability')) return false;
        const bag = k === 'weapon' ? profile.parts.weapons
            : (k === 'defense' ? profile.parts.defenses : profile.parts.abilities);
        if (owned) {
            if ((bag[id] || 0) < 1) bag[id] = 1;
            this.discover(k === 'weapon' ? 'weapons' : (k === 'defense' ? 'defenses' : 'abilities'), id);
        } else {
            delete bag[id];
        }
        this.save();
        return true;
    },

    togglePartOwned(kind, partId) {
        const has = this.getPartCount(kind, partId) > 0;
        this.setPartOwned(kind, partId, !has);
        return !has;
    },

    addCargoResource(resourceId, amount, options) {
        const profile = this.getActiveProfile();
        if (!profile) return 0;
        this.ensureEconomyDefaults(profile);
        const id = String(resourceId || '').toLowerCase();
        const n = Math.round(Number(amount) || 0);
        if (!id || n <= 0) return 0;
        const stats = this.getStationStats(profile);
        const applied = this.applyResourceCap(profile.cargo.resources[id], n, stats.cargoCap);
        if (applied.granted <= 0) return 0;
        profile.cargo.resources[id] = applied.next;
        if (!(options && options.skipSave)) {
            this.save();
        }
        return applied.granted;
    },

    addCargoBlueprint(shipId, amount) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        this.ensureEconomyDefaults(profile);
        const id = String(shipId || '');
        const n = Math.round(Number(amount) || 1);
        if (!id || n <= 0) return false;
        profile.cargo.blueprints[id] = (profile.cargo.blueprints[id] || 0) + n;
        this.discover('ships', id);
        this.save();
        return true;
    },

    grantPlanetResources(planetId) {
        const profile = this.getActiveProfile();
        if (!profile) return null;
        this.ensureEconomyDefaults(profile);
        const pid = String(planetId || '').toLowerCase();
        let table = null;
        if (typeof planetConfigManager !== 'undefined') {
            const cfg = planetConfigManager.getConfig(pid);
            if (cfg && Array.isArray(cfg.resources) && cfg.resources.length) {
                table = cfg.resources;
            }
        }
        if ((!table || !table.length) && typeof economyConfig !== 'undefined') {
            table = economyConfig.defaultPlanetResources[pid] || [];
        }
        if (typeof economyConfig === 'undefined') return null;
        const granted = economyConfig.rollPlanetResources(table);
        const stats = this.getStationStats(profile);
        const actual = {};
        Object.keys(granted).forEach((id) => {
            const n = granted[id] || 0;
            if (n <= 0) return;
            const applied = this.applyResourceCap(profile.cargo.resources[id], n, stats.cargoCap);
            if (applied.granted > 0) {
                profile.cargo.resources[id] = applied.next;
                actual[id] = applied.granted;
            }
        });
        this.save();
        return actual;
    },
});
