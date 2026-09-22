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

    ownsPortal(galaxyId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return false;
        this.ensureEconomyDefaults(p);
        const gid = String(galaxyId || '').toLowerCase();
        return (p.homeStation.ownedPortalIds || []).indexOf(gid) !== -1;
    }

    getShopFaction(profile) {
        const gid = this.getCurrentGalaxyId(profile);
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyFaction) {
            return String(planetConfigManager.getGalaxyFaction(gid) || 'terran').toLowerCase();
        }
        return 'terran';
    }

    isShopFactionMatch(itemFaction, shopFaction) {
        const f = itemFaction ? String(itemFaction).toLowerCase() : '';
        if (!f) return true;
        return f === String(shopFaction || '').toLowerCase();
    }

    isShipAvailableInShop(shipId, profile) {
        if (typeof shipConfigManager === 'undefined') return true;
        const cfg = shipConfigManager.getConfig(shipId);
        if (!cfg || cfg.custom) return false;
        return this.isShopFactionMatch(cfg.faction, this.getShopFaction(profile));
    }

    isPartAvailableInShop(kind, partId, profile) {
        const k = String(kind || '');
        const id = String(partId || '');
        let item = null;
        if (k === 'weapon') {
            if (typeof weaponConfigManager === 'undefined') return false;
            item = weaponConfigManager.getWeapon(id);
        } else if (k === 'defense' || k === 'ability' || k === 'energy') {
            if (typeof abilityConfigManager === 'undefined') return false;
            item = abilityConfigManager.getAbility(id);
        } else {
            return false;
        }
        if (!item) return false;
        return this.isShopFactionMatch(item.faction, this.getShopFaction(profile));
    }

    canTravelToGalaxy(galaxyId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p || typeof economyConfig === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(p);
        const levels = this.getStationUpgradeLevels(p);
        const gid = String(galaxyId || '').toLowerCase();
        if (typeof startScreenManager !== 'undefined' && startScreenManager.devMode) {
            return { ok: true };
        }
        if (this.ownsPortal(gid, p)) {
            return { ok: true, via: 'portal' };
        }
        if (!economyConfig.canTravelToGalaxy(gid, levels)) {
            const req = economyConfig.getGalaxyWarpRequirement(gid);
            return { ok: false, reason: 'DRIVE', requireWarp: req };
        }
        return { ok: true, via: 'warp' };
    }

    buyPortal(galaxyId) {
        const profile = this.getActiveProfile();
        if (!profile || typeof economyConfig === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(profile);
        const gid = String(galaxyId || '').toLowerCase();
        if (!gid || gid === 'milky_way') {
            return { ok: false, reason: 'INVALID' };
        }
        if (typeof planetConfigManager !== 'undefined' && !planetConfigManager.getGalaxy(gid)) {
            return { ok: false, reason: 'INVALID' };
        }
        if (this.ownsPortal(gid, profile)) {
            return { ok: false, reason: 'OWNED' };
        }
        const faction = (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyFaction)
            ? planetConfigManager.getGalaxyFaction(gid)
            : null;
        if (faction && !this.hasDiscoveredFaction(faction, profile)) {
            return { ok: false, reason: 'UNKNOWN FACTION' };
        }
        const cost = economyConfig.getPortalCost(gid);
        if (!cost) {
            return { ok: false, reason: 'INVALID' };
        }
        const creditCost = Math.max(0, Math.round(Number(cost.credits) || 0));
        if (creditCost > 0) {
            if (!this.spendCredits(creditCost)) {
                return { ok: false, reason: 'CREDITS' };
            }
        } else if (!this.spendResources(cost)) {
            return { ok: false, reason: 'RESOURCES' };
        }
        profile.homeStation.ownedPortalIds.push(gid);
        if (faction) this.discoverFaction(faction);
        this.save();
        return { ok: true, galaxyId: gid };
    }

    travelToGalaxy(galaxyId) {
        const profile = this.getActiveProfile();
        if (!profile) return { ok: false, reason: 'NO PROFILE' };
        this.ensureEconomyDefaults(profile);
        const gid = String(galaxyId || '').toLowerCase();
        const check = this.canTravelToGalaxy(gid, profile);
        if (!check.ok) return check;
        if (typeof planetConfigManager !== 'undefined' && !planetConfigManager.getGalaxy(gid)) {
            return { ok: false, reason: 'INVALID' };
        }
        profile.homeStation.currentGalaxyId = gid;

        const firstVisit = !this.hasDiscoveredGalaxy(gid, profile);

        let arrival = null;
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.ensureGalaxyArrivalContent) {
            arrival = planetConfigManager.ensureGalaxyArrivalContent(
                gid,
                String(profile.id) + '|' + gid,
                { firstVisit: firstVisit }
            );
            if (arrival && arrival.faction) {
                this.discoverFaction(arrival.faction);
            }
            if (arrival && arrival.ok && arrival.startPlanetId) {
                this.ensureGalaxyProgress(profile, gid);
                if (this.unlockPlanet) {
                    this.unlockPlanet(arrival.startPlanetId);
                } else {
                    const gProg = profile.progress.galaxies[gid];
                    if (gProg && gProg.unlockedPlanetIds.indexOf(arrival.startPlanetId) === -1) {
                        gProg.unlockedPlanetIds.push(arrival.startPlanetId);
                    }
                }
            }
        }

        this.discoverGalaxy(gid);
        this.save();
        return {
            ok: true,
            galaxyId: gid,
            faction: arrival && arrival.faction,
            seeded: !!(arrival && arrival.seeded),
            firstVisit: firstVisit,
            planetIds: (arrival && arrival.planetIds) || [],
            startPlanetId: (arrival && arrival.startPlanetId) || null
        };
    }

    getShipFrameLevel(shipId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return 0;
        this.ensureEconomyDefaults(p);
        const id = String(shipId || '');
        const entry = p.shipUpgrades && p.shipUpgrades[id];
        return Math.max(0, Math.round(Number(entry && entry.frameLevel) || 0));
    }

    canPurchaseShipFrameUpgrade(shipId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p || typeof economyConfig === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(p);
        const id = String(shipId || '');
        if (!this.ownsShip(id, p)) return { ok: false, reason: 'NOT OWNED' };
        const level = this.getShipFrameLevel(id, p);
        const max = economyConfig.maxShipFrameLevel || 9;
        if (level >= max) return { ok: false, reason: 'MAX LEVEL' };
        const cost = economyConfig.getShipFrameUpgradeCost(level + 1);
        if (!cost) return { ok: false, reason: 'INVALID' };
        if (!economyConfig.canAfford(p.resources, cost)) {
            return { ok: false, reason: 'RESOURCES', cost: cost, nextLevel: level + 1 };
        }
        return { ok: true, cost: cost, nextLevel: level + 1 };
    }

    purchaseShipFrameUpgrade(shipId) {
        const profile = this.getActiveProfile();
        if (!profile || typeof economyConfig === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(profile);
        const id = String(shipId || '');
        const check = this.canPurchaseShipFrameUpgrade(id, profile);
        if (!check.ok) return check;
        if (!this.spendResources(check.cost)) {
            return { ok: false, reason: 'RESOURCES' };
        }
        if (!profile.shipUpgrades[id]) profile.shipUpgrades[id] = { frameLevel: 0 };
        profile.shipUpgrades[id].frameLevel = check.nextLevel;
        this.save();
        return { ok: true, level: check.nextLevel };
    }

    getModuleUpgradeLevel(category, track, profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return 0;
        this.ensureEconomyDefaults(p);
        const cat = String(category || '');
        const t = String(track || '');
        const bag = p.moduleUpgrades && p.moduleUpgrades[cat];
        return Math.max(0, Math.round(Number(bag && bag[t]) || 0));
    }

    canPurchaseModuleUpgrade(category, track, profile) {
        const p = profile || this.getActiveProfile();
        if (!p || typeof economyConfig === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(p);
        const defs = economyConfig.moduleUpgradeDefs;
        const cat = String(category || '');
        const t = String(track || '');
        if (!defs || !defs[cat] || !defs[cat][t]) return { ok: false, reason: 'INVALID' };
        const level = this.getModuleUpgradeLevel(cat, t, p);
        const max = defs[cat][t].maxLevel;
        if (level >= max) return { ok: false, reason: 'MAX LEVEL' };
        const cost = economyConfig.getModuleUpgradeCost(cat, t, level + 1);
        if (!cost) return { ok: false, reason: 'INVALID' };
        if (!economyConfig.canAfford(p.resources, cost)) {
            return { ok: false, reason: 'RESOURCES', cost: cost, nextLevel: level + 1 };
        }
        return { ok: true, cost: cost, nextLevel: level + 1 };
    }

    purchaseModuleUpgrade(category, track) {
        const profile = this.getActiveProfile();
        if (!profile || typeof economyConfig === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(profile);
        const check = this.canPurchaseModuleUpgrade(category, track, profile);
        if (!check.ok) return check;
        if (!this.spendResources(check.cost)) {
            return { ok: false, reason: 'RESOURCES' };
        }
        const cat = String(category || '');
        const t = String(track || '');
        if (!profile.moduleUpgrades[cat]) profile.moduleUpgrades[cat] = {};
        profile.moduleUpgrades[cat][t] = check.nextLevel;
        this.save();
        return { ok: true, level: check.nextLevel };
    }

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
    }

    getExploreIndex(galaxyId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return 0;
        this.ensureEconomyDefaults(p);
        const gid = String(galaxyId || '').toLowerCase();
        return Math.max(0, Math.round(Number(p.homeStation.exploreCount[gid]) || 0));
    }

    getExploreCost(galaxyId, profile) {
        const idx = this.getExploreIndex(galaxyId, profile) + 1;
        return {
            scrap: 40 + idx * 25,
            crystal: 15 + idx * 10
        };
    }

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
    }

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
    }

    getFreeShipSlots(profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return 0;
        this.ensureEconomyDefaults(p);
        const stats = this.getStationStats(p);
        const owned = (p.ownedShipIds || []).length;
        return Math.max(0, stats.shipSlots - owned);
    }

    applyResourceCap(bag, amount, cap) {
        const cur = Math.max(0, Math.round(Number(bag) || 0));
        const add = Math.max(0, Math.round(Number(amount) || 0));
        const limit = Math.max(1, Math.round(Number(cap) || 1));
        const room = Math.max(0, limit - cur);
        const granted = Math.min(add, room);
        return { granted: granted, leftover: add - granted, next: cur + granted };
    }

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
    }

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
    }

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
    }

    discoverFaction(factionId) {
        const id = String(factionId || '').toLowerCase();
        if (!id) return false;
        return this.discover('factions', id);
    }

    hasDiscoveredGalaxy(galaxyId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return false;
        this.ensureDiscoveryDefaults(p);
        const gid = String(galaxyId || '').toLowerCase();
        if (!gid) return false;
        if (gid === 'milky_way') return true;
        return (p.discovered.galaxies || []).indexOf(gid) !== -1;
    }

    discoverGalaxy(galaxyId) {
        const gid = String(galaxyId || '').toLowerCase();
        if (!gid) return false;
        return this.discover('galaxies', gid);
    }

    hasDiscoveredFaction(factionId, profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return false;
        this.ensureDiscoveryDefaults(p);
        const id = String(factionId || '').toLowerCase();
        if (!id) return false;
        if (id === 'terran') return true;
        return (p.discovered.factions || []).indexOf(id) !== -1;
    }

    getDiscoveredFactions(profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return ['terran'];
        this.ensureDiscoveryDefaults(p);
        const list = (p.discovered.factions || []).slice();
        if (list.indexOf('terran') === -1) list.unshift('terran');
        return list;
    }

    discover(category, id) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        this.ensureEconomyDefaults(profile);
        const cat = String(category || '');
        const item = String(id || '');
        if (!cat || !item || !profile.discovered[cat]) return false;
        if (profile.discovered[cat].indexOf(item) !== -1) return false;
        profile.discovered[cat].push(item);
        this.save();
        return true;
    }

    undiscover(category, id) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        this.ensureEconomyDefaults(profile);
        const cat = String(category || '');
        const item = String(id || '');
        if (!cat || !item || !profile.discovered[cat]) return false;
        if (cat === 'ships' && item === this.getStarterShipId()) return false;
        const idx = profile.discovered[cat].indexOf(item);
        if (idx === -1) return false;
        profile.discovered[cat].splice(idx, 1);
        this.save();
        return true;
    }

    toggleDiscovered(category, id) {
        if (this.isDiscovered(category, id)) {
            this.undiscover(category, id);
            return false;
        }
        this.discover(category, id);
        return true;
    }

    hasDiscovered(category) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        this.ensureEconomyDefaults(profile);
        const list = profile.discovered[category];
        return Array.isArray(list) && list.length > 0;
    }

    isDiscovered(category, id) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        this.ensureEconomyDefaults(profile);
        const list = profile.discovered[category];
        const item = String(id || '');
        return !!item && Array.isArray(list) && list.indexOf(item) !== -1;
    }

    getDiscovered(category) {
        const profile = this.getActiveProfile();
        if (!profile) return [];
        this.ensureEconomyDefaults(profile);
        return (profile.discovered[category] || []).slice();
    }

    isDefenseAbilityId(abilityId) {
        const id = String(abilityId || '').toLowerCase();
        if (id === 'energy_core' || id.indexOf('energy_core') === 0) return false;
        return id.indexOf('shield') !== -1 ||
            id.indexOf('armor') !== -1 ||
            id === 'evasion_boost';
    }

    discoverLoadoutModules(loadout) {
        if (!loadout || typeof loadout !== 'object') return;
        (loadout.weapons || []).forEach((w) => this.discover('weapons', w));
        (loadout.abilities || []).forEach((a) => {
            if (typeof shipLoadoutManager !== 'undefined' && shipLoadoutManager.isEnergyId
                && shipLoadoutManager.isEnergyId(a)) {
                this.discover('energy', a);
            } else if (this.isDefenseAbilityId(a)) {
                this.discover('defenses', a);
            } else {
                this.discover('abilities', a);
            }
        });
        (loadout.defenses || []).forEach((d) => {
            this.discover('defenses', d);
            this.discover('abilities', d);
        });
        (loadout.energy || []).forEach((e) => this.discover('energy', e));
    }

    discoverShipContents(shipId) {
        const id = String(shipId || '');
        if (!id) return;
        this.discover('ships', id);
        // Starter hull alone does not reveal arsenal entries.
        if (id === this.getStarterShipId()) return;
        let loadout = null;
        const profile = this.getActiveProfile();
        if (profile && profile.shipLoadouts && profile.shipLoadouts[id]) {
            loadout = profile.shipLoadouts[id];
        } else if (typeof shipLoadoutManager !== 'undefined') {
            loadout = shipLoadoutManager.defaultLoadoutFromShip(id);
        }
        this.discoverLoadoutModules(loadout);
        if (typeof shipConfigManager !== 'undefined') {
            const cfg = shipConfigManager.getConfig(id);
            if (cfg) {
                if (cfg.defaultWeapon) this.discover('weapons', cfg.defaultWeapon);
                (cfg.availableWeapons || []).forEach((w) => this.discover('weapons', w));
            }
        }
    }

    discoverEnemyContents(enemyType) {
        const type = String(enemyType || '');
        if (!type) return;
        this.discover('enemies', type);
        if (typeof enemyConfigManager === 'undefined') return;
        const cfg = enemyConfigManager.getConfig(type);
        if (!cfg) return;
        const factions = (Array.isArray(cfg.factions) && cfg.factions.length)
            ? cfg.factions
            : (enemyConfigManager.getDefaultFaction
                ? [enemyConfigManager.getDefaultFaction(type)]
                : []);
        factions.forEach((fid) => this.discoverFaction(fid));
        const list = cfg.abilities || cfg.defenseMechanisms || [];
        list.forEach((a) => {
            this.discover('abilities', a);
            if (this.isDefenseAbilityId(a)) {
                this.discover('defenses', a);
            }
        });
    }

    load() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) {
                this.profiles = [];
                this.activeProfileId = null;
                return;
            }
            const parsed = JSON.parse(raw);
            this.profiles = Array.isArray(parsed.profiles) ? parsed.profiles : [];
            this.profiles.forEach((p) => this.ensureEconomyDefaults(p));
            this.activeProfileId = parsed.activeProfileId || null;
            if (this.activeProfileId && !this.getProfile(this.activeProfileId)) {
                this.activeProfileId = this.profiles[0] ? this.profiles[0].id : null;
            }
            this.save();
        } catch (e) {
            this.profiles = [];
            this.activeProfileId = null;
        }
    }

    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify({
                activeProfileId: this.activeProfileId,
                profiles: this.profiles
            }));
        } catch (e) {
            console.warn('ProfileManager: save failed', e);
        }
    }

    getProfiles() {
        return this.profiles.slice();
    }

    getProfile(id) {
        const pid = String(id || '');
        return this.profiles.find(p => p.id === pid) || null;
    }

    getActiveProfile() {
        return this.getProfile(this.activeProfileId);
    }

    hasActiveProfile() {
        return !!this.getActiveProfile();
    }

    create(name) {
        const trimmed = String(name || '').trim().toUpperCase().slice(0, 16);
        if (!trimmed) return null;
        const starter = this.getStarterShipId();
        const profile = {
            id: this.createId(),
            name: trimmed,
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
        return profile;
    }

    getOwnedShipIds(profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return [this.getStarterShipId()];
        this.ensureEconomyDefaults(p);
        return p.ownedShipIds.slice();
    }

    ownsShip(shipId, profile) {
        const id = String(shipId || '');
        return this.getOwnedShipIds(profile).indexOf(id) !== -1;
    }

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
    }

    getActiveShipId() {
        const profile = this.getActiveProfile();
        if (!profile) return this.getStarterShipId();
        this.ensureEconomyDefaults(profile);
        return profile.activeShipId;
    }

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
    }

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
    }

    toggleOwnedShip(shipId) {
        if (this.ownsShip(shipId)) {
            this.removeOwnedShip(shipId);
            return false;
        }
        this.addOwnedShip(shipId);
        return true;
    }

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
    }

    togglePartOwned(kind, partId) {
        const has = this.getPartCount(kind, partId) > 0;
        this.setPartOwned(kind, partId, !has);
        return !has;
    }

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
    }

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
    }

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
    }

    tryBlueprintDrop(killInfo) {
        const profile = this.getActiveProfile();
        if (!profile || typeof economyConfig === 'undefined') return null;
        this.ensureEconomyDefaults(profile);
        const stats = this.getStationStats(profile);
        const chance = Math.min(0.5, economyConfig.getBlueprintDropChance(killInfo) + (stats.dropBonus || 0));
        if (Math.random() > chance) return null;
        const shipId = economyConfig.pickBlueprintShipId(profile.ownedShipIds);
        if (!shipId) return null;
        this.addCargoBlueprint(shipId, 1);
        return shipId;
    }

    hasCargo() {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        this.ensureEconomyDefaults(profile);
        const hasRes = Object.keys(profile.cargo.resources).some((k) => profile.cargo.resources[k] > 0);
        const hasBp = Object.keys(profile.cargo.blueprints).some((k) => profile.cargo.blueprints[k] > 0);
        return hasRes || hasBp;
    }

    teleportCargoToStation() {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        this.ensureEconomyDefaults(profile);
        const stats = this.getStationStats(profile);
        let moved = false;
        Object.keys(profile.cargo.resources).forEach((id) => {
            const n = profile.cargo.resources[id] || 0;
            if (n <= 0) return;
            const applied = this.applyResourceCap(profile.resources[id], n, stats.resourceCap);
            if (applied.granted > 0) {
                profile.resources[id] = applied.next;
                moved = true;
            }
            if (applied.leftover > 0) {
                profile.cargo.resources[id] = applied.leftover;
            } else {
                delete profile.cargo.resources[id];
            }
        });
        Object.keys(profile.cargo.blueprints).forEach((id) => {
            const n = profile.cargo.blueprints[id] || 0;
            if (n > 0) {
                profile.blueprints[id] = (profile.blueprints[id] || 0) + n;
                delete profile.cargo.blueprints[id];
                moved = true;
            }
        });
        if (!Object.keys(profile.cargo.resources).length && !Object.keys(profile.cargo.blueprints).length) {
            profile.cargo = this.emptyCargo();
        }
        profile.homeStation.lastTeleportAt = Date.now();
        this.save();
        return moved;
    }

    spendResources(costMap) {
        const profile = this.getActiveProfile();
        if (!profile || typeof economyConfig === 'undefined') return false;
        this.ensureEconomyDefaults(profile);
        if (!economyConfig.canAfford(profile.resources, costMap)) return false;
        Object.keys(costMap || {}).forEach((id) => {
            profile.resources[id] = (profile.resources[id] || 0) - (costMap[id] || 0);
            if (profile.resources[id] <= 0) delete profile.resources[id];
        });
        this.save();
        return true;
    }

    getCredits(profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return 0;
        this.ensureEconomyDefaults(p);
        return Math.max(0, Math.round(Number(p.credits) || 0));
    }

    canAffordCredits(amount, profile) {
        return this.getCredits(profile) >= Math.max(0, Math.round(Number(amount) || 0));
    }

    spendCredits(amount, skipSave) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        this.ensureEconomyDefaults(profile);
        const n = Math.max(0, Math.round(Number(amount) || 0));
        if (n <= 0) return true;
        if (profile.credits < n) return false;
        profile.credits -= n;
        if (!skipSave) this.save();
        return true;
    }

    addCredits(amount, skipSave) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        this.ensureEconomyDefaults(profile);
        const n = Math.max(0, Math.round(Number(amount) || 0));
        if (n <= 0) return true;
        profile.credits = Math.max(0, Math.round(Number(profile.credits) || 0) + n);
        if (!skipSave) this.save();
        return true;
    }

    getResourceBag(bag, profile) {
        const p = profile || this.getActiveProfile();
        if (!p) return null;
        this.ensureEconomyDefaults(p);
        const kind = String(bag || 'station').toLowerCase();
        if (kind === 'cargo') return p.cargo.resources;
        return p.resources;
    }

    getResourceBagCap(bag, profile) {
        const stats = this.getStationStats(profile);
        return String(bag || 'station').toLowerCase() === 'cargo'
            ? stats.cargoCap
            : stats.resourceCap;
    }

    /**
     * Buy resource into station or cargo. Paid from uncapped CREDITS.
     * bag: 'station' | 'cargo'
     */
    buyShopResource(resourceId, amount, bag) {
        const profile = this.getActiveProfile();
        if (!profile || typeof economyConfig === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(profile);
        const id = String(resourceId || '').toLowerCase();
        const n = Math.max(1, Math.round(Number(amount) || 1));
        const bagKind = String(bag || 'station').toLowerCase() === 'cargo' ? 'cargo' : 'station';
        if (!economyConfig.isResourceTradeable(id)) {
            return { ok: false, reason: 'INVALID' };
        }
        const bagMap = this.getResourceBag(bagKind, profile);
        const cap = this.getResourceBagCap(bagKind, profile);
        const applied = this.applyResourceCap(bagMap[id], n, cap);
        if (applied.granted <= 0) {
            return { ok: false, reason: bagKind === 'cargo' ? 'CARGO FULL' : 'STATION FULL' };
        }
        const paid = economyConfig.getResourceBuyCost(id, applied.granted);
        if (!paid || !this.spendCredits(paid.credits, true)) {
            return { ok: false, reason: 'CREDITS' };
        }
        bagMap[id] = applied.next;
        this.save();
        return { ok: true, amount: applied.granted, bag: bagKind, cost: paid };
    }

    /**
     * Sell resource from station or cargo. Credits payout is uncapped.
     * bag: 'station' | 'cargo'
     */
    sellShopResource(resourceId, amount, bag) {
        const profile = this.getActiveProfile();
        if (!profile || typeof economyConfig === 'undefined') {
            return { ok: false, reason: 'NO PROFILE' };
        }
        this.ensureEconomyDefaults(profile);
        const id = String(resourceId || '').toLowerCase();
        const n = Math.max(1, Math.round(Number(amount) || 1));
        const bagKind = String(bag || 'station').toLowerCase() === 'cargo' ? 'cargo' : 'station';
        if (!economyConfig.isResourceTradeable(id)) {
            return { ok: false, reason: 'INVALID' };
        }
        const bagMap = this.getResourceBag(bagKind, profile);
        const have = Math.max(0, Math.round(Number(bagMap[id]) || 0));
        if (have < 1) return { ok: false, reason: 'EMPTY' };
        const sold = Math.min(n, have);
        const payout = economyConfig.getResourceSellPayout(id, sold);
        if (!payout) return { ok: false, reason: 'INVALID' };
        bagMap[id] = have - sold;
        if (bagMap[id] <= 0) delete bagMap[id];
        this.addCredits(payout.credits, true);
        this.save();
        return { ok: true, amount: sold, bag: bagKind, payout: payout };
    }

    getDiscountedCraftCost(shipConfig, profile) {
        const base = (typeof economyConfig !== 'undefined')
            ? economyConfig.getCraftCost(shipConfig)
            : { scrap: 80 };
        const stats = this.getStationStats(profile);
        const discount = Math.max(0, Math.min(0.5, Number(stats.craftDiscount) || 0));
        if (discount <= 0) return base;
        const out = {};
        Object.keys(base).forEach((id) => {
            out[id] = Math.max(1, Math.ceil(base[id] * (1 - discount)));
        });
        return out;
    }

    isShopUnlocked(shipId) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        this.ensureEconomyDefaults(profile);
        return profile.unlockedShopIds.indexOf(String(shipId || '')) !== -1;
    }

    unlockShopItem(shipId) {
        const profile = this.getActiveProfile();
        if (!profile) return { ok: false, reason: 'NO PROFILE' };
        this.ensureEconomyDefaults(profile);
        const id = String(shipId || '');
        if (!id || id === this.getStarterShipId()) {
            return { ok: false, reason: 'INVALID' };
        }
        if (profile.unlockedShopIds.indexOf(id) !== -1) {
            return { ok: false, reason: 'ALREADY UNLOCKED' };
        }
        const count = profile.blueprints[id] || 0;
        if (count < 1) return { ok: false, reason: 'NO BLUEPRINT' };
        profile.blueprints[id] = count - 1;
        if (profile.blueprints[id] <= 0) delete profile.blueprints[id];
        profile.unlockedShopIds.push(id);
        this.discover('ships', id);
        this.save();
        return { ok: true };
    }

    buyShip(shipId) {
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
        const cfg = shipConfigManager.getConfig(id);
        if (!cfg || cfg.custom) {
            return { ok: false, reason: 'INVALID' };
        }
        if (!this.isShipAvailableInShop(id, profile)) {
            return { ok: false, reason: 'WRONG GALAXY' };
        }
        const cost = economyConfig.getShopCost(cfg);
        const creditCost = Math.max(0, Math.round(Number(cost.credits) || 0));
        if (creditCost > 0) {
            if (!this.spendCredits(creditCost)) {
                return { ok: false, reason: 'CREDITS' };
            }
        } else if (!this.spendResources(cost)) {
            return { ok: false, reason: 'RESOURCES' };
        }
        profile.ownedShipIds.push(id);
        if (profile.unlockedShopIds.indexOf(id) === -1) {
            profile.unlockedShopIds.push(id);
        }
        this.discoverShipContents(id);
        this.save();
        return { ok: true };
    }

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
    }

    buyPart(kind, partId) {
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

        if (!this.isPartAvailableInShop(k, id, profile)) {
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
    }

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
    }

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
    }

    rename(id, name) {
        const profile = this.getProfile(id);
        if (!profile) return null;
        const trimmed = String(name || '').trim().toUpperCase().slice(0, 16);
        if (!trimmed) return null;
        profile.name = trimmed;
        this.save();
        return profile;
    }

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
    }

    setActive(id) {
        const profile = this.getProfile(id);
        if (!profile) return false;
        this.activeProfileId = profile.id;
        this.save();
        return true;
    }

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
    }

    isPlanetUnlocked(galaxyId, planetId) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        const gp = this.ensureGalaxyProgress(profile, galaxyId);
        const pid = String(planetId || '').toLowerCase();
        return gp.unlockedPlanetIds.indexOf(pid) !== -1;
    }

    isPlanetCleared(galaxyId, planetId) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        const gp = this.ensureGalaxyProgress(profile, galaxyId);
        const pid = String(planetId || '').toLowerCase();
        return gp.clearedPlanetIds.indexOf(pid) !== -1;
    }

    getPlanetStageState(galaxyId, planetId) {
        const profile = this.getActiveProfile();
        if (!profile) return { highestStage: 0, bossCleared: false };
        const gp = this.ensureGalaxyProgress(profile, galaxyId);
        const pid = String(planetId || '').toLowerCase();
        const st = gp.stages[pid];
        return st ? Object.assign({}, st) : { highestStage: 0, bossCleared: false };
    }

    /**
     * Next stage to play for a planet based on saved progress.
     * Plain planet ids (mars) resume after the highest cleared stage.
     */
    getResumeLevelId(planetId) {
        const pid = String(planetId || '').toLowerCase().split('-')[0];
        if (!pid) return null;

        let galaxyId = null;
        if (typeof planetConfigManager !== 'undefined') {
            galaxyId = planetConfigManager.getPlanetGalaxyId(pid);
        }
        const stagesPerPlanet = (typeof game !== 'undefined'
            && game.levelManager
            && game.levelManager.stagesPerPlanet)
            || (typeof gameCore !== 'undefined'
                && gameCore.levelManager
                && gameCore.levelManager.stagesPerPlanet)
            || 3;
        const st = galaxyId
            ? this.getPlanetStageState(galaxyId, pid)
            : { highestStage: 0, bossCleared: false };

        if (st.bossCleared) {
            return `${pid}-1`;
        }
        const highest = Math.max(0, Math.round(Number(st.highestStage) || 0));
        if (highest >= stagesPerPlanet) {
            return `${pid}-boss`;
        }
        if (highest > 0) {
            return `${pid}-${highest + 1}`;
        }
        return `${pid}-1`;
    }

    /**
     * Start options for planet select: from stage 1, or continue at saved progress.
     * canChoose is true when mid-planet progress exists (not cleared, highestStage > 0).
     */
    getPlanetStartOptions(planetId) {
        const pid = String(planetId || '').toLowerCase().split('-')[0];
        if (!pid) {
            return {
                canChoose: false,
                startLevelId: null,
                resumeLevelId: null,
                resumeLabel: 'STAGE 1'
            };
        }

        let galaxyId = null;
        if (typeof planetConfigManager !== 'undefined') {
            galaxyId = planetConfigManager.getPlanetGalaxyId(pid);
        }
        const stagesPerPlanet = (typeof game !== 'undefined'
            && game.levelManager
            && game.levelManager.stagesPerPlanet)
            || (typeof gameCore !== 'undefined'
                && gameCore.levelManager
                && gameCore.levelManager.stagesPerPlanet)
            || 3;
        const st = galaxyId
            ? this.getPlanetStageState(galaxyId, pid)
            : { highestStage: 0, bossCleared: false };
        const highest = Math.max(0, Math.round(Number(st.highestStage) || 0));
        const resumeLevelId = this.getResumeLevelId(pid) || `${pid}-1`;
        let resumeLabel = 'STAGE 1';
        if (st.bossCleared) {
            resumeLabel = 'STAGE 1';
        } else if (highest >= stagesPerPlanet) {
            resumeLabel = 'BOSS';
        } else if (highest > 0) {
            resumeLabel = `STAGE ${highest + 1}`;
        }

        return {
            canChoose: !st.bossCleared && highest > 0,
            startLevelId: `${pid}-1`,
            resumeLevelId,
            resumeLabel
        };
    }

    markStageCleared(planetId, stageKey) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        const pid = String(planetId || '').toLowerCase();
        if (!pid) return false;

        let galaxyId = null;
        if (typeof planetConfigManager !== 'undefined') {
            galaxyId = planetConfigManager.getPlanetGalaxyId(pid);
        }
        if (!galaxyId) return false;

        const gp = this.ensureGalaxyProgress(profile, galaxyId);
        if (!gp.stages[pid]) {
            gp.stages[pid] = { highestStage: 0, bossCleared: false };
        }
        const st = gp.stages[pid];
        const key = String(stageKey || '1').toLowerCase();
        if (key === 'boss') {
            st.bossCleared = true;
            this.markPlanetCleared(pid);
            return true;
        }
        const num = parseInt(key, 10);
        if (!Number.isNaN(num) && num > (st.highestStage || 0)) {
            st.highestStage = num;
        }
        if (gp.unlockedPlanetIds.indexOf(pid) === -1) {
            gp.unlockedPlanetIds.push(pid);
        }
        this.save();
        return true;
    }

    markPlanetCleared(planetId) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        const pid = String(planetId || '').toLowerCase();
        if (!pid) return false;

        let galaxyId = null;
        if (typeof planetConfigManager !== 'undefined') {
            galaxyId = planetConfigManager.getPlanetGalaxyId(pid);
        }
        if (!galaxyId) return false;

        const gp = this.ensureGalaxyProgress(profile, galaxyId);
        if (gp.clearedPlanetIds.indexOf(pid) === -1) {
            gp.clearedPlanetIds.push(pid);
        }
        if (gp.unlockedPlanetIds.indexOf(pid) === -1) {
            gp.unlockedPlanetIds.push(pid);
        }
        if (!gp.stages[pid]) {
            gp.stages[pid] = { highestStage: 3, bossCleared: true };
        } else {
            gp.stages[pid].bossCleared = true;
        }

        // Unlock neighbors along graph edges
        if (typeof planetConfigManager !== 'undefined' && planetConfigManager.getGalaxyNeighbors) {
            const neighbors = planetConfigManager.getGalaxyNeighbors(galaxyId, pid);
            neighbors.forEach(nid => {
                if (gp.unlockedPlanetIds.indexOf(nid) === -1) {
                    gp.unlockedPlanetIds.push(nid);
                }
            });
        }

        this.discover('planets', pid);
        this.save();
        return true;
    }

    unlockPlanet(planetId) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        const pid = String(planetId || '').toLowerCase();
        if (!pid) return false;
        let galaxyId = null;
        if (typeof planetConfigManager !== 'undefined') {
            galaxyId = planetConfigManager.getPlanetGalaxyId(pid);
        }
        if (!galaxyId) return false;
        const gp = this.ensureGalaxyProgress(profile, galaxyId);
        if (gp.unlockedPlanetIds.indexOf(pid) === -1) {
            gp.unlockedPlanetIds.push(pid);
        }
        this.discover('planets', pid);
        this.save();
        return true;
    }

    lockPlanet(planetId) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        const pid = String(planetId || '').toLowerCase();
        if (!pid) return false;
        let galaxyId = null;
        if (typeof planetConfigManager !== 'undefined') {
            galaxyId = planetConfigManager.getPlanetGalaxyId(pid);
        }
        if (!galaxyId) return false;
        const gp = this.ensureGalaxyProgress(profile, galaxyId);
        const uIdx = gp.unlockedPlanetIds.indexOf(pid);
        if (uIdx !== -1) gp.unlockedPlanetIds.splice(uIdx, 1);
        const cIdx = gp.clearedPlanetIds.indexOf(pid);
        if (cIdx !== -1) gp.clearedPlanetIds.splice(cIdx, 1);
        if (gp.stages && gp.stages[pid]) delete gp.stages[pid];
        this.undiscover('planets', pid);
        this.save();
        return true;
    }

    togglePlanetVisited(planetId) {
        let galaxyId = null;
        if (typeof planetConfigManager !== 'undefined') {
            galaxyId = planetConfigManager.getPlanetGalaxyId(planetId);
        }
        if (!galaxyId) return false;
        if (this.isPlanetUnlocked(galaxyId, planetId) || this.isPlanetCleared(galaxyId, planetId)) {
            this.lockPlanet(planetId);
            return false;
        }
        this.unlockPlanet(planetId);
        return true;
    }

    unmarkPlanetCleared(planetId) {
        const profile = this.getActiveProfile();
        if (!profile) return false;
        const pid = String(planetId || '').toLowerCase();
        if (!pid) return false;
        let galaxyId = null;
        if (typeof planetConfigManager !== 'undefined') {
            galaxyId = planetConfigManager.getPlanetGalaxyId(pid);
        }
        if (!galaxyId) return false;
        const gp = this.ensureGalaxyProgress(profile, galaxyId);
        const cIdx = gp.clearedPlanetIds.indexOf(pid);
        if (cIdx !== -1) gp.clearedPlanetIds.splice(cIdx, 1);
        if (gp.stages && gp.stages[pid]) {
            gp.stages[pid].bossCleared = false;
        }
        this.save();
        return true;
    }

    togglePlanetCleared(planetId) {
        let galaxyId = null;
        if (typeof planetConfigManager !== 'undefined') {
            galaxyId = planetConfigManager.getPlanetGalaxyId(planetId);
        }
        if (!galaxyId) return false;
        if (this.isPlanetCleared(galaxyId, planetId)) {
            this.unmarkPlanetCleared(planetId);
            return false;
        }
        this.markPlanetCleared(planetId);
        return true;
    }
}

const profileManager = new ProfileManager();
window.profileManager = profileManager;
