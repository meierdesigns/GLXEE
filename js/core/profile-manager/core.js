"use strict";

/**
 * Player profiles with per-galaxy planet/stage progress.
 * Persist: localStorage vf_profiles_v1
 */
class ProfileManager {
    constructor() {
        this.storageKey = 'vf_profiles_v1';
        this.activeProfileId = null;
        this.profiles = [];
        this.load();
    }

    createId() {
        return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    emptyProgress() {
        return { galaxies: {} };
    }

    ensureGalaxyProgress(profile, galaxyId) {
        if (!profile || !profile.progress) {
            return null;
        }
        const gid = String(galaxyId || '').toLowerCase();
        if (!gid) return null;

        if (!profile.progress.galaxies) {
            profile.progress.galaxies = {};
        }

        let gp = profile.progress.galaxies[gid];
        if (!gp) {
            let startId = null;
            if (typeof planetConfigManager !== 'undefined') {
                const map = planetConfigManager.getGalaxyMap(gid);
                startId = map && map.startPlanetId;
                if (!startId && map && map.nodes && map.nodes[0]) {
                    startId = map.nodes[0].planetId;
                }
                const g = planetConfigManager.getGalaxy(gid);
                if (!startId && g && g.planetIds && g.planetIds[0]) {
                    startId = g.planetIds[0];
                }
            }
            gp = {
                unlockedPlanetIds: startId ? [startId] : [],
                clearedPlanetIds: [],
                stages: {}
            };
            profile.progress.galaxies[gid] = gp;
        }
        if (!Array.isArray(gp.unlockedPlanetIds)) gp.unlockedPlanetIds = [];
        if (!Array.isArray(gp.clearedPlanetIds)) gp.clearedPlanetIds = [];
        if (!gp.stages || typeof gp.stages !== 'object') gp.stages = {};
        return gp;
    }

    getStarterShipId() {
        return (typeof economyConfig !== 'undefined' && economyConfig.starterShipId)
            ? economyConfig.starterShipId
            : 'player_scrap';
    }

    emptyCargo() {
        return { resources: {}, blueprints: {} };
    }

    ensureEconomyDefaults(profile) {
        if (!profile) return null;
        const starter = this.getStarterShipId();
        if (!Array.isArray(profile.ownedShipIds)) {
            profile.ownedShipIds = [starter];
        }
        if (profile.ownedShipIds.indexOf(starter) === -1) {
            profile.ownedShipIds.unshift(starter);
        }
        if (!profile.activeShipId || profile.ownedShipIds.indexOf(profile.activeShipId) === -1) {
            profile.activeShipId = starter;
        }
        if (!Array.isArray(profile.unlockedShopIds)) {
            profile.unlockedShopIds = [];
        }
        if (!profile.blueprints || typeof profile.blueprints !== 'object') {
            profile.blueprints = {};
        }
        if (!profile.parts || typeof profile.parts !== 'object') {
            profile.parts = { weapons: {}, defenses: {}, abilities: {}, energy: {} };
        }
        if (!profile.parts.weapons || typeof profile.parts.weapons !== 'object') {
            profile.parts.weapons = {};
        }
        if (!profile.parts.defenses || typeof profile.parts.defenses !== 'object') {
            profile.parts.defenses = {};
        }
        if (!profile.parts.abilities || typeof profile.parts.abilities !== 'object') {
            profile.parts.abilities = {};
        }
        if (!profile.parts.energy || typeof profile.parts.energy !== 'object') {
            profile.parts.energy = {};
        }
        if ((profile.parts.energy.energy_core || 0) < 1) {
            profile.parts.energy.energy_core = 1;
        }
        if (!profile.resources || typeof profile.resources !== 'object') {
            profile.resources = {};
        }
        if (!Object.prototype.hasOwnProperty.call(profile, 'credits')
            || typeof profile.credits !== 'number'
            || !isFinite(profile.credits)) {
            profile.credits = (typeof economyConfig !== 'undefined' && economyConfig.starterCredits != null)
                ? economyConfig.starterCredits
                : 250;
        }
        profile.credits = Math.max(0, Math.round(profile.credits));
        if (!profile.cargo || typeof profile.cargo !== 'object') {
            profile.cargo = this.emptyCargo();
        }
        if (!profile.cargo.resources || typeof profile.cargo.resources !== 'object') {
            profile.cargo.resources = {};
        }
        if (!profile.cargo.blueprints || typeof profile.cargo.blueprints !== 'object') {
            profile.cargo.blueprints = {};
        }
        if (!profile.shipLoadouts || typeof profile.shipLoadouts !== 'object') {
            profile.shipLoadouts = {};
        }
        (profile.ownedShipIds || []).forEach((shipId) => {
            if (!profile.shipLoadouts[shipId] && typeof shipLoadoutManager !== 'undefined') {
                profile.shipLoadouts[shipId] = shipLoadoutManager.defaultLoadoutFromShip(shipId);
            }
        });
        if (!profile.homeStation || typeof profile.homeStation !== 'object') {
            profile.homeStation = { lastTeleportAt: 0 };
        }
        if (!profile.homeStation.upgrades || typeof profile.homeStation.upgrades !== 'object') {
            profile.homeStation.upgrades = {};
        }
        if (typeof economyConfig !== 'undefined' && Array.isArray(economyConfig.stationUpgradeOrder)) {
            economyConfig.stationUpgradeOrder.forEach((id) => {
                if (typeof profile.homeStation.upgrades[id] !== 'number') {
                    profile.homeStation.upgrades[id] = 0;
                }
            });
        }
        if (!profile.homeStation.currentGalaxyId) {
            profile.homeStation.currentGalaxyId = 'milky_way';
        }
        if (!Array.isArray(profile.homeStation.ownedPortalIds)) {
            profile.homeStation.ownedPortalIds = [];
        }
        if (typeof profile.homeStation.exploreCount !== 'object' || !profile.homeStation.exploreCount) {
            profile.homeStation.exploreCount = {};
        }
        if (!profile.shipUpgrades || typeof profile.shipUpgrades !== 'object') {
            profile.shipUpgrades = {};
        }
        (profile.ownedShipIds || []).forEach((shipId) => {
            if (!profile.shipUpgrades[shipId] || typeof profile.shipUpgrades[shipId] !== 'object') {
                profile.shipUpgrades[shipId] = { frameLevel: 0 };
            }
            if (typeof profile.shipUpgrades[shipId].frameLevel !== 'number') {
                profile.shipUpgrades[shipId].frameLevel = 0;
            }
        });
        if (!profile.moduleUpgrades || typeof profile.moduleUpgrades !== 'object') {
            profile.moduleUpgrades = (typeof economyConfig !== 'undefined' && economyConfig.emptyModuleUpgrades)
                ? economyConfig.emptyModuleUpgrades()
                : { weapons: {}, defenses: {}, abilities: {} };
        }
        if (typeof economyConfig !== 'undefined' && economyConfig.moduleUpgradeDefs) {
            const empty = economyConfig.emptyModuleUpgrades();
            Object.keys(empty).forEach((cat) => {
                if (!profile.moduleUpgrades[cat] || typeof profile.moduleUpgrades[cat] !== 'object') {
                    profile.moduleUpgrades[cat] = {};
                }
                Object.keys(empty[cat]).forEach((track) => {
                    if (typeof profile.moduleUpgrades[cat][track] !== 'number') {
                        profile.moduleUpgrades[cat][track] = 0;
                    }
                });
            });
        }
        if (!profile.progress) {
            profile.progress = this.emptyProgress();
        }
        this.ensureDiscoveryDefaults(profile);
        return profile;
    }

    emptyStationUpgrades() {
        const map = {};
        if (typeof economyConfig !== 'undefined' && Array.isArray(economyConfig.stationUpgradeOrder)) {
            economyConfig.stationUpgradeOrder.forEach((id) => { map[id] = 0; });
        }
        return map;
    }

    getStationUpgradeLevels(profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return this.emptyStationUpgrades();
        this.ensureEconomyDefaults(p);
        return Object.assign({}, p.homeStation.upgrades);
    }

    getStationStats(profile) {
        const p = profile || this.getActiveProfile();
        const levels = this.getStationUpgradeLevels(p);
        if (typeof economyConfig !== 'undefined' && economyConfig.computeStationStats) {
            return economyConfig.computeStationStats(levels);
        }
        return {
            resourceCap: 80,
            cargoCap: 40,
            shipSlots: 2,
            craftDiscount: 0,
            dropBonus: 0
        };
    }

    getStationUpgradeLevel(nodeId, profile) {
        const levels = this.getStationUpgradeLevels(profile);
        return Math.max(0, Math.round(Number(levels[nodeId]) || 0));
    }

    canUnlockStationUpgrade(nodeId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p || typeof economyConfig === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(p);
        const node = economyConfig.getStationUpgradeNode(nodeId);
        if (!node) return { ok: false, reason: 'INVALID' };
        const level = this.getStationUpgradeLevel(nodeId, p);
        if (level >= node.maxLevel) return { ok: false, reason: 'MAX LEVEL' };
        if (node.requires) {
            const reqLv = this.getStationUpgradeLevel(node.requires, p);
            if (reqLv < (node.requireLevel || 1)) {
                return { ok: false, reason: 'LOCKED' };
            }
        }
        const cost = economyConfig.getStationUpgradeCost(nodeId, level + 1);
        if (!cost) return { ok: false, reason: 'INVALID' };
        if (!economyConfig.canAfford(p.resources, cost)) {
            return { ok: false, reason: 'RESOURCES', cost: cost };
        }
        return { ok: true, cost: cost, nextLevel: level + 1 };
    }

    buyStationUpgrade(nodeId) {
        const profile = this.getActiveProfile();
        if (!profile || typeof economyConfig === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(profile);
        const check = this.canUnlockStationUpgrade(nodeId, profile);
        if (!check.ok) return check;
        if (!this.spendResources(check.cost)) {
            return { ok: false, reason: 'RESOURCES' };
        }
        profile.homeStation.upgrades[nodeId] = check.nextLevel;
        this.save();
        return { ok: true, level: check.nextLevel };
    }

    getCurrentGalaxyId(profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return 'milky_way';
        this.ensureEconomyDefaults(p);
        return String(p.homeStation.currentGalaxyId || 'milky_way').toLowerCase();
    }
}
